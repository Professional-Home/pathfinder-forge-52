-- ====================================================================
-- PathFinder CMS — Google Forms Staging Verification (Section 9 Only)
-- File: scripts/verification/verify_google_forms_staging_section9_only.sql
-- Purpose: Standalone execution of Section 9 Unified Scorecard Matrix (18 Rows).
-- Target: Supabase Staging Project (neexbpcvedcfwjxpgede) SQL Editor.
-- Note: Extracted from verify_google_forms_staging.sql to display all 18 rows
--       directly in the Supabase SQL Editor results table without being obscured
--       by Section 10 summary totals.
-- Read-Only: 100% catalog SELECT / WITH query (zero mutations, zero DDL/DML).
-- ====================================================================

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
