-- ====================================================================
-- SUPABASE STORAGE RLS REMEDIATION MIGRATION V1.2 (PRODUCTION & STAGING)
-- Target Bucket: course-applications (Private)
-- Purpose: 
--   1. Automate safe creation of the private 'course-applications' bucket when absent,
--      or enforce strict zero-mutation verification of existing bucket privacy and
--      compatibility (public = false, file_size_limit = 10485760, exact allowed MIME types).
--   2. Enforce strict, fail-closed pre-drop catalog verification against exact known
--      historical repository definitions (schema, table, cmd, permissive mode, exact roles,
--      exact canonical USING, and exact canonical WITH CHECK). Replaces weak substring checks
--      and eliminates SQL three-valued logic (3VL) NULL bypasses.
--   3. Enforce a complete catalog audit of ALL other policies on storage.objects to prove
--      that no other permissive policy grants unauthorized access to 'course-applications'.
--      Strictly rejects negations (NOT, <>), disjunctions (OR), IS NOT NULL, or broad clauses.
--   4. Recreate the three authoritative, tenant-isolated CMS security policies:
--      - course_docs_service_role_all (service_role full administrative access)
--      - course_docs_student_read_policy (student read access with UUID regex pre-guard)
--      - course_docs_admin_read_policy (admin read access via app_metadata.role)
--   5. Enforce zero direct client uploads (no client INSERT/ALL policy created).
--   6. Enforce ownership-safe RLS precondition via non-privileged pg_class.relrowsecurity check.
--   7. Post-DDL assertion verifying bucket state, exact definitions of all three CMS policies
--      (with NULL-safe IS DISTINCT FROM assertions), absence of CMS client-write policies,
--      and full catalog isolation.
--
-- Target Database: Supabase / PostgreSQL 15+ (Production knrmfpgwcdtpwcgkjrnk & Staging neexbpcvedcfwjxpgede)
-- Safety Guarantees & Constraints:
--   - Fully enclosed in an atomic transaction (BEGIN ... COMMIT)
--   - Fails closed on any unexpected relation, policy, or catalog ambiguity before drop
--   - Zero modifications to unrelated buckets or unrelated application policies
--   - Zero table ownership changes or DDL alterations on storage.objects
-- ====================================================================

BEGIN;

-- ====================================================================
-- Preflight Check 1: Storage Bucket Provisioning & Strict Validation
-- ====================================================================
DO $$
DECLARE
    v_bucket RECORD;
BEGIN
    SELECT id, name, public, file_size_limit, allowed_mime_types
    INTO v_bucket
    FROM storage.buckets
    WHERE id = 'course-applications';

    IF v_bucket.id IS NULL THEN
        -- Safely create bucket when absent with exact required private configuration
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'course-applications',
            'course-applications',
            false, -- Strictly private
            10485760, -- Exactly 10 MB limit (DEC-04)
            ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
        );

        -- Immediately re-fetch and verify the created bucket matches exact required configuration
        SELECT id, name, public, file_size_limit, allowed_mime_types
        INTO v_bucket
        FROM storage.buckets
        WHERE id = 'course-applications';

        IF v_bucket.id IS NULL
           OR v_bucket.public IS NOT FALSE
           OR v_bucket.file_size_limit IS NULL
           OR v_bucket.file_size_limit <> 10485760
           OR v_bucket.allowed_mime_types IS NULL
           OR cardinality(v_bucket.allowed_mime_types) <> 3
           OR NOT (v_bucket.allowed_mime_types @> ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
                   AND v_bucket.allowed_mime_types <@ ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[])
        THEN
            RAISE EXCEPTION 'Post-Creation Assertion Failed: Storage bucket "course-applications" was created with unexpected or invalid configuration (public=%, file_size_limit=%, allowed_mime_types=%).',
                v_bucket.public, v_bucket.file_size_limit, v_bucket.allowed_mime_types
                USING ERRCODE = 'check_violation';
        END IF;

        RAISE NOTICE 'Successfully created and verified private storage bucket "course-applications" (public=false, 10MB limit, allowed_mime_types=[application/pdf, image/jpeg, image/png]).';
    ELSE
        -- Bucket exists: verify privacy and compatibility without silent modification
        -- 1. Check public status: must be strictly false
        IF v_bucket.public IS NOT FALSE THEN
            RAISE EXCEPTION 'Safety Violation: Existing storage bucket "course-applications" is public (public = %). Course application documents require a strictly private bucket. Aborting without modification; manual remediation required.',
                v_bucket.public
                USING ERRCODE = 'data_exception';
        END IF;

        -- 2. Check file_size_limit: must be exactly 10485760 bytes (reject NULL, unlimited, smaller, or larger)
        IF v_bucket.file_size_limit IS NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing storage bucket "course-applications" has NULL/unlimited file_size_limit. Expected exactly 10485760 bytes (10 MB). Aborting without modification; manual remediation required.'
                USING ERRCODE = 'data_exception';
        ELSIF v_bucket.file_size_limit <> 10485760 THEN
            RAISE EXCEPTION 'Safety Violation: Existing storage bucket "course-applications" has file_size_limit of % bytes. Expected exactly 10485760 bytes (10 MB). Aborting without modification; manual remediation required.',
                v_bucket.file_size_limit
                USING ERRCODE = 'data_exception';
        END IF;

        -- 3. Check allowed_mime_types: must contain exactly [application/pdf, image/jpeg, image/png]
        -- Reject NULL, missing MIME types, additional MIME types, or duplicate MIME types
        IF v_bucket.allowed_mime_types IS NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing storage bucket "course-applications" has NULL allowed_mime_types (unrestricted MIME types). Expected exactly [application/pdf, image/jpeg, image/png]. Aborting without modification; manual remediation required.'
                USING ERRCODE = 'data_exception';
        ELSIF cardinality(v_bucket.allowed_mime_types) <> 3
           OR NOT (v_bucket.allowed_mime_types @> ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
                   AND v_bucket.allowed_mime_types <@ ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[])
        THEN
            RAISE EXCEPTION 'Safety Violation: Existing storage bucket "course-applications" has incompatible allowed_mime_types % (expected exactly [application/pdf, image/jpeg, image/png] without missing, additional, or duplicate MIME types). Aborting without modification; manual remediation required.',
                v_bucket.allowed_mime_types
                USING ERRCODE = 'data_exception';
        END IF;

        RAISE NOTICE 'Verified existing private storage bucket "course-applications" configuration is fully compatible (public=false, 10MB limit, allowed_mime_types=[application/pdf, image/jpeg, image/png]); preserving configuration.';
    END IF;
