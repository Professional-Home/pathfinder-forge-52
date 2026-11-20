-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM
-- STAGING POST-MIGRATION READ-ONLY VERIFICATION SCRIPT (V1.1 & V1.2)
-- ====================================================================
-- Target Database: Staging Supabase (neexbpcvedcfwjxpgede)
-- Production Reference: knrmfpgwcdtpwcgkjrnk (STRICTLY OFF LIMITS)
-- Verification Scope:
--   - Migration V1.1: supabase_course_applications_v1.1_google_forms_webhook.sql
--   - Migration V1.2: supabase_course_applications_v1.2_google_forms_workflow.sql
--
-- Safety Notice:
--   - STRICTLY READ-ONLY (SELECT STATEMENTS ONLY).
--   - ZERO WRITES, MODIFICATIONS, DDL, DML, DO BLOCKS, OR STATE MUTATIONS.
--   - Safe to execute repeatedly in the Supabase Dashboard SQL Editor.
-- ====================================================================

-- --------------------------------------------------------------------
-- SECTION 1: GOOGLE FORMS INGESTION COLUMNS (V1.1 & V1.0 BASELINE)
-- Verifies external_submission_id, source, and documents_status on public.course_applications
-- --------------------------------------------------------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE
        WHEN column_name = 'external_submission_id'
             AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL
             THEN 'PASS'
        WHEN column_name = 'source'
             AND data_type = 'text' AND is_nullable = 'NO' AND column_default LIKE '''web''%'
             THEN 'PASS'
        WHEN column_name = 'documents_status'
             AND data_type = 'text' AND is_nullable = 'NO' AND column_default LIKE '''pending''%'
             THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'course_applications'
  AND column_name IN ('source', 'external_submission_id', 'documents_status')
ORDER BY column_name;

-- --------------------------------------------------------------------
-- SECTION 2: CONSTRAINTS & IDEMPOTENCY INDEXES (V1.1)
-- Verifies source CHECK constraint and unique partial index for webhook retries
-- --------------------------------------------------------------------
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition,
    CASE
        WHEN pg_get_constraintdef(c.oid) LIKE '%''web''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''google_forms''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''manual_import''%'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'course_applications'
  AND c.conname = 'chk_course_applications_source';

SELECT
    i.relname AS index_name,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    pg_get_expr(ix.indpred, ix.indrelid) AS partial_predicate,
    pg_get_indexdef(ix.indexrelid) AS index_definition,
    CASE
        WHEN i.relname = 'idx_course_applications_external_submission_id'
             AND ix.indisunique = true
             AND ix.indisvalid = true
             AND ix.indisready = true
             AND pg_get_expr(ix.indpred, ix.indrelid) LIKE '%external_submission_id IS NOT NULL%'
             AND pg_get_indexdef(ix.indexrelid) LIKE '%(external_submission_id)%'
             THEN 'PASS'
        WHEN i.relname = 'idx_course_applications_source'
             AND ix.indisvalid = true
             AND ix.indisready = true
             AND pg_get_indexdef(ix.indexrelid) LIKE '%(source)%'
             THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_index ix
JOIN pg_class i ON ix.indexrelid = i.oid
JOIN pg_class t ON ix.indrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'course_applications'
  AND i.relname IN ('idx_course_applications_external_submission_id', 'idx_course_applications_source')
ORDER BY i.relname;

-- --------------------------------------------------------------------
-- SECTION 3: CANDIDATE VIEW & SECURITY INVOKER MODE (V1.1)
-- Confirms candidate_course_applications exposes source and external_submission_id,
-- excludes claim_token_hash, and enforces security_invoker = true
-- --------------------------------------------------------------------
SELECT
    c.relname AS view_name,
    c.relkind AS relation_kind,
    (
        c.reloptions IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM unnest(c.reloptions) opt
            WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
        )
    ) AS is_security_invoker,
    c.reloptions AS view_options,
    CASE
        WHEN c.reloptions IS NOT NULL
         AND EXISTS (
             SELECT 1 FROM unnest(c.reloptions) opt
             WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
         )
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'candidate_course_applications';

