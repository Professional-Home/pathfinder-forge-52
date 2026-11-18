-- ====================================================================
-- SUPABASE STORAGE RLS REMEDIATION MIGRATION V1.2 (OWNERSHIP-SAFE)
-- Target Bucket: course-applications (Private)
-- Purpose: 
--   1. Correct the Storage bucket ID mismatch from historical 'course-application-documents'
--      to the actual staging bucket 'course-applications'.
--   2. Enforce strict tenant-isolated student read access, admin authorization,
--      and zero anonymous access.
--   3. TYPE-SAFETY HARDENING: Retains regex pre-validation before UUID casting to prevent
--      PostgreSQL 22P02 ("invalid input syntax for type uuid") runtime exceptions
--      when arbitrary/non-UUID object paths are queried.
--   4. OWNERSHIP-SAFE RLS PRECONDITION (V1.2): Replaces privileged 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY'
--      (which fails with 42501 'must be owner of table objects' under standard Supabase SQL Editor roles)
--      with a non-privileged, fail-closed catalog assertion checking pg_class.relrowsecurity.
--
-- Target Environment: Staging Supabase (neexbpcvedcfwjxpgede)
-- CRITICAL OPERATOR SAFETY NOTICE:
--   - The operator MUST manually verify in the Supabase Dashboard URL/Settings that
--     the active project reference is exactly "neexbpcvedcfwjxpgede" before executing this script.
--   - Execution against Production project "knrmfpgwcdtpwcgkjrnk" is STRICTLY PROHIBITED.
--   - This SQL script does NOT programmatically introspect or verify the Supabase project reference.
--
-- Safety Guarantees & Constraints:
--   - Fully idempotent: drops existing course application policies before recreation
--   - Confirms target bucket 'course-applications' exists and enforces private status (public = false)
--   - Strictly isolated to bucket 'course-applications' (zero impact on Spin Wheel, article-images, or opportunity-images)
--   - Zero table ownership changes or DDL alterations on storage.objects
-- ====================================================================

BEGIN;

-- Preflight Check 1: Ensure bucket exists and is private
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-applications') THEN
        RAISE EXCEPTION 'Precondition Failed: Target storage bucket "course-applications" does not exist in this environment!';
    END IF;

    -- Ensure bucket is strictly private
    UPDATE storage.buckets
    SET public = false
    WHERE id = 'course-applications';
END $$;

-- Preflight Check 2: Verify Row Level Security is active on storage.objects (Fail-Closed Catalog Assertion)
-- Does NOT attempt ALTER TABLE, avoiding PostgreSQL error 42501 ("must be owner of table objects")
DO $$
DECLARE
    v_rls_enabled boolean;
BEGIN
    SELECT c.relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects';

    IF v_rls_enabled IS NOT TRUE THEN
        RAISE EXCEPTION 'Precondition Failed: Row Level Security is NOT enabled on storage.objects (relrowsecurity = false or table missing)! Migration aborted.';
    END IF;
END $$;

-- 1. Clean up legacy/misaligned policies referencing historical bucket name or course-applications
DROP POLICY IF EXISTS "course_docs_service_role_all" ON storage.objects;
DROP POLICY IF EXISTS "course_docs_student_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "course_docs_admin_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "course_docs_client_insert_deny" ON storage.objects;

-- 2. Policy: Service Role Full Access (used by server functions for signed URLs and backend management)
CREATE POLICY "course_docs_service_role_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'course-applications')
WITH CHECK (bucket_id = 'course-applications');

-- 3. Policy: Authenticated Student Read Access to Own Application Documents
-- Path convention: <application_id>/<document_type>/<filename>
-- Hardened with CASE/regex to prevent 22P02 invalid UUID cast runtime exceptions
CREATE POLICY "course_docs_student_read_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-applications'
    AND (
        CASE 
            WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN (storage.foldername(name))[1]::uuid
            ELSE NULL
        END
    ) IN (
        SELECT id FROM public.course_applications
        WHERE user_id = auth.uid()
    )
);

-- 4. Policy: Administrator Read Access to All Application Documents
-- Enforces admin role check from app_metadata (consistent with application schema)
CREATE POLICY "course_docs_admin_read_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-applications'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
);

COMMIT;

-- ====================================================================
-- VERIFICATION QUERY
-- ====================================================================
-- SELECT policyname, cmd, roles, qual FROM pg_policies 
-- WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'course_docs_%';