END $$;

-- ====================================================================
-- Preflight Check 2: Verify Row Level Security is active on storage.objects
-- Non-privileged catalog assertion checking pg_class.relrowsecurity
-- ====================================================================
DO $$
DECLARE
    v_rls_enabled boolean;
BEGIN
    SELECT c.relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects';

    IF v_rls_enabled IS NOT TRUE THEN
        RAISE EXCEPTION 'Precondition Failed: Row Level Security is NOT enabled on storage.objects (relrowsecurity = false or table missing)! Migration aborted.'
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    RAISE NOTICE 'Preflight Check 2 Passed: Row Level Security is active on storage.objects.';
END $$;

-- ====================================================================
-- Step 1: Pre-Drop Catalog Audit & Exact Historical Policy Verification
-- ====================================================================
DO $$
DECLARE
    rec RECORD;
    v_norm_qual text;
    v_has_service_role_all boolean := false;
    v_has_student_read boolean := false;
    v_has_admin_read boolean := false;
    v_drop_count integer := 0;
    v_depth integer;
    v_encloses boolean;
    v_len integer;
    v_i integer;
    v_ch text;
BEGIN
    -- 1.1 Global catalog check - verify NO target policy exists on an unexpected table
    FOR rec IN 
        SELECT schemaname, tablename, policyname
        FROM pg_catalog.pg_policies
        WHERE policyname IN (
            'course_docs_service_role_all',
            'course_docs_student_read_policy',
            'course_docs_admin_read_policy',
            'course_docs_client_insert_deny'
        )
    LOOP
        IF rec.schemaname <> 'storage' OR rec.tablename <> 'objects' THEN
            RAISE EXCEPTION 'Safety Violation: Policy "%" exists on unexpected relation %.% (expected storage.objects). Aborting drop to prevent policy removal on unexpected resources.',
                rec.policyname, rec.schemaname, rec.tablename
                USING ERRCODE = 'invalid_table_definition';
        END IF;
    END LOOP;

    -- 1.2 Comprehensive Catalog Isolation Audit: Inspect ALL other policies on storage.objects
    -- Verify that no unrelated permissive policy can grant broad/unisolated access to 'course-applications'
    -- Strictly rejects negations (NOT, <>), disjunctions (OR), IS NOT NULL, or unproven expressions
    FOR rec IN 
        SELECT policyname, permissive, roles, cmd, qual, with_check
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND policyname NOT IN (
              'course_docs_service_role_all',
              'course_docs_student_read_policy',
              'course_docs_admin_read_policy',
              'course_docs_client_insert_deny'
          )
    LOOP
        -- If any unrelated policy references course application buckets, fail closed
        IF COALESCE(rec.qual, '') ~* 'course-application(s|-documents)'
           OR COALESCE(rec.with_check, '') ~* 'course-application(s|-documents)'
        THEN
            RAISE EXCEPTION 'Safety Violation: Unrelated policy "%" on storage.objects explicitly references course application buckets (qual: %, with_check: %). Cannot prove isolation. Aborting.',
                rec.policyname, rec.qual, rec.with_check
                USING ERRCODE = 'P0001';
        END IF;

        -- For any permissive policy, ensure it strictly isolates to a specific non-course bucket
        -- Fails closed on NOT, <>, !=, OR, IS NOT NULL, or any ambiguous/broad expression
        IF rec.permissive = 'PERMISSIVE' THEN
            -- Check READ / ALL access (qual must be proven safe)
            IF rec.cmd IN ('ALL', 'SELECT') THEN
                IF rec.qual IS NULL
                   OR rec.qual ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.qual ~ '[!<>~]'
                   OR rec.qual ~* '\mIS\s+NOT\M'
                   OR rec.qual ~* '\mIS\s+NULL\M'
                   OR rec.qual ~* 'course-application'
                   OR NOT (
                       rec.qual ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.qual ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Safety Violation: Unrelated permissive policy "%" on storage.objects grants % access without proven exclusion of course-applications (qual: %). Cannot prove isolation. Aborting.',
                        rec.policyname, rec.cmd, rec.qual
                        USING ERRCODE = 'P0001';
                END IF;
            END IF;

            -- Check WRITE / INSERT access (with_check must be proven safe)
            IF rec.cmd IN ('ALL', 'INSERT') THEN
                IF rec.with_check IS NULL
                   OR rec.with_check ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.with_check ~ '[!<>~]'
                   OR rec.with_check ~* '\mIS\s+NOT\M'
                   OR rec.with_check ~* '\mIS\s+NULL\M'
                   OR rec.with_check ~* 'course-application'
                   OR NOT (
                       rec.with_check ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.with_check ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Safety Violation: Unrelated permissive policy "%" on storage.objects grants % access without proven exclusion of course-applications (with_check: %). Cannot prove isolation. Aborting.',
                        rec.policyname, rec.cmd, rec.with_check
                        USING ERRCODE = 'P0001';
                END IF;
            END IF;

            -- Check UPDATE access (both qual and with_check must be proven safe)
            IF rec.cmd = 'UPDATE' THEN
                IF rec.qual IS NULL
                   OR rec.qual ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.qual ~ '[!<>~]'
                   OR rec.qual ~* '\mIS\s+NOT\M'
                   OR rec.qual ~* '\mIS\s+NULL\M'
                   OR rec.qual ~* 'course-application'
                   OR NOT (
                       rec.qual ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.qual ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                   OR rec.with_check IS NULL
                   OR rec.with_check ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.with_check ~ '[!<>~]'
                   OR rec.with_check ~* '\mIS\s+NOT\M'
                   OR rec.with_check ~* '\mIS\s+NULL\M'
                   OR rec.with_check ~* 'course-application'
                   OR NOT (
                       rec.with_check ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.with_check ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Safety Violation: Unrelated permissive policy "%" on storage.objects grants UPDATE access without proven exclusion of course-applications (qual: %, with_check: %). Cannot prove isolation. Aborting.',
                        rec.policyname, rec.qual, rec.with_check
                        USING ERRCODE = 'P0001';
                END IF;
            END IF;

            -- Check DELETE access (qual must be proven safe)
            IF rec.cmd = 'DELETE' THEN
                IF rec.qual IS NULL
                   OR rec.qual ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.qual ~ '[!<>~]'
                   OR rec.qual ~* '\mIS\s+NOT\M'
                   OR rec.qual ~* '\mIS\s+NULL\M'
                   OR rec.qual ~* 'course-application'
                   OR NOT (
                       rec.qual ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.qual ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Safety Violation: Unrelated permissive policy "%" on storage.objects grants DELETE access without proven exclusion of course-applications (qual: %). Cannot prove isolation. Aborting.',
                        rec.policyname, rec.qual
                        USING ERRCODE = 'P0001';
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- 1.3 Exact Historical Verification for "course_docs_service_role_all"
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_service_role_all';

    IF FOUND THEN
        IF rec.cmd IS DISTINCT FROM 'ALL' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" has cmd "%" (expected ALL). Manual inspection required.', rec.cmd
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.permissive IS DISTINCT FROM 'PERMISSIVE' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" has permissive "%" (expected PERMISSIVE). Manual inspection required.', rec.permissive
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.roles IS DISTINCT FROM ARRAY['service_role']::name[] THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" has roles % (expected {service_role}). Manual inspection required.', rec.roles
                USING ERRCODE = 'P0001';
        END IF;

        -- Explicit NULL check eliminating 3VL bypass
        IF rec.qual IS NULL OR rec.with_check IS NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" has NULL qual or with_check. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Strict rejection of OR disjunctions
        IF rec.qual ~* '\mOR\M' OR rec.with_check ~* '\mOR\M' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" contains unsafe OR disjunction. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Exact canonical USING match
        IF btrim(rec.qual, '() ') NOT IN (
            'bucket_id = ''course-applications''::text',
            'bucket_id = ''course-application-documents''::text'
        ) THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" has unexpected qual (%). Manual inspection required.', rec.qual
                USING ERRCODE = 'P0001';
        END IF;

        -- Exact canonical WITH CHECK match
        IF btrim(rec.with_check, '() ') NOT IN (
            'bucket_id = ''course-applications''::text',
            'bucket_id = ''course-application-documents''::text'
        ) THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_service_role_all" has unexpected with_check (%). Manual inspection required.', rec.with_check
                USING ERRCODE = 'P0001';
        END IF;

        v_has_service_role_all := true;
    END IF;

    -- 1.4 Exact Historical Verification for "course_docs_student_read_policy"
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_student_read_policy';

    IF FOUND THEN
        IF rec.cmd IS DISTINCT FROM 'SELECT' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" has cmd "%" (expected SELECT). Manual inspection required.', rec.cmd
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.permissive IS DISTINCT FROM 'PERMISSIVE' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" has permissive "%" (expected PERMISSIVE). Manual inspection required.', rec.permissive
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.roles IS DISTINCT FROM ARRAY['authenticated']::name[] THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" has roles % (expected {authenticated}). Manual inspection required.', rec.roles
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.with_check IS NOT NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" has unexpected WITH CHECK expression. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.qual IS NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" has NULL qual. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Strict rejection of OR disjunctions
        IF rec.qual ~* '\mOR\M' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" contains unsafe OR disjunction. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Exact match against approved historical canonical deparsed definitions
        -- Normalize qual: unwrap genuine outer enclosing parentheses without stripping internal expression structure
        v_norm_qual := btrim(rec.qual);
        WHILE v_norm_qual LIKE '(%)' LOOP
            v_depth := 0;
            v_encloses := true;
            v_len := length(v_norm_qual);
            FOR v_i IN 1 .. (v_len - 1) LOOP
                v_ch := substr(v_norm_qual, v_i, 1);
                IF v_ch = '(' THEN
                    v_depth := v_depth + 1;
                ELSIF v_ch = ')' THEN
                    v_depth := v_depth - 1;
                END IF;
                IF v_depth = 0 THEN
                    v_encloses := false;
                    EXIT;
                END IF;
            END LOOP;
            IF v_encloses THEN
                v_norm_qual := btrim(substr(v_norm_qual, 2, v_len - 2));
            ELSE
                EXIT;
            END IF;
        END LOOP;
        v_norm_qual := regexp_replace(v_norm_qual, '\s+', ' ', 'g');
        IF v_norm_qual NOT IN (
            -- Historical Variant 1: unhardened UUID cast (course-applications)
            '(bucket_id = ''course-applications''::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            -- Historical Variant 1: unhardened UUID cast (course-application-documents)
            '(bucket_id = ''course-application-documents''::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            -- Historical Variant 3: Actual PostgreSQL canonical deparse (course-applications)
            '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM course_applications WHERE (user_id = auth.uid())))',
            -- Historical Variant 3: Actual PostgreSQL canonical deparse (course-application-documents)
            '(bucket_id = ''course-application-documents''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM course_applications WHERE (user_id = auth.uid())))',
            -- Historical Variant 3: Without leading space in '(CASE' (course-applications)
            '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM course_applications WHERE (user_id = auth.uid())))',
            -- Historical Variant 3: Without leading space in '(CASE' (course-application-documents)
            '(bucket_id = ''course-application-documents''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM course_applications WHERE (user_id = auth.uid())))',
            -- Historical Variant 2: parenthesized CASE (course-applications)
            '(bucket_id = ''course-applications''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-applications''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
            -- Historical Variant 2: parenthesized CASE (course-application-documents)
            '(bucket_id = ''course-application-documents''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
            '(bucket_id = ''course-application-documents''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))'
        ) THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_student_read_policy" does not match any approved historical canonical definition (qual: %). Manual inspection required.', rec.qual
                USING ERRCODE = 'P0001';
        END IF;

        v_has_student_read := true;
    END IF;

    -- 1.5 Exact Historical Verification for "course_docs_admin_read_policy"
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_admin_read_policy';

    IF FOUND THEN
        IF rec.cmd IS DISTINCT FROM 'SELECT' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" has cmd "%" (expected SELECT). Manual inspection required.', rec.cmd
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.permissive IS DISTINCT FROM 'PERMISSIVE' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" has permissive "%" (expected PERMISSIVE). Manual inspection required.', rec.permissive
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.roles IS DISTINCT FROM ARRAY['authenticated']::name[] THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" has roles % (expected {authenticated}). Manual inspection required.', rec.roles
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.with_check IS NOT NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" has unexpected WITH CHECK expression. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        IF rec.qual IS NULL THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" has NULL qual. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Strict rejection of OR disjunctions
        IF rec.qual ~* '\mOR\M' THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" contains unsafe OR disjunction. Manual inspection required.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Exact match against approved historical canonical deparsed definitions
        -- Normalize qual: unwrap genuine outer enclosing parentheses without stripping internal expression structure
        v_norm_qual := btrim(rec.qual);
        WHILE v_norm_qual LIKE '(%)' LOOP
            v_depth := 0;
            v_encloses := true;
            v_len := length(v_norm_qual);
            FOR v_i IN 1 .. (v_len - 1) LOOP
                v_ch := substr(v_norm_qual, v_i, 1);
                IF v_ch = '(' THEN
                    v_depth := v_depth + 1;
                ELSIF v_ch = ')' THEN
                    v_depth := v_depth - 1;
                END IF;
                IF v_depth = 0 THEN
                    v_encloses := false;
                    EXIT;
                END IF;
            END LOOP;
            IF v_encloses THEN
                v_norm_qual := btrim(substr(v_norm_qual, 2, v_len - 2));
            ELSE
                EXIT;
            END IF;
        END LOOP;
        v_norm_qual := regexp_replace(v_norm_qual, '\s+', ' ', 'g');
        IF v_norm_qual NOT IN (
            '(bucket_id = ''course-applications''::text) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ANY (ARRAY[''admin''::text, ''super_admin''::text]))',
            '(bucket_id = ''course-applications''::text) AND ( (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ANY (ARRAY[''admin''::text, ''super_admin''::text])))',
            '(bucket_id = ''course-application-documents''::text) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ANY (ARRAY[''admin''::text, ''super_admin''::text]))',
            '(bucket_id = ''course-application-documents''::text) AND ( (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ANY (ARRAY[''admin''::text, ''super_admin''::text])))',
            '(bucket_id = ''course-applications''::text) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) IN (''admin''::text, ''super_admin''::text))',
            '(bucket_id = ''course-applications''::text) AND ( (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) IN (''admin''::text, ''super_admin''::text)))',
            '(bucket_id = ''course-application-documents''::text) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) IN (''admin''::text, ''super_admin''::text))',
            '(bucket_id = ''course-application-documents''::text) AND ( (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) IN (''admin''::text, ''super_admin''::text)))'
        ) THEN
            RAISE EXCEPTION 'Safety Violation: Existing policy "course_docs_admin_read_policy" does not match any approved historical canonical definition (qual: %). Manual inspection required.', rec.qual
                USING ERRCODE = 'P0001';
        END IF;

        v_has_admin_read := true;
    END IF;

    -- 1.6 Strict Fail-Closed Handling for "course_docs_client_insert_deny"
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_client_insert_deny';

    IF FOUND THEN
        -- No approved CREATE POLICY statement exists in repository history for this policy name.
        -- Per safety specification, any existing policy with this name cannot be proven to be an approved
        -- legacy CMS policy. Abort to prevent dropping an unknown policy.
        RAISE EXCEPTION 'Safety Violation: Policy "course_docs_client_insert_deny" exists on storage.objects (cmd=%, roles=%, with_check=%), but has no approved historical creation definition in repository migrations. Per safety protocol, this policy cannot be proven safe and will NOT be dropped automatically. Manual inspection required.',
            rec.cmd, rec.roles, rec.with_check
            USING ERRCODE = 'P0001';
    ELSE
        RAISE NOTICE 'Policy "course_docs_client_insert_deny" is absent on storage.objects (expected state); skipping drop.';
    END IF;

    -- 1.7 Safe Drop: Drop ONLY the strictly verified legacy policies
    IF v_has_service_role_all THEN
        EXECUTE 'DROP POLICY "course_docs_service_role_all" ON storage.objects';
        v_drop_count := v_drop_count + 1;
        RAISE NOTICE 'Dropped verified legacy policy "course_docs_service_role_all" on storage.objects.';
    ELSE
        RAISE NOTICE 'Policy "course_docs_service_role_all" is absent on storage.objects; skipping drop.';
    END IF;

    IF v_has_student_read THEN
        EXECUTE 'DROP POLICY "course_docs_student_read_policy" ON storage.objects';
        v_drop_count := v_drop_count + 1;
        RAISE NOTICE 'Dropped verified legacy policy "course_docs_student_read_policy" on storage.objects.';
    ELSE
        RAISE NOTICE 'Policy "course_docs_student_read_policy" is absent on storage.objects; skipping drop.';
    END IF;

    IF v_has_admin_read THEN
        EXECUTE 'DROP POLICY "course_docs_admin_read_policy" ON storage.objects';
        v_drop_count := v_drop_count + 1;
        RAISE NOTICE 'Dropped verified legacy policy "course_docs_admin_read_policy" on storage.objects.';
    ELSE
        RAISE NOTICE 'Policy "course_docs_admin_read_policy" is absent on storage.objects; skipping drop.';
    END IF;

    RAISE NOTICE 'Pre-drop verification complete: % verified legacy policies safely dropped.', v_drop_count;
END $$;

-- ====================================================================
-- Step 2: Authoritative Policy Recreation
-- ====================================================================

-- Policy 1: Service Role Full Access (used by server functions for signed URLs and backend management)
CREATE POLICY "course_docs_service_role_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'course-applications')
WITH CHECK (bucket_id = 'course-applications');

-- Policy 2: Authenticated Student Read Access to Own Application Documents
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

-- Policy 3: Administrator Read Access to All Application Documents
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

-- ====================================================================
-- Step 3: Post-DDL Assertion - Verify Bucket Configuration & Catalog Isolation
-- ====================================================================
DO $$
DECLARE
    v_bucket_count integer;
    rec RECORD;
    v_norm_qual text;
    v_depth integer;
    v_encloses boolean;
    v_len integer;
    v_i integer;
    v_ch text;
BEGIN
    -- 3.1 Verify bucket configuration (exact private status, 10MB limit, exact 3 MIME types)
    SELECT count(*) INTO v_bucket_count
    FROM storage.buckets
    WHERE id = 'course-applications'
      AND public = false
      AND file_size_limit = 10485760
      AND allowed_mime_types IS NOT NULL
      AND cardinality(allowed_mime_types) = 3
      AND allowed_mime_types @> ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
      AND allowed_mime_types <@ ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[];

    IF v_bucket_count <> 1 THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Storage bucket "course-applications" does not match required private configuration (public=false, limit=10MB, mime=[pdf,jpeg,png]).'
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3.2 Verify exact definition of "course_docs_service_role_all" (NULL-safe independent assertions)
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_service_role_all';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" does not exist on storage.objects.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.cmd IS DISTINCT FROM 'ALL' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" has cmd "%" (expected ALL).', rec.cmd
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.permissive IS DISTINCT FROM 'PERMISSIVE' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" has permissive "%" (expected PERMISSIVE).', rec.permissive
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.roles IS DISTINCT FROM ARRAY['service_role']::name[] THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" has roles % (expected {service_role}).', rec.roles
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.qual IS NULL THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" has NULL qual predicate.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.with_check IS NULL THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" has NULL with_check predicate.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF btrim(rec.qual, '() ') IS DISTINCT FROM 'bucket_id = ''course-applications''::text' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" qual "%" does not match required bucket restriction.', rec.qual
            USING ERRCODE = 'check_violation';
    END IF;

    IF btrim(rec.with_check, '() ') IS DISTINCT FROM 'bucket_id = ''course-applications''::text' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_service_role_all" with_check "%" does not match required bucket restriction.', rec.with_check
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3.3 Verify exact definition of "course_docs_student_read_policy"
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_student_read_policy';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" does not exist on storage.objects.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.cmd IS DISTINCT FROM 'SELECT' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" has cmd "%" (expected SELECT).', rec.cmd
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.permissive IS DISTINCT FROM 'PERMISSIVE' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" has permissive "%" (expected PERMISSIVE).', rec.permissive
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.roles IS DISTINCT FROM ARRAY['authenticated']::name[] THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" has roles % (expected {authenticated}).', rec.roles
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.with_check IS NOT NULL THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" has unexpected non-NULL with_check.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.qual IS NULL THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" has NULL qual predicate.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.qual ~* '\mOR\M' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" contains unexpected OR disjunction.'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Normalize qual: unwrap genuine outer enclosing parentheses without stripping internal expression structure
    v_norm_qual := btrim(rec.qual);
    WHILE v_norm_qual LIKE '(%)' LOOP
        v_depth := 0;
        v_encloses := true;
        v_len := length(v_norm_qual);
        FOR v_i IN 1 .. (v_len - 1) LOOP
            v_ch := substr(v_norm_qual, v_i, 1);
            IF v_ch = '(' THEN
                v_depth := v_depth + 1;
            ELSIF v_ch = ')' THEN
                v_depth := v_depth - 1;
            END IF;
            IF v_depth = 0 THEN
                v_encloses := false;
                EXIT;
            END IF;
        END LOOP;
        IF v_encloses THEN
            v_norm_qual := btrim(substr(v_norm_qual, 2, v_len - 2));
        ELSE
            EXIT;
        END IF;
    END LOOP;
    v_norm_qual := regexp_replace(v_norm_qual, '\s+', ' ', 'g');
    IF v_norm_qual NOT IN (
        -- Canonical deparse (with '( CASE ... THEN ((storage.foldername(name))[1])::uuid')
        '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND ( CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM course_applications WHERE (user_id = auth.uid())))',
        -- Canonical deparse without leading space
        '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND (CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN ((storage.foldername(name))[1])::uuid ELSE NULL::uuid END IN ( SELECT id FROM course_applications WHERE (user_id = auth.uid())))',
        -- Parenthesized CASE variants
        '(bucket_id = ''course-applications''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT course_applications.id FROM course_applications WHERE (course_applications.user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT id FROM public.course_applications WHERE (user_id = auth.uid())))',
        '(bucket_id = ''course-applications''::text) AND ((CASE WHEN ((storage.foldername(name))[1] ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''::text) THEN (((storage.foldername(name))[1])::uuid) ELSE NULL::uuid END) IN ( SELECT course_applications.id FROM public.course_applications WHERE (course_applications.user_id = auth.uid())))'
    ) THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_student_read_policy" qual does not match canonical definition: %', rec.qual
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3.4 Verify exact definition of "course_docs_admin_read_policy"
    SELECT * INTO rec
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'course_docs_admin_read_policy';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" does not exist on storage.objects.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.cmd IS DISTINCT FROM 'SELECT' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" has cmd "%" (expected SELECT).', rec.cmd
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.permissive IS DISTINCT FROM 'PERMISSIVE' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" has permissive "%" (expected PERMISSIVE).', rec.permissive
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.roles IS DISTINCT FROM ARRAY['authenticated']::name[] THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" has roles % (expected {authenticated}).', rec.roles
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.with_check IS NOT NULL THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" has unexpected non-NULL with_check.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.qual IS NULL THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" has NULL qual predicate.'
            USING ERRCODE = 'check_violation';
    END IF;

    IF rec.qual ~* '\mOR\M' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" contains unexpected OR disjunction.'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Normalize qual: unwrap genuine outer enclosing parentheses without stripping internal expression structure
    v_norm_qual := btrim(rec.qual);
    WHILE v_norm_qual LIKE '(%)' LOOP
        v_depth := 0;
        v_encloses := true;
        v_len := length(v_norm_qual);
        FOR v_i IN 1 .. (v_len - 1) LOOP
            v_ch := substr(v_norm_qual, v_i, 1);
            IF v_ch = '(' THEN
                v_depth := v_depth + 1;
            ELSIF v_ch = ')' THEN
                v_depth := v_depth - 1;
            END IF;
            IF v_depth = 0 THEN
                v_encloses := false;
                EXIT;
            END IF;
        END LOOP;
        IF v_encloses THEN
            v_norm_qual := btrim(substr(v_norm_qual, 2, v_len - 2));
        ELSE
            EXIT;
        END IF;
    END LOOP;
    v_norm_qual := regexp_replace(v_norm_qual, '\s+', ' ', 'g');
    IF v_norm_qual NOT IN (
        '(bucket_id = ''course-applications''::text) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ANY (ARRAY[''admin''::text, ''super_admin''::text]))',
        '(bucket_id = ''course-applications''::text) AND ( (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) = ANY (ARRAY[''admin''::text, ''super_admin''::text])))',
        '(bucket_id = ''course-applications''::text) AND (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) IN (''admin''::text, ''super_admin''::text))',
        '(bucket_id = ''course-applications''::text) AND ( (((auth.jwt() -> ''app_metadata''::text) ->> ''role''::text) IN (''admin''::text, ''super_admin''::text)))'
    ) THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Policy "course_docs_admin_read_policy" qual does not match canonical definition: %', rec.qual
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3.5 Assert NO CMS client-write policies exist on storage.objects
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname LIKE 'course_%'
          AND cmd IN ('INSERT', 'ALL', 'UPDATE')
          AND NOT ('service_role' = ANY(roles) AND cardinality(roles) = 1)
    ) THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Unexpected CMS client write policy exists on storage.objects.'
            USING ERRCODE = 'check_violation';
    END IF;

    -- 3.6 Full Catalog Audit: Re-verify that NO other policy on storage.objects can grant access to 'course-applications'
    -- Strictly rejects negations (NOT, <>), disjunctions (OR), IS NOT NULL, or unproven expressions
    FOR rec IN 
        SELECT policyname, permissive, roles, cmd, qual, with_check
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND policyname NOT IN (
              'course_docs_service_role_all',
              'course_docs_student_read_policy',
              'course_docs_admin_read_policy'
          )
    LOOP
        IF COALESCE(rec.qual, '') ~* 'course-application(s|-documents)'
           OR COALESCE(rec.with_check, '') ~* 'course-application(s|-documents)'
        THEN
            RAISE EXCEPTION 'Post-DDL Assertion Failed: Unrelated policy "%" on storage.objects references course applications bucket (qual: %, with_check: %). Isolation violated.',
                rec.policyname, rec.qual, rec.with_check
                USING ERRCODE = 'check_violation';
        END IF;

        IF rec.permissive = 'PERMISSIVE' THEN
            -- Check READ / ALL access (qual must be proven safe)
            IF rec.cmd IN ('ALL', 'SELECT') THEN
                IF rec.qual IS NULL
                   OR rec.qual ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.qual ~ '[!<>~]'
                   OR rec.qual ~* '\mIS\s+NOT\M'
                   OR rec.qual ~* '\mIS\s+NULL\M'
                   OR rec.qual ~* 'course-application'
                   OR NOT (
                       rec.qual ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.qual ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Post-DDL Assertion Failed: Unrelated permissive policy "%" on storage.objects grants % access without proven exclusion of course-applications (qual: %). Isolation violated.',
                        rec.policyname, rec.cmd, rec.qual
                        USING ERRCODE = 'check_violation';
                END IF;
            END IF;

            -- Check WRITE / INSERT access (with_check must be proven safe)
            IF rec.cmd IN ('ALL', 'INSERT') THEN
                IF rec.with_check IS NULL
                   OR rec.with_check ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.with_check ~ '[!<>~]'
                   OR rec.with_check ~* '\mIS\s+NOT\M'
                   OR rec.with_check ~* '\mIS\s+NULL\M'
                   OR rec.with_check ~* 'course-application'
                   OR NOT (
                       rec.with_check ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.with_check ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Post-DDL Assertion Failed: Unrelated permissive policy "%" on storage.objects grants % access without proven exclusion of course-applications (with_check: %). Isolation violated.',
                        rec.policyname, rec.cmd, rec.with_check
                        USING ERRCODE = 'check_violation';
                END IF;
            END IF;

            -- Check UPDATE access (both qual and with_check must be proven safe)
            IF rec.cmd = 'UPDATE' THEN
                IF rec.qual IS NULL
                   OR rec.qual ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.qual ~ '[!<>~]'
                   OR rec.qual ~* '\mIS\s+NOT\M'
                   OR rec.qual ~* '\mIS\s+NULL\M'
                   OR rec.qual ~* 'course-application'
                   OR NOT (
                       rec.qual ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.qual ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                   OR rec.with_check IS NULL
                   OR rec.with_check ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.with_check ~ '[!<>~]'
                   OR rec.with_check ~* '\mIS\s+NOT\M'
                   OR rec.with_check ~* '\mIS\s+NULL\M'
                   OR rec.with_check ~* 'course-application'
                   OR NOT (
                       rec.with_check ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.with_check ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Post-DDL Assertion Failed: Unrelated permissive policy "%" on storage.objects grants UPDATE access without proven exclusion of course-applications. Isolation violated.',
                        rec.policyname
                        USING ERRCODE = 'check_violation';
                END IF;
            END IF;

            -- Check DELETE access (qual must be proven safe)
            IF rec.cmd = 'DELETE' THEN
                IF rec.qual IS NULL
                   OR rec.qual ~* '\m(NOT|OR|IN|ANY|SOME|ALL|EXISTS|CASE|NULLIF|COALESCE)\M'
                   OR rec.qual ~ '[!<>~]'
                   OR rec.qual ~* '\mIS\s+NOT\M'
                   OR rec.qual ~* '\mIS\s+NULL\M'
                   OR rec.qual ~* 'course-application'
                   OR NOT (
                       rec.qual ~* '^\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*$'
                       OR rec.qual ~* '^\(*\(*bucket_id\s*=\s*''[a-zA-Z0-9_\-]+''::text\)*\s+AND\s+(\(?public\.)?is_admin\(\)\)*$'
                   )
                THEN
                    RAISE EXCEPTION 'Post-DDL Assertion Failed: Unrelated permissive policy "%" on storage.objects grants DELETE access without proven exclusion of course-applications. Isolation violated.',
                        rec.policyname
                        USING ERRCODE = 'check_violation';
                END IF;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE 'Post-DDL Assertion Passed: Storage bucket, all 3 CMS RLS policies, and complete storage.objects catalog isolation verified.';
END $$;

COMMIT;

-- ====================================================================
-- VERIFICATION QUERIES (FOR MANUAL RE-CHECK IF NEEDED)
-- ====================================================================
-- SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'course-applications';
-- SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies 
-- WHERE schemaname = 'storage' AND tablename = 'objects';