SELECT
    column_name,
    data_type,
    CASE
        WHEN column_name = 'claim_token_hash' THEN 'VIOLATION — SENSITIVE COLUMN EXPOSED'
        WHEN column_name IN ('source', 'external_submission_id', 'documents_status') THEN 'PASS (REQUIRED COLUMN PRESENT)'
        ELSE 'INFO'
    END AS audit_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'candidate_course_applications'
  AND column_name IN ('source', 'external_submission_id', 'documents_status', 'claim_token_hash')
ORDER BY column_name;

-- --------------------------------------------------------------------
-- SECTION 4: DOCUMENTS STATUS CHECK CONSTRAINT (V1.2)
-- Confirms course_applications_documents_status_check permits all 7 lifecycle statuses
-- --------------------------------------------------------------------
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition,
    CASE
        WHEN pg_get_constraintdef(c.oid) LIKE '%''pending''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''under_review''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''verified''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''resubmission_requested''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''rejected''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''not_required''%'
         AND pg_get_constraintdef(c.oid) LIKE '%''waived''%'
        THEN 'PASS'
        ELSE 'FAIL'
    END AS specification_status
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'course_applications'
  AND c.conname = 'course_applications_documents_status_check';

-- --------------------------------------------------------------------
-- SECTION 5: RPC STORED PROCEDURES & SECURITY CONFIGURATION (V1.2)
-- Verifies rpc_admin_approve_google_forms_application & rpc_admin_transition_application_status
-- --------------------------------------------------------------------
SELECT
    p.proname AS procedure_name,
    p.pronargs AS argument_count,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_signature,
    p.prosecdef AS is_security_definer,
    p.proconfig AS config_settings,
    (
        p.proconfig IS NOT NULL
        AND (
            'search_path=' = ANY(p.proconfig)
            OR 'search_path=""' = ANY(p.proconfig)
        )
        AND NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) cfg
            WHERE cfg LIKE 'search_path=%'
              AND cfg NOT IN ('search_path=', 'search_path=""')
        )
    ) AS has_strictly_empty_search_path,
    CASE
        WHEN p.proname = 'rpc_admin_approve_google_forms_application'
             AND p.pronargs = 4
             AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                 'uuid, uuid, text, boolean'
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
             ) THEN 'PASS'
        WHEN p.proname = 'rpc_admin_transition_application_status'
             AND p.pronargs = 5
             AND pg_catalog.pg_get_function_identity_arguments(p.oid) IN (
                 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                 'uuid, text, uuid, text, text'
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
             ) THEN 'PASS'
        ELSE 'FAIL'
    END AS security_config_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_admin_transition_application_status',
      'rpc_admin_approve_google_forms_application'
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- SECTION 6: STORED PROCEDURE PRIVILEGE LOCKDOWN (V1.2)
-- Verifies execute privilege on exact target signatures: granted to service_role, revoked from public/anon/authenticated
-- --------------------------------------------------------------------
SELECT
    p.proname AS procedure_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_signature,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_has_execute,
    NOT COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) AS authenticated_is_revoked,
    NOT COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) AS anon_is_revoked,
    (
        p.proacl IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM unnest(p.proacl) a
            WHERE split_part(a::text, '=', 1) = ''
              AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
        )
    ) AS public_is_revoked,
    CASE
        WHEN p.proname = 'rpc_admin_approve_google_forms_application'
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
                 SELECT 1 FROM unnest(p.proacl) a
                 WHERE split_part(a::text, '=', 1) = ''
                   AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
             ) THEN 'PASS'
        WHEN p.proname = 'rpc_admin_transition_application_status'
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
                 SELECT 1 FROM unnest(p.proacl) a
                 WHERE split_part(a::text, '=', 1) = ''
                   AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
             ) THEN 'PASS'
        ELSE 'FAIL'
    END AS privilege_lockdown_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_admin_transition_application_status',
      'rpc_admin_approve_google_forms_application'
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- SECTION 7: NOTIFICATION OUTBOX SCHEMA CLEANLINESS (V1.2)
-- Confirms obsolete recipient_name is absent from public.notification_outbox
-- --------------------------------------------------------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    CASE
        WHEN column_name = 'recipient_name' THEN 'OBSOLETE / ERROR — SHOULD NOT EXIST'
        ELSE 'VALID'
    END AS column_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notification_outbox'
ORDER BY ordinal_position;

