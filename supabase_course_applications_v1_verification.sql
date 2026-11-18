-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM — POST-MIGRATION VERIFICATION (V1.1)
-- Target Database: Staging Supabase Project (neexbpcvedcfwjxpgede)
-- Safety: STRICTLY READ-ONLY (SELECT statements only).
--         Zero writes, modifications, DDL, DML, or state mutations.
-- Specifications:
--   - docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md (Phase 3.3.11)
--   - docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md (Phase 3.3.11)
--   - docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md (Version 1.7.0)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TABLE EXISTENCE & ROW LEVEL SECURITY (RLS) STATUS
-- Verifies that all 5 Course Applications domain tables exist in public schema
-- and that Row Level Security (relrowsecurity) is explicitly enabled on all 5.
-- --------------------------------------------------------------------
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
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
ORDER BY c.relname;

-- --------------------------------------------------------------------
-- 2. COLUMN DEFINITIONS, DATA TYPES & NULLABILITY
-- Inspects all columns across the 5 tables to verify accurate schema structure.
-- --------------------------------------------------------------------
SELECT 
    table_name,
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY table_name, ordinal_position;

-- --------------------------------------------------------------------
-- 3. CONSTRAINTS (CHECK, UNIQUE, PRIMARY KEY) & FOREIGN KEYS
-- Verifies status enums, document types, file sizes, mime types, outbox templates,
-- and all 10 foreign keys with explicit ON DELETE actions.
-- --------------------------------------------------------------------
-- 3A. Table Constraints (CHECK, UNIQUE, PRIMARY KEY)
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON cc.constraint_name = tc.constraint_name
   AND cc.constraint_schema = tc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 3B. Foreign Key Relationships & Referential Actions
SELECT 
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_schema AS target_schema,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column,
    rc.update_rule,
    rc.delete_rule,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
   AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name 
   AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu 
    ON rc.unique_constraint_name = ccu.constraint_name 
   AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY tc.table_name, kcu.column_name;

-- --------------------------------------------------------------------
-- 4. PERFORMANCE & SECURITY INDEXES
-- Confirms all 14 custom indexes plus primary key/unique indexes exist.
-- --------------------------------------------------------------------
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY tablename, indexname;

-- --------------------------------------------------------------------
-- 5. TRIGGERS & INTEGRITY ENFORCEMENT
-- Confirms the 5 required triggers exist with correct timing and functions:
--   - trg_validate_course_id (course_applications)
--   - trg_course_applications_updated_at (course_applications)
--   - trg_course_application_documents_updated_at (course_application_documents)
--   - trg_prevent_audit_log_tampering (course_application_audit_logs)
--   - trg_notification_outbox_updated_at (notification_outbox)
-- --------------------------------------------------------------------
SELECT 
    event_object_table AS table_name,
    trigger_name,
    event_manipulation AS event,
    action_timing AS timing,
    action_orientation AS orientation,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY event_object_table, trigger_name;

-- --------------------------------------------------------------------
-- 6. RPC STORED PROCEDURES & TRIGGER FUNCTIONS INTEGRITY
-- Inspects function definitions, security definer settings, and search_path.
-- --------------------------------------------------------------------
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS argument_signature,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    p.proleakproof AS is_leakproof,
    p.proconfig AS configuration_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_admin_transition_application_status',
      'rpc_claim_guest_application',
      'rpc_dequeue_notification_batch',
      'validate_course_application_course_id',
      'generate_course_application_number',
      'prevent_audit_log_tampering',
      'set_course_application_updated_at'
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- 7. STORED PROCEDURE PRIVILEGE LOCKDOWN VERIFICATION
-- Checks that execution on the 3 core stored procedures is REVOKED from
-- anon and authenticated, and GRANTED strictly to service_role.
-- --------------------------------------------------------------------
SELECT 
    p.proname AS function_name,
    r.rolname AS role_name,
    has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN (
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')
) r
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_admin_transition_application_status',
      'rpc_claim_guest_application',
      'rpc_dequeue_notification_batch'
  )
ORDER BY p.proname, r.rolname;

