-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM
-- STAGING READ-ONLY VERIFICATION SCRIPT: VERSION 1.3
-- Identity Conflict Quarantine & Administrative Reconciliation Audit
-- ====================================================================
-- System: PathFinder Admissions & Enrollment
-- Target: Supabase Staging Database (Project: neexbpcvedcfwjxpgede)
-- Read-Only: Zero database mutations, zero side effects. Safe to run repeatedly.
-- ====================================================================

-- --------------------------------------------------------------------
-- SECTION 1: COLUMN SCHEMA & NOT NULL CONSTRAINTS
-- --------------------------------------------------------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE
        WHEN column_name = 'is_identity_conflict'
         AND data_type = 'boolean'
         AND is_nullable = 'NO'
         AND column_default LIKE '%false%'
        THEN 'PASS'
        WHEN column_name = 'respondent_email'
         AND data_type = 'text'
         AND is_nullable = 'YES'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'course_applications'
  AND column_name IN ('is_identity_conflict', 'respondent_email')
ORDER BY column_name;

-- --------------------------------------------------------------------
-- SECTION 2: PARTIAL INDEX VALIDATION
-- --------------------------------------------------------------------
SELECT
    i.indexname AS index_name,
    x.indisvalid AS is_valid,
    x.indisready AS is_ready,
    pg_get_indexdef(x.indexrelid) AS index_definition,
    CASE
        WHEN x.indisvalid = true
         AND x.indisready = true
         AND pg_get_expr(x.indpred, x.indrelid) LIKE '%is_identity_conflict = true%'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_catalog.pg_indexes i
JOIN pg_catalog.pg_class c ON c.relname = i.indexname
JOIN pg_catalog.pg_index x ON x.indexrelid = c.oid
WHERE i.schemaname = 'public'
  AND i.tablename = 'course_applications'
  AND i.indexname = 'idx_course_applications_identity_conflict';

-- --------------------------------------------------------------------
-- SECTION 3: VIEW CANDIDATE_COURSE_APPLICATIONS & SECURITY INVOKER
-- --------------------------------------------------------------------
SELECT
    c.relname AS view_name,
    c.reloptions AS view_options,
    (
        c.reloptions IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM unnest(c.reloptions) opt
            WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
        )
    ) AS is_security_invoker,
    has_table_privilege('authenticated', 'public.candidate_course_applications', 'SELECT') AS authenticated_has_select,
    CASE
        WHEN c.reloptions IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM unnest(c.reloptions) opt
             WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
         )
         AND has_table_privilege('authenticated', 'public.candidate_course_applications', 'SELECT') = true
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'candidate_course_applications';

-- View Column Sequence Inspection (Complete 25-Column Verification)
SELECT
    ordinal_position,
    column_name,
    data_type,
    CASE ordinal_position
        WHEN 1 THEN 'id'
        WHEN 2 THEN 'application_number'
        WHEN 3 THEN 'user_id'
        WHEN 4 THEN 'course_id'
        WHEN 5 THEN 'student_name'
        WHEN 6 THEN 'student_email'
        WHEN 7 THEN 'student_phone'
        WHEN 8 THEN 'academic_background'
        WHEN 9 THEN 'statement_of_purpose'
        WHEN 10 THEN 'status'
        WHEN 11 THEN 'payment_status'
        WHEN 12 THEN 'payment_amount_inr'
        WHEN 13 THEN 'documents_status'
        WHEN 14 THEN 'source'
        WHEN 15 THEN 'external_submission_id'
        WHEN 16 THEN 'rejection_reason'
        WHEN 17 THEN 'resubmission_notes'
        WHEN 18 THEN 'submitted_at'
        WHEN 19 THEN 'approved_at'
        WHEN 20 THEN 'enrolled_at'
        WHEN 21 THEN 'rejected_at'
        WHEN 22 THEN 'created_at'
        WHEN 23 THEN 'updated_at'
        WHEN 24 THEN 'is_identity_conflict'
        WHEN 25 THEN 'respondent_email'
    END AS expected_column_name,
    CASE
        WHEN column_name::text = CASE ordinal_position
            WHEN 1 THEN 'id'
            WHEN 2 THEN 'application_number'
            WHEN 3 THEN 'user_id'
            WHEN 4 THEN 'course_id'
            WHEN 5 THEN 'student_name'
            WHEN 6 THEN 'student_email'
            WHEN 7 THEN 'student_phone'
            WHEN 8 THEN 'academic_background'
            WHEN 9 THEN 'statement_of_purpose'
            WHEN 10 THEN 'status'
            WHEN 11 THEN 'payment_status'
            WHEN 12 THEN 'payment_amount_inr'
            WHEN 13 THEN 'documents_status'
            WHEN 14 THEN 'source'
            WHEN 15 THEN 'external_submission_id'
            WHEN 16 THEN 'rejection_reason'
            WHEN 17 THEN 'resubmission_notes'
            WHEN 18 THEN 'submitted_at'
            WHEN 19 THEN 'approved_at'
            WHEN 20 THEN 'enrolled_at'
            WHEN 21 THEN 'rejected_at'
            WHEN 22 THEN 'created_at'
            WHEN 23 THEN 'updated_at'
            WHEN 24 THEN 'is_identity_conflict'
            WHEN 25 THEN 'respondent_email'
        END THEN 'MATCH'
        ELSE 'MISMATCH'
    END AS sequence_check
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'candidate_course_applications'
ORDER BY ordinal_position;

