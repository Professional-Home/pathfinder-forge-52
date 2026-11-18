-- ====================================================================
-- PATHFINDER STAGING PREREQUISITE READ-ONLY VERIFICATION SCRIPT (V1.0)
-- Target Project: Staging Supabase (neexbpcvedcfwjxpgede)
-- Safety: STRICTLY READ-ONLY (SELECT statements only).
--         Zero writes, modifications, DDL, DML, or state mutations.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. TABLE & COLUMN SCHEMA VERIFICATION
-- Checks that public.courses and public.enrollments_users exist
-- with their authoritative column definitions, data types, and nullability.
-- --------------------------------------------------------------------
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('courses', 'enrollments_users')
ORDER BY table_name, ordinal_position;

-- --------------------------------------------------------------------
-- 2. SEEDED COURSES DATA INTEGRITY VERIFICATION
-- Confirms all 3 authoritative courses exist with correct IDs, slugs,
-- titles, fees, and published statuses.
-- --------------------------------------------------------------------
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

-- --------------------------------------------------------------------
-- 3. NORMALIZATION & RESOLUTION FUNCTION READ-ONLY TEST MATRIX
-- Evaluates public.normalize_course_id() and public.resolve_course_title()
-- across canonical UUIDs, legacy strings ('course-*'), and slugs.
-- --------------------------------------------------------------------
SELECT 
    input_identifier,
    public.normalize_course_id(input_identifier) AS normalized_id,
    expected_uuid,
    (public.normalize_course_id(input_identifier) = expected_uuid) AS id_matches,
    public.resolve_course_title(input_identifier) AS resolved_title,
    expected_title,
    (public.resolve_course_title(input_identifier) = expected_title) AS title_matches
FROM (
    VALUES
        -- BioPlastic Innovation
        ('course-bioplastic-innovation', 'd2756643-0b82-4ebe-a123-9fa3be97bd13', 'BioPlastic Innovation'),
        ('bioplastic-innovation',        'd2756643-0b82-4ebe-a123-9fa3be97bd13', 'BioPlastic Innovation'),
        ('d2756643-0b82-4ebe-a123-9fa3be97bd13', 'd2756643-0b82-4ebe-a123-9fa3be97bd13', 'BioPlastic Innovation'),

        -- AI in Drug Discovery
        ('course-ai-drug-discovery',     'd6a21b1f-2682-4cf2-a83d-2c030f476625', 'AI in Drug Discovery'),
        ('course-ai-in-drug-discovery',  'd6a21b1f-2682-4cf2-a83d-2c030f476625', 'AI in Drug Discovery'),
        ('ai-in-drug-discovery',         'd6a21b1f-2682-4cf2-a83d-2c030f476625', 'AI in Drug Discovery'),
        ('d6a21b1f-2682-4cf2-a83d-2c030f476625', 'd6a21b1f-2682-4cf2-a83d-2c030f476625', 'AI in Drug Discovery'),

        -- Bioinformatics & Genomic Data Analysis
        ('course-bioinformatics',        '840fed84-696d-458e-aeee-2df6b88d3428', 'Bioinformatics & Genomic Data Analysis'),
        ('bioinformatics',               '840fed84-696d-458e-aeee-2df6b88d3428', 'Bioinformatics & Genomic Data Analysis'),
        ('bioinformatics-frontend-seed', '840fed84-696d-458e-aeee-2df6b88d3428', 'Bioinformatics & Genomic Data Analysis'),
        ('840fed84-696d-458e-aeee-2df6b88d3428', '840fed84-696d-458e-aeee-2df6b88d3428', 'Bioinformatics & Genomic Data Analysis')
) AS t(input_identifier, expected_uuid, expected_title);

-- --------------------------------------------------------------------
-- 4. TRIGGERS & INDEXES VERIFICATION
-- Validates that trg_sync_enrollment_timestamp and all 6 performance/
-- functional indexes exist on public.courses and public.enrollments_users.
-- --------------------------------------------------------------------
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('courses', 'enrollments_users')
ORDER BY event_object_table, trigger_name;

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('courses', 'enrollments_users')
ORDER BY tablename, indexname;

-- --------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) STATUS & POLICIES VERIFICATION
-- Confirms RLS is enabled on public.courses and public.enrollments_users
-- and inspects policy definitions.
-- Note: Checking policy definitions verifies that the security rules are
-- loaded into PostgreSQL catalog, but does NOT substitute for live JWT
-- authorization execution testing.
-- --------------------------------------------------------------------
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('courses', 'enrollments_users')
ORDER BY c.relname;

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
  AND tablename IN ('courses', 'enrollments_users')
ORDER BY tablename, policyname;

-- --------------------------------------------------------------------
-- 6. EXISTING SPIN WHEEL OBJECTS PRESERVATION HEALTH CHECK
-- Confirms that existing Spin Wheel tables, audit logs, and atomic RPCs
-- remain completely intact and undisturbed.
-- --------------------------------------------------------------------
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('spin_wheel_entries', 'spin_admin_audit_logs', 'spin_webhook_logs', 'profile', 'users')
ORDER BY table_name;

SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('redeem_spin_reward_atomic', 'verify_spin_webhook_atomic', 'record_spin_entry_atomic')
ORDER BY p.proname;

-- --------------------------------------------------------------------
-- 7. OVERALL PRE-FLIGHT COMPLIANCE SCORECARD
-- Single aggregated summary query giving an instant PASS/FAIL breakdown.
-- --------------------------------------------------------------------
WITH checks AS (
    SELECT 
        '1. Courses Table Exists' AS check_name,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courses') AS passed
    UNION ALL
    SELECT 
        '2. Enrollments Table Exists',
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrollments_users')
    UNION ALL
    SELECT 
        '3. All 3 Courses Seeded',
        ((SELECT count(*) FROM public.courses WHERE id IN (
            'd2756643-0b82-4ebe-a123-9fa3be97bd13',
            'd6a21b1f-2682-4cf2-a83d-2c030f476625',
            '840fed84-696d-458e-aeee-2df6b88d3428'
        )) = 3)
    UNION ALL
    SELECT 
        '4. Normalization Function Exists',
        EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'normalize_course_id')
    UNION ALL
    SELECT 
        '5. Title Resolution Function Exists',
        EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'resolve_course_title')
    UNION ALL
    SELECT 
        '6. Timestamp Sync Trigger Exists',
        EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'enrollments_users' AND trigger_name = 'trg_sync_enrollment_timestamp')
    UNION ALL
    SELECT 
        '7. Normalized Course Index Exists',
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'enrollments_users' AND indexname = 'idx_enrollments_users_normalized')
    UNION ALL
    SELECT 
        '8. RLS Enabled on Courses',
        COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'courses'), false)
    UNION ALL
    SELECT 
        '9. RLS Enabled on Enrollments',
        COALESCE((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'enrollments_users'), false)
    UNION ALL
    SELECT 
        '10. Spin Wheel Entries Table Intact',
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'spin_wheel_entries')
    UNION ALL
    SELECT 
        '11. Spin Wheel Atomic Redeem RPC Intact',
        EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'redeem_spin_reward_atomic')
    UNION ALL
    SELECT 
        '12. Spin Wheel Atomic Webhook RPC Intact',
        EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'verify_spin_webhook_atomic')
)
SELECT 
    check_name,
    CASE WHEN passed THEN '✅ PASS' ELSE '❌ MISSING / FAILED' END AS status
FROM checks;
