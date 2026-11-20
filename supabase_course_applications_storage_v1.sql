-- ====================================================================
-- SUPABASE STORAGE CONFIGURATION — COURSE APPLICATION DOCUMENTS
-- Phase 3 Implementation (Consolidated Release)
-- Target Bucket: course-application-documents (Private)
-- Governed by DEC-04 (10MB limit, PDF/JPEG/PNG) and DEC-05 (Data Retention)
--
-- Instructions: [MANUAL — YOU MUST DO THIS]
--   Execute this script in the Supabase Dashboard SQL Editor.
-- ====================================================================

BEGIN;

-- 1. Create Private Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'course-application-documents',
    'course-application-documents',
    false, -- Strictly private
    10485760, -- 10 MB limit (DEC-04)
    ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[];

-- 2. Storage RLS Policies on storage.objects

-- Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Deny all direct client uploads/inserts (Uploads are mediated via signed upload URLs from server)
-- Revoke broad client insert policies on this bucket
DROP POLICY IF EXISTS "course_docs_client_insert_deny" ON storage.objects;
DROP POLICY IF EXISTS "course_docs_student_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "course_docs_admin_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "course_docs_service_role_all" ON storage.objects;

-- Policy 1: Service Role has full access (used by server functions for signed URLs and management)
CREATE POLICY "course_docs_service_role_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'course-application-documents')
WITH CHECK (bucket_id = 'course-application-documents');

-- Policy 2: Authenticated Student read access to their own application folder
-- Path convention: <application_id>/<document_type>/<filename>
CREATE POLICY "course_docs_student_read_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-application-documents'
    AND (
        (storage.foldername(name))[1]::uuid IN (
            SELECT id FROM public.course_applications
            WHERE user_id = auth.uid()
        )
    )
);

-- Policy 3: Administrator read access to all application documents
CREATE POLICY "course_docs_admin_read_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'course-application-documents'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
);

COMMIT;

-- ====================================================================
-- VERIFICATION QUERY:
-- SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'course-application-documents';
-- ====================================================================