-- Full 25-Column View Sequence Array Equality Diagnostic
SELECT
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'candidate_course_applications') AS actual_column_count,
    25 AS expected_column_count,
    CASE
        WHEN (
            SELECT array_agg(column_name::text ORDER BY ordinal_position)
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'candidate_course_applications'
        ) = ARRAY[
            'id',
            'application_number',
            'user_id',
            'course_id',
            'student_name',
            'student_email',
            'student_phone',
            'academic_background',
            'statement_of_purpose',
            'status',
            'payment_status',
            'payment_amount_inr',
            'documents_status',
            'source',
            'external_submission_id',
            'rejection_reason',
            'resubmission_notes',
            'submitted_at',
            'approved_at',
            'enrolled_at',
            'rejected_at',
            'created_at',
            'updated_at',
            'is_identity_conflict',
            'respondent_email'
        ]::text[]
        THEN 'PASS'
        ELSE 'FAIL'
    END AS full_25_column_sequence_status;

-- --------------------------------------------------------------------
-- SECTION 4: RPC SECURITY DEFINER & SEARCH_PATH INSPECTION
-- --------------------------------------------------------------------
SELECT
    p.proname AS procedure_name,
    p.pronargs AS argument_count,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_signature,
    p.prosecdef AS is_security_definer,
    p.proconfig AS configuration_settings,
    CASE
        WHEN p.prosecdef = true
         AND (
             'search_path=""' = ANY(p.proconfig)
             OR 'search_path=' = ANY(p.proconfig)
         )
         AND NOT EXISTS (
             SELECT 1 FROM unnest(p.proconfig) cfg
             WHERE cfg LIKE 'search_path=%'
               AND cfg NOT IN ('search_path=', 'search_path=""')
         )
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
      (
          p.proname = 'rpc_admin_approve_google_forms_application'
          AND p.pronargs = 4
          AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
              'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
              'uuid, uuid, text, boolean'
          )
      )
      OR (
          p.proname = 'rpc_admin_transition_application_status'
          AND p.pronargs = 5
          AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
              'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
              'uuid, text, uuid, text, text'
          )
      )
      OR (
          p.proname = 'rpc_admin_reconcile_identity_conflict'
          AND p.pronargs = 4
          AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
              'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
              'uuid, uuid, text, text'
          )
      )
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- SECTION 5: RPC ROLE PERMISSIONS INSPECTION
-- --------------------------------------------------------------------
SELECT
    p.proname AS procedure_name,
    p.pronargs AS argument_count,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_signature,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
    COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) AS authenticated_execute,
    COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) AS anon_execute,
    NOT EXISTS (
        SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
        WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    ) AS public_execute_revoked,
    p.proacl AS acl_entries,
    CASE
        WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') = true
         AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
         AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
         AND p.proacl IS NOT NULL
         AND NOT EXISTS (
             SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
             WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
         )
         AND NOT EXISTS (
             SELECT 1 FROM unnest(p.proacl) a
             WHERE split_part(a::text, '=', 1) = ''
               AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
         )
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
      (
          p.proname = 'rpc_admin_approve_google_forms_application'
          AND p.pronargs = 4
          AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
              'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
              'uuid, uuid, text, boolean'
          )
      )
      OR (
          p.proname = 'rpc_admin_transition_application_status'
          AND p.pronargs = 5
          AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
              'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
              'uuid, text, uuid, text, text'
          )
      )
      OR (
          p.proname = 'rpc_admin_reconcile_identity_conflict'
          AND p.pronargs = 4
          AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
              'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
              'uuid, uuid, text, text'
          )
      )
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- SECTION 6: UNIFIED 12-POINT POST-MIGRATION SCORECARD MATRIX
-- --------------------------------------------------------------------
WITH evaluations AS (
    -- 1. is_identity_conflict schema with NOT NULL and default false
    SELECT
        1 AS check_id,
        'V1.3 Schema' AS category,
        'Column is_identity_conflict on public.course_applications (BOOLEAN, NOT NULL, default false)' AS check_name,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'is_identity_conflict'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'is_identity_conflict'
                  AND data_type = 'boolean'
                  AND is_nullable = 'NO'
                  AND column_default LIKE '%false%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Flag for Google account vs entered email mismatch; non-null boolean with default false' AS details
    UNION ALL

    -- 2. respondent_email schema
    SELECT
        2,
        'V1.3 Schema',
        'Column respondent_email on public.course_applications (TEXT, nullable)',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'respondent_email'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'respondent_email'
                  AND data_type = 'text'
                  AND is_nullable = 'YES'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Stores authenticated Google account from Google Forms for cross-referencing'
    UNION ALL

    -- 3. idx_course_applications_identity_conflict partial index
    SELECT
        3,
        'V1.3 Index',
        'Partial index idx_course_applications_identity_conflict active on quarantined rows',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_identity_conflict'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_identity_conflict'
                  AND ix.indisvalid = true
                  AND ix.indisready = true
                  AND pg_get_expr(ix.indpred, ix.indrelid) LIKE '%is_identity_conflict = true%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Partial index optimizes queue retrieval for quarantined applications'
    UNION ALL

    -- 4. candidate_course_applications view includes columns and enforces security_invoker
    SELECT
        4,
        'V1.3 View',
        'View candidate_course_applications preserves V1.1 column sequence, appends conflict columns with security_invoker = true',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
            ) THEN 'NOT FOUND'
            WHEN (
                SELECT array_agg(column_name::text ORDER BY ordinal_position)
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications'
            ) = ARRAY[
                'id',
                'application_number',
                'user_id',
                'course_id',
                'student_name',
                'student_email',
                'student_phone',
                'academic_background',
                'statement_of_purpose',
                'status',
                'payment_status',
                'payment_amount_inr',
                'documents_status',
                'source',
                'external_submission_id',
                'rejection_reason',
                'resubmission_notes',
                'submitted_at',
                'approved_at',
                'enrolled_at',
                'rejected_at',
                'created_at',
                'updated_at',
                'is_identity_conflict',
                'respondent_email'
            ]::text[]
            AND (
                SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications'
            ) = 25
            AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'claim_token_hash'
            ) AND EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
                  AND c.reloptions IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM unnest(c.reloptions) opt
                      WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
                  )
            ) AND has_table_privilege('authenticated', 'public.candidate_course_applications', 'SELECT') = true
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Exact 25-column sequence match (positions 1-23 from V1.1 + conflict columns at pos 24-25), excludes claim_token_hash, enforces security_invoker'
    UNION ALL

    -- 5. rpc_admin_reconcile_identity_conflict SECDEF & search_path
    SELECT
        5,
        'V1.3 RPC Definition',
        'RPC rpc_admin_reconcile_identity_conflict exists with exact 4-parameter signature, SECDEF & empty search_path',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
                  AND p.prosecdef = true
                  AND p.proconfig IS NOT NULL
                  AND (
                      'search_path=' = ANY(p.proconfig)
                      OR 'search_path=""' = ANY(p.proconfig)
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proconfig) cfg
                      WHERE cfg LIKE 'search_path=%'
                        AND cfg NOT IN ('search_path=', 'search_path=""')
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Exact signature: (UUID, UUID, TEXT, TEXT) with SECURITY DEFINER and strictly empty search_path'
    UNION ALL

    -- 6. rpc_admin_reconcile_identity_conflict execution permissions
    SELECT
        6,
        'V1.3 RPC Permissions',
        'RPC rpc_admin_reconcile_identity_conflict execution restricted to service_role',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'service_role has EXECUTE; authenticated, anon, and PUBLIC (grantee=0 via aclexplode) are explicitly revoked'
    UNION ALL

    -- 7. rpc_admin_approve_google_forms_application permissions
    SELECT
        7,
        'V1.3 RPC Permissions',
        'RPC rpc_admin_approve_google_forms_application execution restricted to service_role',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                      'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                      'uuid, uuid, text, boolean'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'service_role has EXECUTE; authenticated, anon, and PUBLIC (grantee=0 via aclexplode) are explicitly revoked'
    UNION ALL

    -- 8. rpc_admin_transition_application_status permissions
    SELECT
        8,
        'V1.3 RPC Permissions',
        'RPC rpc_admin_transition_application_status execution restricted to service_role',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'service_role has EXECUTE; authenticated, anon, and PUBLIC (grantee=0 via aclexplode) are explicitly revoked'
    UNION ALL

    -- 9. Guard: rpc_admin_transition_application_status blocks generic approval of Google Forms (DEC-03)
    SELECT
        9,
        'V1.3 Security Guard',
        'RPC rpc_admin_transition_application_status strictly blocks generic approval for google_forms',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%v_app.source = ''google_forms''%'
                  AND pg_get_functiondef(p.oid) LIKE '%cannot be approved via generic transition%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Preserves DEC-03: Google Forms applications cannot be approved via generic transition; requires dedicated approval procedure'
    UNION ALL

    -- 10. Guard: rpc_admin_transition_application_status blocks approved and enrolled on quarantine
    SELECT
        10,
        'V1.3 Security Guard',
        'RPC rpc_admin_transition_application_status blocks approved and enrolled on active identity conflict',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%is_identity_conflict IS TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%Application is quarantined due to identity conflict%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Database-level guard prevents transition to approved or enrolled while identity conflict is active'
    UNION ALL

    -- 11. Guard: rpc_admin_approve_google_forms_application blocks approval on quarantine
    SELECT
        11,
        'V1.3 Security Guard',
        'RPC rpc_admin_approve_google_forms_application blocks approval on active identity conflict',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                      'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                      'uuid, uuid, text, boolean'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%is_identity_conflict IS TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%Application is quarantined due to an unresolved identity conflict%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Database-level guard prevents Google Forms approval while identity conflict is active'
    UNION ALL

    -- 12. Guard: rpc_admin_reconcile_identity_conflict restricts scope to google_forms with active conflict
    SELECT
        12,
        'V1.3 Security Guard',
        'RPC rpc_admin_reconcile_identity_conflict only reconciles google_forms applications with active conflict',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%v_app.source != ''google_forms''%'
                  AND pg_get_functiondef(p.oid) LIKE '%reconciliation is only permitted for google_forms applications%'
                  AND pg_get_functiondef(p.oid) LIKE '%is_identity_conflict IS NOT TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%Application does not have an unresolved identity conflict%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Restricts reconciliation strictly to google_forms applications currently quarantined with an unresolved conflict'
)
SELECT
    check_id,
    category,
    check_name,
    status,
    details