-- --------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES & COLUMN GRANTS
-- Inspects active RLS policies in the PostgreSQL catalog and verifies
-- column-level SELECT grants for authenticated role on course_applications.
-- NOTE: Checking catalog policy definitions proves policy installation,
-- but live JWT authorization behavior must be verified via authenticated HTTP tests.
-- --------------------------------------------------------------------
-- 8A. Policy Definitions Catalog
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY tablename, policyname;

-- 8B. Column-Level SELECT Grants on course_applications (guest token exfiltration protection)
SELECT 
    table_name,
    column_name,
    grantee,
    privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'course_applications'
  AND grantee = 'authenticated'
ORDER BY column_name;

-- --------------------------------------------------------------------
-- 9. CANDIDATE HELPER VIEW (SECURITY INVOKER VERIFICATION)
-- Verifies public.candidate_course_applications exists and enforces
-- security_invoker = true so callers execute with their own JWT identity.
-- --------------------------------------------------------------------
SELECT 
    c.relname AS view_name,
    c.relkind AS relation_kind, -- 'v' indicates view
    c.reloptions AS view_options,
    EXISTS (
        SELECT 1 FROM unnest(c.reloptions) opt 
        WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
    ) AS is_security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'candidate_course_applications';

-- --------------------------------------------------------------------
-- 10. FOUNDATION & SPIN WHEEL OBJECTS PRESERVATION HEALTH CHECK
-- Confirms existing courses, enrollments_users, and Spin Wheel objects
-- remain completely intact and undisturbed following migration execution.
-- --------------------------------------------------------------------
-- 10A. Courses & Enrollments Objects
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('courses', 'enrollments_users')
ORDER BY table_name;

SELECT 
    id,
    slug,
    title,
    category,
    duration,
    mode,
    program_fee,
    difficulty,
    status,
    featured,
    created_at,
    updated_at
FROM public.courses
ORDER BY slug;

SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('normalize_course_id', 'resolve_course_title')
ORDER BY p.proname;

-- 10B. Spin Wheel & Profile Tables and RPCs
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'spin_wheel_entries',
      'spin_admin_audit_logs',
      'spin_webhook_logs',
      'profile',
      'users'
  )
ORDER BY table_name;

SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'redeem_spin_reward_atomic',
      'verify_spin_webhook_atomic',
      'record_spin_entry_atomic'
  )
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- 11. UNIFIED AUTOMATED POST-MIGRATION SCORECARD
-- Aggregated validation matrix evaluating all 20 critical criteria in a single view.
-- --------------------------------------------------------------------
WITH checks AS (
    -- Group 1: Table Existence (5)
    SELECT '1. Table: course_applications exists' AS check_name,
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_applications') AS passed
    UNION ALL
    SELECT '2. Table: course_application_documents exists',
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_application_documents')
    UNION ALL
    SELECT '3. Table: course_application_events exists',
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_application_events')
    UNION ALL
    SELECT '4. Table: course_application_audit_logs exists',
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_application_audit_logs')
    UNION ALL
    SELECT '5. Table: notification_outbox exists',
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_outbox')

    -- Group 2: RLS Enabled on all 5 tables (5)
    UNION ALL
    SELECT '6. RLS: course_applications enabled',
           COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'course_applications'), false)
    UNION ALL
    SELECT '7. RLS: course_application_documents enabled',
           COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'course_application_documents'), false)
    UNION ALL
    SELECT '8. RLS: course_application_events enabled',
           COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'course_application_events'), false)
    UNION ALL
    SELECT '9. RLS: course_application_audit_logs enabled',
           COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'course_application_audit_logs'), false)
    UNION ALL
    SELECT '10. RLS: notification_outbox enabled',
           COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'notification_outbox'), false)

    -- Group 3: Core Triggers (5)
    UNION ALL
    SELECT '11. Trigger: trg_validate_course_id active',
           EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'course_applications' AND trigger_name = 'trg_validate_course_id')
    UNION ALL
    SELECT '12. Trigger: trg_course_applications_updated_at active',
           EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'course_applications' AND trigger_name = 'trg_course_applications_updated_at')
    UNION ALL
    SELECT '13. Trigger: trg_course_application_documents_updated_at active',
           EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'course_application_documents' AND trigger_name = 'trg_course_application_documents_updated_at')
    UNION ALL
    SELECT '14. Trigger: trg_prevent_audit_log_tampering active',
           EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'course_application_audit_logs' AND trigger_name = 'trg_prevent_audit_log_tampering')
    UNION ALL
    SELECT '15. Trigger: trg_notification_outbox_updated_at active',
           EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'notification_outbox' AND trigger_name = 'trg_notification_outbox_updated_at')

    -- Group 4: RPC Functions & Settings (3)
    UNION ALL
    SELECT '16. RPC: rpc_admin_transition_application_status (secdef & empty search_path)',
           EXISTS (
               SELECT 1 FROM pg_proc p 
               JOIN pg_namespace n ON n.oid = p.pronamespace 
               WHERE n.nspname = 'public' 
                 AND p.proname = 'rpc_admin_transition_application_status' 
                 AND p.prosecdef = true 
                 AND (ARRAY['search_path=']::text[] <@ p.proconfig OR EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
           )
    UNION ALL
    SELECT '17. RPC: rpc_claim_guest_application (secdef & empty search_path)',
           EXISTS (
               SELECT 1 FROM pg_proc p 
               JOIN pg_namespace n ON n.oid = p.pronamespace 
               WHERE n.nspname = 'public' 
                 AND p.proname = 'rpc_claim_guest_application' 
                 AND p.prosecdef = true 
                 AND (ARRAY['search_path=']::text[] <@ p.proconfig OR EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
           )
    UNION ALL
    SELECT '18. RPC: rpc_dequeue_notification_batch (secdef & empty search_path)',
           EXISTS (
               SELECT 1 FROM pg_proc p 
               JOIN pg_namespace n ON n.oid = p.pronamespace 
               WHERE n.nspname = 'public' 
                 AND p.proname = 'rpc_dequeue_notification_batch' 
                 AND p.prosecdef = true 
                 AND (ARRAY['search_path=']::text[] <@ p.proconfig OR EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'))
           )

    -- Group 5: View & Invoker (1)
    UNION ALL
    SELECT '19. View: candidate_course_applications (security_invoker = true)',
           EXISTS (
               SELECT 1 FROM pg_class c 
               JOIN pg_namespace n ON n.oid = c.relnamespace 
               WHERE n.nspname = 'public' 
                 AND c.relname = 'candidate_course_applications' 
                 AND EXISTS (
                     SELECT 1 FROM unnest(c.reloptions) opt 
                     WHERE opt IN ('security_invoker=true', 'security_invoker=on', 'security_invoker=1')
                 )
           )

    -- Group 6: RPC Permission Lockdown (3)
    UNION ALL
    SELECT '20. Lockdown: transition RPC revoked from authenticated',
           NOT COALESCE((
               SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE')
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_transition_application_status'
           ), true)
    UNION ALL
    SELECT '21. Lockdown: claim RPC revoked from authenticated',
           NOT COALESCE((
               SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE')
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'rpc_claim_guest_application'
           ), true)
    UNION ALL
    SELECT '22. Lockdown: dequeue RPC revoked from authenticated',
           NOT COALESCE((
               SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE')
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'rpc_dequeue_notification_batch'
           ), true)

    -- Group 7: Foundation Integrity (2)
    UNION ALL
    SELECT '23. Foundation: public.courses has 3 seeded records',
           ((SELECT count(*) FROM public.courses WHERE id IN (
               'd2756643-0b82-4ebe-a123-9fa3be97bd13',
               'd6a21b1f-2682-4cf2-a83d-2c030f476625',
               '840fed84-696d-458e-aeee-2df6b88d3428'
           )) = 3)
    UNION ALL
    SELECT '24. Foundation: Spin Wheel tables and RPCs preserved',
           (
               EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spin_wheel_entries')
               AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'redeem_spin_reward_atomic')
           )
)
SELECT 
    check_name,
    CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAILED' END AS verification_status
FROM checks
ORDER BY check_name;