-- --------------------------------------------------------------------
-- SECTION 8: CORE APPLICATION TABLES & RLS PRESERVATION
-- Confirms all 5 core tables exist and retain active Row Level Security
-- --------------------------------------------------------------------
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    CASE
        WHEN c.relrowsecurity = true THEN 'PASS'
        ELSE 'FAIL'
    END AS rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
  AND c.relkind = 'r'
ORDER BY c.relname;

-- --------------------------------------------------------------------
-- SECTION 9: UNIFIED AUTOMATED POST-MIGRATION SCORECARD MATRIX
-- Evaluates all 18 critical verification criteria in a single aggregated report.
-- --------------------------------------------------------------------
WITH evaluations AS (
    -- 1. external_submission_id column
    SELECT
        1 AS check_id,
        'V1.1 Schema' AS category,
        'Column external_submission_id on public.course_applications (TEXT, nullable, default NULL)' AS check_name,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'external_submission_id'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'external_submission_id'
                  AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL
            ) THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Text column for Google Forms responseId idempotency; nullable with default NULL' AS details
    UNION ALL

    -- 2. source column
    SELECT
        2,
        'V1.1 Schema',
        'Column source on public.course_applications (TEXT, NOT NULL, default ''web'')',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'source'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'source'
                  AND data_type = 'text' AND is_nullable = 'NO' AND column_default LIKE '''web''%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Tracks application channel: web, google_forms, manual_import; non-null with default ''web'''
    UNION ALL

    -- 3. chk_course_applications_source constraint
    SELECT
        3,
        'V1.1 Constraint',
        'CHECK constraint chk_course_applications_source enforces valid channels',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'chk_course_applications_source'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'chk_course_applications_source'
                  AND pg_get_constraintdef(c.oid) LIKE '%''web''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''google_forms''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''manual_import''%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Enforces valid values: web, google_forms, manual_import'
    UNION ALL

    -- 4. idx_course_applications_external_submission_id partial unique index
    SELECT
        4,
        'V1.1 Idempotency',
        'Partial UNIQUE index idx_course_applications_external_submission_id active',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_external_submission_id'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_external_submission_id'
                  AND ix.indisunique = true
                  AND ix.indisvalid = true
                  AND ix.indisready = true
                  AND pg_get_expr(ix.indpred, ix.indrelid) LIKE '%external_submission_id IS NOT NULL%'
                  AND pg_get_indexdef(ix.indexrelid) LIKE '%(external_submission_id)%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Enforces responseId uniqueness for non-null submissions while permitting multiple web NULLs; valid & ready'
    UNION ALL

    -- 5. idx_course_applications_source index
    SELECT
        5,
        'V1.1 Index',
        'Index idx_course_applications_source active on public.course_applications',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_source'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_source'
                  AND ix.indisvalid = true
                  AND ix.indisready = true
                  AND pg_get_indexdef(ix.indexrelid) LIKE '%(source)%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Optimizes operational and administrative queries filtered by source channel; valid & ready'
    UNION ALL

    -- 6. candidate_course_applications view columns & exclusion of claim_token_hash
    SELECT
        6,
        'V1.1 View',
        'View candidate_course_applications exposes source & external_submission_id, excludes claim_token_hash',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'source'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'external_submission_id'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'claim_token_hash'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'View exposes required ingestion fields while strictly protecting sensitive claim_token_hash'
    UNION ALL

    -- 7. candidate_course_applications security_invoker = true
    SELECT
        7,
        'V1.1 Security',
        'View candidate_course_applications configured with security_invoker = true',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
                  AND c.reloptions IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM unnest(c.reloptions) opt
                      WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Guarantees RLS evaluation under querying candidate context, preventing unauthorized privilege escalation'
    UNION ALL

    -- 8. course_applications_documents_status_check constraint
    SELECT
        8,
        'V1.2 Constraint',
        'Constraint course_applications_documents_status_check permits all 7 lifecycle statuses',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'course_applications_documents_status_check'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'course_applications_documents_status_check'
                  AND pg_get_constraintdef(c.oid) LIKE '%''pending''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''under_review''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''verified''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''resubmission_requested''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''rejected''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''not_required''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''waived''%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Supports not_required & waived for Google Forms without compromising transcript verification for web apps'
    UNION ALL

    -- 9. rpc_admin_approve_google_forms_application existence & signature
    SELECT
        9,
        'V1.2 RPC Definition',
        'RPC rpc_admin_approve_google_forms_application exists with exact 4-parameter signature',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND (
                      p.pronargs <> 4
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                          'uuid, uuid, text, boolean'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Exact signature: (p_application_id UUID, p_actor_id UUID, p_notes TEXT, p_confirmed_sheet_verification BOOLEAN)'
    UNION ALL

    -- 10. rpc_admin_approve_google_forms_application SECURITY DEFINER & empty search_path
    SELECT
        10,
        'V1.2 RPC Security',
        'RPC rpc_admin_approve_google_forms_application has SECURITY DEFINER and strictly empty search_path',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
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
        'Strictly empty search_path prevents schema-override search_path injection attacks'
    UNION ALL

    -- 11. rpc_admin_approve_google_forms_application logic: decoupled approval without enrollment
    SELECT
        11,
        'V1.2 RPC Logic',
        'RPC rpc_admin_approve_google_forms_application decouples approval from enrollment',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
                  AND pg_get_functiondef(p.oid) NOT LIKE '%INSERT INTO public.enrollments_users%'
                  AND pg_get_functiondef(p.oid) LIKE '%status = ''approved''%'
                  AND pg_get_functiondef(p.oid) LIKE '%payment_status = ''verified''%'
                  AND pg_get_functiondef(p.oid) LIKE '%documents_status = ''not_required''%'
                  AND pg_get_functiondef(p.oid) LIKE '%p_confirmed_sheet_verification IS NOT TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.course_application_events%'
                  AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.course_application_audit_logs%'
                  AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.notification_outbox%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Sets status = approved & payment_status = verified; zero inserts to enrollments_users; records events/audit/outbox'
    UNION ALL

    -- 12. rpc_admin_transition_application_status existence & signature with SECDEF & search_path
    SELECT
        12,
        'V1.2 RPC Definition',
        'RPC rpc_admin_transition_application_status updated to v1.7.1 with SECDEF & empty search_path',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
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
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND (
                      p.pronargs <> 5
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                          'uuid, text, uuid, text, text'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        '5-parameter signature with SECURITY DEFINER and strictly empty search_path'
    UNION ALL

    -- 13. rpc_admin_transition_application_status blocks generic approval of Google Forms
    SELECT
        13,
        'V1.2 RPC Logic',
        'RPC rpc_admin_transition_application_status blocks generic approval for google_forms',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%Google Forms application % cannot be approved via generic transition%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Enforces use of rpc_admin_approve_google_forms_application for Google Forms'
    UNION ALL

    -- 14. rpc_admin_transition_application_status student identity linking
    SELECT
        14,
        'V1.2 RPC Logic',
        'RPC rpc_admin_transition_application_status verifies & links student user account',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%Cannot activate enrollment: No registered student account found in auth.users%'
                  AND pg_get_functiondef(p.oid) LIKE '%Ambiguous identity: Multiple matching user accounts found in auth.users%'
                  AND pg_get_functiondef(p.oid) LIKE '%Security violation: Application user_id % does not match registered email%'
                  AND pg_get_functiondef(p.oid) LIKE '%auth.users%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Atomically verifies and associates auth.users account within enrollment transaction'
    UNION ALL

    -- 15. rpc_admin_approve_google_forms_application permissions
    SELECT
        15,
        'V1.2 Permissions',
        'RPC rpc_admin_approve_google_forms_application restricted to service_role',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND (
                      p.pronargs <> 4
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                          'uuid, uuid, text, boolean'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'service_role has EXECUTE; authenticated, anon, and PUBLIC explicitly denied'
    UNION ALL

    -- 16. rpc_admin_transition_application_status permissions
    SELECT
        16,
        'V1.2 Permissions',
        'RPC rpc_admin_transition_application_status restricted to service_role',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND (
                      p.pronargs <> 5
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                          'uuid, text, uuid, text, text'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'service_role has EXECUTE; authenticated, anon, and PUBLIC explicitly denied'
    UNION ALL

    -- 17. recipient_name absent from notification_outbox
    SELECT
        17,
        'Schema Cleanliness',
        'Obsolete column recipient_name absent from public.notification_outbox',
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'notification_outbox'
            ) THEN 'NOT FOUND'
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'notification_outbox'
                  AND column_name = 'recipient_name'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Confirms outbox schema matches physical table definition (only recipient_email)'
    UNION ALL

    -- 18. Core tables & RLS active
    SELECT
        18,
        'Baseline Integrity',
        'All 5 core course application tables exist with active Row Level Security',
        CASE
            WHEN (
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname IN (
                      'course_applications',
                      'course_application_documents',
                      'course_application_events',
                      'course_application_audit_logs',
                      'notification_outbox'
                  )
                  AND c.relkind = 'r'
            ) < 5 THEN 'NOT FOUND'
            WHEN (
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname IN (
                      'course_applications',
                      'course_application_documents',
                      'course_application_events',
                      'course_application_audit_logs',
                      'notification_outbox'
                  )
                  AND c.relkind = 'r'
                  AND c.relrowsecurity = true
            ) = 5 THEN 'PASS'
            ELSE 'FAIL'
        END,
        'Zero regression on course applications tables & active RLS enforcement'
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
-- SECTION 10: AGGREGATED SCORECARD TOTALS
-- Single summary line displaying total checks, passed, failed, and not found.
-- Uses the exact same evaluation criteria as Section 9.
-- --------------------------------------------------------------------
WITH evaluations AS (
    -- 1. external_submission_id column
    SELECT
        1 AS check_id,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'external_submission_id'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'external_submission_id'
                  AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL
            ) THEN 'PASS'
            ELSE 'FAIL'
        END AS status
    UNION ALL

    -- 2. source column
    SELECT
        2,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'source'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'course_applications' AND column_name = 'source'
                  AND data_type = 'text' AND is_nullable = 'NO' AND column_default LIKE '''web''%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 3. chk_course_applications_source constraint
    SELECT
        3,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'chk_course_applications_source'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'chk_course_applications_source'
                  AND pg_get_constraintdef(c.oid) LIKE '%''web''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''google_forms''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''manual_import''%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 4. idx_course_applications_external_submission_id partial unique index
    SELECT
        4,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_external_submission_id'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_external_submission_id'
                  AND ix.indisunique = true
                  AND ix.indisvalid = true
                  AND ix.indisready = true
                  AND pg_get_expr(ix.indpred, ix.indrelid) LIKE '%external_submission_id IS NOT NULL%'
                  AND pg_get_indexdef(ix.indexrelid) LIKE '%(external_submission_id)%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 5. idx_course_applications_source index
    SELECT
        5,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_source'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_index ix
                JOIN pg_class i ON ix.indexrelid = i.oid
                JOIN pg_class t ON ix.indrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND i.relname = 'idx_course_applications_source'
                  AND ix.indisvalid = true
                  AND ix.indisready = true
                  AND pg_get_indexdef(ix.indexrelid) LIKE '%(source)%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 6. candidate_course_applications view columns & exclusion of claim_token_hash
    SELECT
        6,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'source'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'external_submission_id'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'candidate_course_applications' AND column_name = 'claim_token_hash'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 7. candidate_course_applications security_invoker = true
    SELECT
        7,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = 'candidate_course_applications' AND c.relkind = 'v'
                  AND c.reloptions IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM unnest(c.reloptions) opt
                      WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 8. course_applications_documents_status_check constraint
    SELECT
        8,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'course_applications_documents_status_check'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                JOIN pg_namespace n ON t.relnamespace = n.oid
                WHERE n.nspname = 'public' AND t.relname = 'course_applications'
                  AND c.conname = 'course_applications_documents_status_check'
                  AND pg_get_constraintdef(c.oid) LIKE '%''pending''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''under_review''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''verified''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''resubmission_requested''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''rejected''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''not_required''%'
                  AND pg_get_constraintdef(c.oid) LIKE '%''waived''%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 9. rpc_admin_approve_google_forms_application existence & signature
    SELECT
        9,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND (
                      p.pronargs <> 4
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                          'uuid, uuid, text, boolean'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 10. rpc_admin_approve_google_forms_application SECURITY DEFINER & empty search_path
    SELECT
        10,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
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
        END
    UNION ALL

    -- 11. rpc_admin_approve_google_forms_application logic: decoupled approval without enrollment
    SELECT
        11,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
                  AND pg_get_functiondef(p.oid) NOT LIKE '%INSERT INTO public.enrollments_users%'
                  AND pg_get_functiondef(p.oid) LIKE '%status = ''approved''%'
                  AND pg_get_functiondef(p.oid) LIKE '%payment_status = ''verified''%'
                  AND pg_get_functiondef(p.oid) LIKE '%documents_status = ''not_required''%'
                  AND pg_get_functiondef(p.oid) LIKE '%p_confirmed_sheet_verification IS NOT TRUE%'
                  AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.course_application_events%'
                  AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.course_application_audit_logs%'
                  AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.notification_outbox%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 12. rpc_admin_transition_application_status existence & signature with SECDEF & search_path
    SELECT
        12,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
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
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND (
                      p.pronargs <> 5
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                          'uuid, text, uuid, text, text'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 13. rpc_admin_transition_application_status blocks generic approval of Google Forms
    SELECT
        13,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%Google Forms application % cannot be approved via generic transition%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 14. rpc_admin_transition_application_status student identity linking
    SELECT
        14,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
                  AND pg_get_functiondef(p.oid) LIKE '%Cannot activate enrollment: No registered student account found in auth.users%'
                  AND pg_get_functiondef(p.oid) LIKE '%Ambiguous identity: Multiple matching user accounts found in auth.users%'
                  AND pg_get_functiondef(p.oid) LIKE '%Security violation: Application user_id % does not match registered email%'
                  AND pg_get_functiondef(p.oid) LIKE '%auth.users%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 15. rpc_admin_approve_google_forms_application permissions
    SELECT
        15,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND p.pronargs = 4
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, boolean'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_approve_google_forms_application'
                  AND (
                      p.pronargs <> 4
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_actor_id uuid, p_notes text, p_confirmed_sheet_verification boolean',
                          'uuid, uuid, text, boolean'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 16. rpc_admin_transition_application_status permissions
    SELECT
        16,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
            ) THEN 'NOT FOUND'
            WHEN EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND p.pronargs = 5
                  AND (
                      pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text'
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) = 'uuid, text, uuid, text, text'
                  )
                  AND has_function_privilege('service_role', p.oid, 'EXECUTE') = true
                  AND COALESCE(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) = false
                  AND COALESCE(has_function_privilege('anon', p.oid, 'EXECUTE'), false) = false
                  AND p.proacl IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM unnest(p.proacl) a
                      WHERE split_part(a::text, '=', 1) = ''
                        AND split_part(split_part(a::text, '=', 2), '/', 1) LIKE '%X%'
                  )
            )
            AND NOT EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
                  AND (
                      p.pronargs <> 5
                      OR pg_catalog.pg_get_function_identity_arguments(p.oid) NOT IN (
                          'p_application_id uuid, p_target_status text, p_actor_id uuid, p_reason text, p_resubmission_notes text',
                          'uuid, text, uuid, text, text'
                      )
                  )
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 17. recipient_name absent from notification_outbox
    SELECT
        17,
        CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'notification_outbox'
            ) THEN 'NOT FOUND'
            WHEN NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'notification_outbox'
                  AND column_name = 'recipient_name'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END
    UNION ALL

    -- 18. Core tables & RLS active
    SELECT
        18,
        CASE
            WHEN (
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname IN (
                      'course_applications',
                      'course_application_documents',
                      'course_application_events',
                      'course_application_audit_logs',
                      'notification_outbox'
                  )
                  AND c.relkind = 'r'
            ) < 5 THEN 'NOT FOUND'
            WHEN (
                SELECT count(*)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname IN (
                      'course_applications',
                      'course_application_documents',
                      'course_application_events',
                      'course_application_audit_logs',
                      'notification_outbox'
                  )
                  AND c.relkind = 'r'
                  AND c.relrowsecurity = true
            ) = 5 THEN 'PASS'
            ELSE 'FAIL'
        END
)
SELECT
    count(*) AS total_checks,
    count(*) FILTER (WHERE status = 'PASS') AS passed_checks,
    count(*) FILTER (WHERE status = 'FAIL') AS failed_checks,
    count(*) FILTER (WHERE status = 'NOT FOUND') AS not_found_checks,
    CASE
        WHEN count(*) = count(*) FILTER (WHERE status = 'PASS')
             THEN 'ALL 18 CHECKS PASSED — STAGING GOOGLE FORMS WORKFLOW FULLY VERIFIED'
        ELSE 'VERIFICATION FAILED — REVIEW DISCREPANCIES IN SECTION 9'
    END AS overall_status
FROM evaluations;