FROM evaluations
ORDER BY check_id;

-- --------------------------------------------------------------------
-- SECTION 7: SUMMARY AGGREGATION & OVERALL VERDICT
-- --------------------------------------------------------------------
WITH evaluations AS (
    SELECT
        CASE
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'is_identity_conflict'
                  AND data_type = 'boolean'
                  AND is_nullable = 'NO'
                  AND column_default LIKE '%false%'
            ) THEN 1 ELSE 0
        END AS c1,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'respondent_email'
                  AND data_type = 'text'
                  AND is_nullable = 'YES'
            ) THEN 1 ELSE 0
        END AS c2,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_identity_conflict'
                  AND ix.indisvalid = true
                  AND ix.indisready = true
                  AND pg_get_expr(ix.indpred, ix.indrelid) LIKE '%is_identity_conflict = true%'
            ) THEN 1 ELSE 0
        END AS c3,
        CASE
            WHEN (
                SELECT array_agg(column_name::text ORDER BY ordinal_position)
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications'
            ) = ARRAY[
                'id',
                'application_number',
                'user_id',
                'course_id',
                'student_name',
                'student_email',
                'student_phone',
                'academic_background',
                'statement_of_purpose',
                'status',
                'payment_status',
                'payment_amount_inr',
                'documents_status',
                'source',
                'external_submission_id',
                'rejection_reason',
                'resubmission_notes',
                'submitted_at',
                'approved_at',
                'enrolled_at',
                'rejected_at',
                'created_at',
                'updated_at',
                'is_identity_conflict',
                'respondent_email'
            ]::text[]
            AND (
                SELECT count(*) FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications'
            ) = 25
            AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'claim_token_hash'
            ) AND EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
                  AND c.reloptions IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM unnest(c.reloptions) opt
                      WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
                  )
            ) AND has_table_privilege('authenticated', 'public.candidate_course_applications', 'SELECT') = true
            THEN 1 ELSE 0
        END AS c4,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
                  AND p.prosecdef = true
                  AND p.proconfig IS NOT NULL
                  AND (
                      'search_path=' = ANY(p.proconfig)
                      OR 'search_path=""' = ANY(p.proconfig)
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proconfig) cfg
                      WHERE cfg LIKE 'search_path=%'
                        AND cfg NOT IN ('search_path=', 'search_path=""')
                  )
            ) THEN 1 ELSE 0
        END AS c5,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            ) THEN 1 ELSE 0
        END AS c6,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                      'uuid, uuid, text, boolean'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            ) THEN 1 ELSE 0
        END AS c7,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_catalog.aclexplode(p.proacl) acl
                      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            ) THEN 1 ELSE 0
        END AS c8,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%v_app.source = ''google_forms''%'
                  AND pg_get_functiondef(p.oid) LIKE '%cannot be approved via generic transition%'
            ) THEN 1 ELSE 0
        END AS c9,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                      'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%is_identity_conflict IS TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%Application is quarantined due to identity conflict%'
            ) THEN 1 ELSE 0
        END AS c10,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                      'uuid, uuid, text, boolean'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%is_identity_conflict IS TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%Application is quarantined due to an unresolved identity conflict%'
            ) THEN 1 ELSE 0
        END AS c11,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_reconcile_identity_conflict'
                  AND p.pronargs = 4
                  AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                      'p_application_id uuid, p_actor_id uuid, p_chosen_email text, p_notes text',
                      'uuid, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%v_app.source != ''google_forms''%'
                  AND pg_get_functiondef(p.oid) LIKE '%reconciliation is only permitted for google_forms applications%'
                  AND pg_get_functiondef(p.oid) LIKE '%is_identity_conflict IS NOT TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%Application does not have an unresolved identity conflict%'
            ) THEN 1 ELSE 0
        END AS c12
)
SELECT
    12 AS total_checks,
    (c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11 + c12) AS passed_checks,
    12 - (c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11 + c12) AS failed_checks,
    CASE
        WHEN (c1 + c2 + c3 + c4 + c5 + c6 + c7 + c8 + c9 + c10 + c11 + c12) = 12
        THEN 'ALL 12 CHECKS PASSED — MIGRATION V1.3 IDENTITY CONFLICT FULLY VERIFIED'
        ELSE 'CHECKS FAILED — REVIEW SCORECARD DETAILS'
    END AS overall_status
FROM evaluations;
