-- ====================================================================
-- PATHFINDER PRODUCTION ENROLLMENT PREREQUISITE MIGRATION V1.6
-- Document Phase: Phase 4.5J-W Final Consolidated Safety & Verification
-- Target Database: Production Supabase (knrmfpgwcdtpwcgkjrnk)
-- Target Tables: public.courses (assert-only), public.enrollments_users (upgrade)
--
-- Authoritative Production Baseline:
--   - BioPlastic Innovation:               6801f93f-2d3b-4841-81c2-fa4b1a27fc64 (slug: bioplastic-innovation)
--   - AI in Drug Discovery:                 16dcf034-13c7-49dd-adfe-6d927e4e7ec5 (slug: ai-in-drug-discovery)
--   - Bioinformatics & Computational Bio:   619be200-832d-41e8-97b8-d0515031ae76 (slug: bioinformatics)
--
-- Phase 4.5J-W Consolidated Safety Corrections Applied:
--   1. ZERO COURSE DATA MUTATION: Does not insert, update, delete, or re-seed course records.
--   2. ZERO SPECULATIVE COURSE SCHEMA ALTERATION: Production public.courses schema remains untouched.
--   3. ZERO RLS POLICY MUTATION: Preserves existing table RLS configuration without disruption.
--   4. ZERO UNNECESSARY EXTENSION CREATION: Removed all CREATE EXTENSION statements.
--   5. COMPREHENSIVE BASELINE & ADDED COLUMN TYPE PREFLIGHT: Strictly verifies catalog existence and
--      exact data types for existing baseline columns (id: uuid, student_email: text, course_id: text,
--      enrollment_date: timestamp with time zone), course uniqueness, and newly added columns.
--   6. EXACT SIGNATURE & COMPREHENSIVE DEPENDENCY AUDIT FOR normalize_course_id():
--      Restricts audit strictly to exact signature public.normalize_course_id(TEXT) -> TEXT (pronargs=1,
--      proargtypes[0]=text, prorettype=text). Fails closed on any unexpected overloads. Audits all dependent
--      objects in pg_depend (functional indexes, views, constraints, rules) via pg_describe_object.
--   7. COMPLETE NORMALIZATION MAPPING VERIFICATION:
--      Replaces superficial UUID substring checks with complete mapping equivalence across all 3 Production
--      courses, canonical slugs, legacy aliases, Staging UUID aliases, NULL/whitespace, and fallback handling.
--      Fails closed if the function exists with a non-equivalent mapping while dependent objects exist.
--   8. AMBIGUITY-SAFE COURSE TITLE RESOLUTION: public.resolve_course_title() resolves canonical Production
--      courses directly. In fallback queries, exactly 1 row returns title, 0 rows returns NULL, and >1 rows
--      raises an explicit data_exception rather than silently selecting an arbitrary record via LIMIT 1.
--   9. TIMESTAMP COMPATIBILITY & CONSERVATIVE CONSTRAINTS: Retains existing nullability and defaults on the
--      pre-existing enrollment_date column rather than guessing. Enforces NOT NULL safely on newly added
--      timestamp columns (enrolled_at, created_at, updated_at) after consistent per-row backfill.
--  10. TRUSTWORTHY TRIGGER-FUNCTION VERIFICATION & ISOLATION:
--      Uses isolated versioned function public.sync_enrollment_timestamp_v1(); leaves legacy unversioned function
--      untouched. Trustworthy verification checks signature, language, security invoker, and normalized source
--      against all required PL/pgSQL state transitions. Inspects target trigger across 12 catalog properties.
--  11. EXACT CATALOG-BASED FUNCTIONAL INDEX VERIFICATION:
--      Replaces regex/substring checks with exact catalog inspection (table, btree, exact key expressions in
--      order: expression 1 = lower(btrim(student_email)), expression 2 = normalize_course_id(course_id),
--      operator class text_ops, ASC sort, non-unique, no predicate, no included columns, valid & ready).
--      Aborts on incompatible definition; detects exact equivalent indexes under alternate names.
--  12. LEAST-PRIVILEGE FUNCTION GRANTS: Explicitly revokes PUBLIC execution. Grants EXECUTE on normalization
--      and resolution strictly to verified caller roles (authenticated, service_role). Restricts trigger
--      function strictly to service_role.
--  13. TRANSACTION WRAPPED: Fully enclosed in an explicit transaction (BEGIN ... COMMIT).
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. PREFLIGHT ASSERTIONS (FAIL-CLOSED PRODUCTION BASELINE VERIFICATION)
-- Verifies that the Production baseline tables, column types, and course
-- records match expectations before any DDL runs.
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_bio_id TEXT;
    v_ai_id TEXT;
    v_bioinfo_id TEXT;
    v_bio_count INT;
    v_ai_count INT;
    v_bioinfo_count INT;
    v_col_type TEXT;
BEGIN
    -- 1. Assert public.courses exists
    IF to_regclass('public.courses') IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.courses does not exist in this database.'
            USING ERRCODE = 'undefined_table';
    END IF;

    -- 2. Assert public.enrollments_users exists
    IF to_regclass('public.enrollments_users') IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Table public.enrollments_users does not exist in this database.'
            USING ERRCODE = 'undefined_table';
    END IF;

    -- 3. Assert baseline column types in public.enrollments_users
    -- 3a. Column 'id' must be UUID
    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'id';
    IF v_col_type IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.id is missing.'
            USING ERRCODE = 'undefined_column';
    ELSIF v_col_type <> 'uuid' THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.id has unexpected type "%" (expected uuid). Aborting migration.', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    -- 3b. Column 'student_email' must be TEXT
    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'student_email';
    IF v_col_type IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.student_email is missing.'
            USING ERRCODE = 'undefined_column';
    ELSIF v_col_type <> 'text' THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.student_email has unexpected type "%" (expected text). Aborting migration.', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    -- 3c. Column 'course_id' must be TEXT
    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'course_id';
    IF v_col_type IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.course_id is missing.'
            USING ERRCODE = 'undefined_column';
    ELSIF v_col_type <> 'text' THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.course_id has unexpected type "%" (expected text). Aborting migration.', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    -- 3d. Column 'enrollment_date' must be TIMESTAMPTZ (timestamp with time zone)
    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'enrollment_date';
    IF v_col_type IS NULL THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.enrollment_date is missing.'
            USING ERRCODE = 'undefined_column';
    ELSIF v_col_type <> 'timestamp with time zone' THEN
        RAISE EXCEPTION 'Precondition Failed: Column public.enrollments_users.enrollment_date has unexpected type "%" (expected timestamp with time zone). Aborting migration.', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    -- 4. Assert uniqueness and exact ID for Course 1: BioPlastic Innovation (bioplastic-innovation)
    SELECT count(*), min(id::text) INTO v_bio_count, v_bio_id 
    FROM public.courses WHERE slug = 'bioplastic-innovation';
    IF v_bio_count = 0 THEN
        RAISE EXCEPTION 'Precondition Failed: Course with slug "bioplastic-innovation" does not exist in public.courses.'
            USING ERRCODE = 'no_data_found';
    ELSIF v_bio_count > 1 THEN
        RAISE EXCEPTION 'Precondition Failed: Multiple courses found with slug "bioplastic-innovation" (count: %). Uniqueness violated.', v_bio_count
            USING ERRCODE = 'data_exception';
    ELSIF v_bio_id <> '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN
        RAISE EXCEPTION 'Precondition Failed: Course "bioplastic-innovation" has unexpected ID % (expected 6801f93f-2d3b-4841-81c2-fa4b1a27fc64). Aborting migration.', v_bio_id
            USING ERRCODE = 'data_exception';
    END IF;

    -- 5. Assert uniqueness and exact ID for Course 2: AI in Drug Discovery (ai-in-drug-discovery)
    SELECT count(*), min(id::text) INTO v_ai_count, v_ai_id 
    FROM public.courses WHERE slug = 'ai-in-drug-discovery';
    IF v_ai_count = 0 THEN
        RAISE EXCEPTION 'Precondition Failed: Course with slug "ai-in-drug-discovery" does not exist in public.courses.'
            USING ERRCODE = 'no_data_found';
    ELSIF v_ai_count > 1 THEN
        RAISE EXCEPTION 'Precondition Failed: Multiple courses found with slug "ai-in-drug-discovery" (count: %). Uniqueness violated.', v_ai_count
            USING ERRCODE = 'data_exception';
    ELSIF v_ai_id <> '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN
        RAISE EXCEPTION 'Precondition Failed: Course "ai-in-drug-discovery" has unexpected ID % (expected 16dcf034-13c7-49dd-adfe-6d927e4e7ec5). Aborting migration.', v_ai_id
            USING ERRCODE = 'data_exception';
    END IF;

    -- 6. Assert uniqueness and exact ID for Course 3: Bioinformatics & Computational Biology (bioinformatics)
    SELECT count(*), min(id::text) INTO v_bioinfo_count, v_bioinfo_id 
    FROM public.courses WHERE slug = 'bioinformatics';
    IF v_bioinfo_count = 0 THEN
        RAISE EXCEPTION 'Precondition Failed: Course with slug "bioinformatics" does not exist in public.courses.'
            USING ERRCODE = 'no_data_found';
    ELSIF v_bioinfo_count > 1 THEN
        RAISE EXCEPTION 'Precondition Failed: Multiple courses found with slug "bioinformatics" (count: %). Uniqueness violated.', v_bioinfo_count
            USING ERRCODE = 'data_exception';
    ELSIF v_bioinfo_id <> '619be200-832d-41e8-97b8-d0515031ae76' THEN
        RAISE EXCEPTION 'Precondition Failed: Course "bioinformatics" has unexpected ID % (expected 619be200-832d-41e8-97b8-d0515031ae76). Aborting migration.', v_bioinfo_id
            USING ERRCODE = 'data_exception';
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. PRODUCTION COURSE IDENTIFIER NORMALIZATION & DEPENDENCY SAFETY
-- Maps canonical slugs, legacy 'course-*' IDs, and documented Staging UUID
-- aliases strictly to authoritative PRODUCTION UUIDs.
-- Before replacing or creating:
--   - Verifies the exact function signature: public.normalize_course_id(TEXT) -> TEXT.
--   - Detects and fails closed on unexpected overloads.
--   - Inspects all dependent objects in pg_depend (functional indexes, views,
--     constraints, rules) via pg_describe_object.
--   - Verifies complete mapping equivalence across all 3 Production courses,
--     canonical slugs, legacy aliases, Staging UUID aliases, NULL/whitespace, and fallback.
--   - Fails closed if the function exists with a non-equivalent mapping while dependent
--     objects exist, preventing stale functional index entries or inconsistent data.
--   - Preserves unknown IDs as trimmed lowercase.
-- IMMUTABLE sql function required for PostgreSQL functional indexing.
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_fn_oid OID;
    v_src TEXT;
    v_overload_count INT := 0;
    v_dep_count INT := 0;
    v_dep_descs TEXT;
    v_mapping_equivalent BOOLEAN := true;
    v_test_res TEXT;
BEGIN
    -- 1. Check for any unexpected overloads of public.normalize_course_id
    SELECT count(*)
    INTO v_overload_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'normalize_course_id'
      AND NOT (p.pronargs = 1 
               AND p.proargtypes[0] = 'pg_catalog.text'::regtype 
               AND p.prorettype = 'pg_catalog.text'::regtype);

    IF v_overload_count > 0 THEN
        RAISE EXCEPTION 'Safety Violation: Found % unexpected overload(s) of public.normalize_course_id with non-TEXT signature. Manual resolution required.',
            v_overload_count USING ERRCODE = 'ambiguous_function';
    END IF;

    -- 2. Locate the exact function signature: public.normalize_course_id(TEXT) -> TEXT
    SELECT p.oid, p.prosrc
    INTO v_fn_oid, v_src
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'normalize_course_id'
      AND p.pronargs = 1
      AND p.proargtypes[0] = 'pg_catalog.text'::regtype
      AND p.prorettype = 'pg_catalog.text'::regtype;

    IF v_fn_oid IS NOT NULL THEN
        -- 3. Comprehensive dependency audit across all dependent catalog objects
        -- Inspects functional indexes, views, rewrite rules, check constraints, etc.
        SELECT count(DISTINCT (d.classid, d.objid)),
               string_agg(DISTINCT pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid), '; ')
        INTO v_dep_count, v_dep_descs
        FROM pg_catalog.pg_depend d
        WHERE d.refclassid = 'pg_proc'::regclass
          AND d.refobjid = v_fn_oid
          AND d.deptype IN ('n', 'a');

        -- 4. Complete mapping verification across all 3 Production courses & aliases
        -- Test battery evaluating behavioral execution against authoritative Production mappings
        BEGIN
            -- 4a. NULL and whitespace handling
            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING NULL;
            IF v_test_res IS NOT NULL THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '';
            IF v_test_res IS NOT NULL THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '   ';
            IF v_test_res IS NOT NULL THEN v_mapping_equivalent := false; END IF;

            -- 4b. BioPlastic Innovation -> 6801f93f-2d3b-4841-81c2-fa4b1a27fc64
            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '6801f93f-2d3b-4841-81c2-fa4b1a27fc64';
            IF v_test_res <> '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '  6801f93f-2d3b-4841-81c2-fa4b1a27fc64  ';
            IF v_test_res <> '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'bioplastic-innovation';
            IF v_test_res <> '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'course-bioplastic-innovation';
            IF v_test_res <> '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'd2756643-0b82-4ebe-a123-9fa3be97bd13';
            IF v_test_res <> '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN v_mapping_equivalent := false; END IF;

            -- 4c. AI in Drug Discovery -> 16dcf034-13c7-49dd-adfe-6d927e4e7ec5
            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '16dcf034-13c7-49dd-adfe-6d927e4e7ec5';
            IF v_test_res <> '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'ai-in-drug-discovery';
            IF v_test_res <> '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'course-ai-drug-discovery';
            IF v_test_res <> '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'course-ai-in-drug-discovery';
            IF v_test_res <> '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'd6a21b1f-2682-4cf2-a83d-2c030f476625';
            IF v_test_res <> '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN v_mapping_equivalent := false; END IF;

            -- 4d. Bioinformatics & Computational Biology -> 619be200-832d-41e8-97b8-d0515031ae76
            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '619be200-832d-41e8-97b8-d0515031ae76';
            IF v_test_res <> '619be200-832d-41e8-97b8-d0515031ae76' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'bioinformatics';
            IF v_test_res <> '619be200-832d-41e8-97b8-d0515031ae76' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'course-bioinformatics';
            IF v_test_res <> '619be200-832d-41e8-97b8-d0515031ae76' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'bioinformatics-frontend-seed';
            IF v_test_res <> '619be200-832d-41e8-97b8-d0515031ae76' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '840fed84-696d-458e-aeee-2df6b88d3428';
            IF v_test_res <> '619be200-832d-41e8-97b8-d0515031ae76' THEN v_mapping_equivalent := false; END IF;

            -- 4e. Unknown identifier fallback (preserve trimmed lowercase)
            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING 'unknown-course-slug';
            IF v_test_res <> 'unknown-course-slug' THEN v_mapping_equivalent := false; END IF;

            EXECUTE 'SELECT public.normalize_course_id($1)' INTO v_test_res USING '  CUSTOM-UNKNOWN-123  ';
            IF v_test_res <> 'custom-unknown-123' THEN v_mapping_equivalent := false; END IF;

        EXCEPTION WHEN OTHERS THEN
            v_mapping_equivalent := false;
        END;

        -- 4f. Structural check: assert no Staging UUID appears as a return value on the THEN side
        IF v_src ~* 'then\s*''d2756643-0b82-4ebe-a123-9fa3be97bd13'''
           OR v_src ~* 'then\s*''d6a21b1f-2682-4cf2-a83d-2c030f476625'''
           OR v_src ~* 'then\s*''840fed84-696d-458e-aeee-2df6b88d3428''' THEN
            v_mapping_equivalent := false;
        END IF;

        -- 4g. If dependencies exist and mapping is not proven equivalent, fail closed
        IF v_dep_count > 0 AND NOT v_mapping_equivalent THEN
            RAISE EXCEPTION 'Safety Violation: Function public.normalize_course_id(text) exists with a non-equivalent mapping and is referenced by % dependent object(s): "%". Replacing this function would leave dependent index entries or expressions inconsistent with the Production baseline. Manual review required.',
                v_dep_count, v_dep_descs
                USING ERRCODE = 'dependent_objects_still_exist';
        ELSIF v_dep_count > 0 AND v_mapping_equivalent THEN
            RAISE NOTICE 'Function public.normalize_course_id(text) is referenced by % dependent object(s) ("%") and has verified equivalent Production mapping.',
                v_dep_count, v_dep_descs;
        END IF;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_course_id(p_course_id TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
COST 1
AS $$
    SELECT CASE 
        WHEN p_course_id IS NULL OR pg_catalog.btrim(p_course_id) = '' THEN NULL
        ELSE CASE pg_catalog.lower(pg_catalog.btrim(p_course_id))
            -- BioPlastic Innovation -> Production UUID: 6801f93f-2d3b-4841-81c2-fa4b1a27fc64
            WHEN '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN '6801f93f-2d3b-4841-81c2-fa4b1a27fc64'
            WHEN 'bioplastic-innovation' THEN '6801f93f-2d3b-4841-81c2-fa4b1a27fc64'
            WHEN 'course-bioplastic-innovation' THEN '6801f93f-2d3b-4841-81c2-fa4b1a27fc64'
            WHEN 'd2756643-0b82-4ebe-a123-9fa3be97bd13' THEN '6801f93f-2d3b-4841-81c2-fa4b1a27fc64'

            -- AI in Drug Discovery -> Production UUID: 16dcf034-13c7-49dd-adfe-6d927e4e7ec5
            WHEN '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN '16dcf034-13c7-49dd-adfe-6d927e4e7ec5'
            WHEN 'ai-in-drug-discovery' THEN '16dcf034-13c7-49dd-adfe-6d927e4e7ec5'
            WHEN 'course-ai-drug-discovery' THEN '16dcf034-13c7-49dd-adfe-6d927e4e7ec5'
            WHEN 'course-ai-in-drug-discovery' THEN '16dcf034-13c7-49dd-adfe-6d927e4e7ec5'
            WHEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625' THEN '16dcf034-13c7-49dd-adfe-6d927e4e7ec5'

            -- Bioinformatics & Computational Biology -> Production UUID: 619be200-832d-41e8-97b8-d0515031ae76
            WHEN '619be200-832d-41e8-97b8-d0515031ae76' THEN '619be200-832d-41e8-97b8-d0515031ae76'
            WHEN 'bioinformatics' THEN '619be200-832d-41e8-97b8-d0515031ae76'
            WHEN 'course-bioinformatics' THEN '619be200-832d-41e8-97b8-d0515031ae76'
            WHEN 'bioinformatics-frontend-seed' THEN '619be200-832d-41e8-97b8-d0515031ae76'
            WHEN '840fed84-696d-458e-aeee-2df6b88d3428' THEN '619be200-832d-41e8-97b8-d0515031ae76'

            ELSE pg_catalog.lower(pg_catalog.btrim(p_course_id))
        END
    END;
$$;

-- --------------------------------------------------------------------
-- 3. PRODUCTION COURSE TITLE RESOLUTION FUNCTION
-- Resolves the authoritative course display title for any course identifier.
-- Dispatches canonical Production courses directly from memory. For dynamic courses,
-- deterministically queries public.courses:
--   - RFC-4122 UUID inputs match c.id::text
--   - Non-UUID inputs match c.slug
-- Ambiguity-safe:
--   - Zero matches return NULL
--   - Exactly one match returns title
--   - More than one match raises an explicit data_exception (no arbitrary LIMIT 1)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_course_title(p_course_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    v_norm TEXT;
    v_title TEXT;
    v_match_count INT;
BEGIN
    IF p_course_id IS NULL OR pg_catalog.btrim(p_course_id) = '' THEN
        RETURN NULL;
    END IF;

    -- Step 1: Normalize through authoritative Production mapping
    v_norm := public.normalize_course_id(p_course_id);

    -- Step 2: Immediate resolution for canonical Production courses
    IF v_norm = '6801f93f-2d3b-4841-81c2-fa4b1a27fc64' THEN
        RETURN 'BioPlastic Innovation';
    ELSIF v_norm = '16dcf034-13c7-49dd-adfe-6d927e4e7ec5' THEN
        RETURN 'AI in Drug Discovery';
    ELSIF v_norm = '619be200-832d-41e8-97b8-d0515031ae76' THEN
        RETURN 'Bioinformatics & Computational Biology';
    END IF;

    -- Step 3: Deterministic fallback lookup against public.courses
    -- If UUID format (RFC-4122), query by exact ID
    IF v_norm ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT count(*), min(c.title)
        INTO v_match_count, v_title
        FROM public.courses c
        WHERE c.id::text = v_norm;

        IF v_match_count = 0 THEN
            RETURN NULL;
        ELSIF v_match_count > 1 THEN
            RAISE EXCEPTION 'Ambiguous course ID: % matches found for ID "%" in public.courses.', v_match_count, v_norm
                USING ERRCODE = 'data_exception';
        END IF;

        RETURN v_title;
    ELSE
        -- Otherwise query by exact slug
        SELECT count(*), min(c.title)
        INTO v_match_count, v_title
        FROM public.courses c
        WHERE c.slug = v_norm;

        IF v_match_count = 0 THEN
            RETURN NULL;
        ELSIF v_match_count > 1 THEN
            RAISE EXCEPTION 'Ambiguous course slug: % matches found for slug "%" in public.courses.', v_match_count, v_norm
                USING ERRCODE = 'data_exception';
        END IF;

        RETURN v_title;
    END IF;
END;
$$;

-- --------------------------------------------------------------------
-- 4. UPGRADE EXISTING public.enrollments_users TABLE
-- Preserves existing table structure, columns, and rows.
-- Reconciles enrollment_date (used by active frontend & CMS) and
-- enrolled_at (used by documentation and legacy code) with trigger-managed
-- synchronization and NOT NULL on newly added columns.
-- Retains pre-existing nullability and column defaults on enrollment_date.
-- --------------------------------------------------------------------

-- Step 1: Ensure all required columns exist before backfilling
ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;
ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT pg_catalog.clock_timestamp();
ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT pg_catalog.clock_timestamp();

-- Step 2: Post-DDL assertion verifying added column data types
DO $$
DECLARE
    v_col_type TEXT;
BEGIN
    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'student_name';
    IF v_col_type <> 'text' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Column public.enrollments_users.student_name has unexpected type "%" (expected text).', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'enrolled_at';
    IF v_col_type <> 'timestamp with time zone' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Column public.enrollments_users.enrolled_at has unexpected type "%" (expected timestamp with time zone).', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'created_at';
    IF v_col_type <> 'timestamp with time zone' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Column public.enrollments_users.created_at has unexpected type "%" (expected timestamp with time zone).', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;

    SELECT c.data_type INTO v_col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'enrollments_users' AND c.column_name = 'updated_at';
    IF v_col_type <> 'timestamp with time zone' THEN
        RAISE EXCEPTION 'Post-DDL Assertion Failed: Column public.enrollments_users.updated_at has unexpected type "%" (expected timestamp with time zone).', v_col_type
            USING ERRCODE = 'datatype_mismatch';
    END IF;
END $$;

-- Step 3: Consistent per-row timestamp backfill across legacy rows
-- Evaluates one shared fallback timestamp per row to ensure atomic consistency,
-- while preserving all valid non-NULL historical timestamps intact.
UPDATE public.enrollments_users e
SET enrolled_at = COALESCE(e.enrolled_at, t.fallback_now),
    enrollment_date = COALESCE(e.enrollment_date, t.fallback_now),
    created_at = COALESCE(e.created_at, t.fallback_now),
    updated_at = COALESCE(e.updated_at, t.fallback_now)
FROM (
    SELECT id, COALESCE(enrolled_at, enrollment_date, created_at, updated_at, pg_catalog.clock_timestamp()) AS fallback_now
    FROM public.enrollments_users
    WHERE enrolled_at IS NULL
       OR enrollment_date IS NULL
       OR created_at IS NULL
       OR updated_at IS NULL
) t
WHERE e.id = t.id;

-- Step 4: Enforce NOT NULL constraints strictly on NEW timestamp columns
-- Preserves existing constraint and default state on enrollment_date without guessing.
ALTER TABLE public.enrollments_users ALTER COLUMN enrolled_at SET NOT NULL;
ALTER TABLE public.enrollments_users ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.enrollments_users ALTER COLUMN updated_at SET NOT NULL;

-- --------------------------------------------------------------------
-- 5. VERSIONED TRIGGER FUNCTION & ISOLATED TRIGGER COMPATIBILITY
-- Defines a uniquely named, versioned function (public.sync_enrollment_timestamp_v1)
-- to eliminate the risk of modifying shared functions used by other triggers.
-- Trustworthy verification:
--   - If absent: creates the versioned function with canonical implementation.
--   - If present: verifies signature, language plpgsql, security invoker, and
--     complete PL/pgSQL implementation structure against canonical behavior:
--     INSERT timestamp defaults/synchronization, UPDATE preservation of OLD.created_at,
--     UPDATE advancement of updated_at, explicit change propagation, and preservation
--     of unchanged timestamps. Fails closed if unexpected or deviating.
--   - Inspects target trigger trg_sync_enrollment_timestamp on public.enrollments_users:
--     - If absent: creates the trigger using the verified versioned function.
--     - If compatible across all 12 catalog properties: preserves it without modification.
--     - If conflicting: aborts the transaction immediately.
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_fn_oid OID;
    v_src TEXT;
    v_src_norm TEXT;
    v_prorettype OID;
    v_pronargs INT;
    v_prosecdef BOOLEAN;
    v_lanname TEXT;
    v_impl_verified BOOLEAN := true;
    v_other_tg_count INT := 0;
    v_tg_exists BOOLEAN := false;
    v_tgname TEXT;
    v_relname TEXT;
    v_nspname TEXT;
    v_proname TEXT;
    v_pro_nspname TEXT;
    v_tgtype INT;
    v_tgenabled CHAR;
    v_has_no_when BOOLEAN;
    v_tgnargs INT;
    v_tgisinternal BOOLEAN;
    v_tgconstraint OID;
    v_has_no_attr_restriction BOOLEAN;
    v_is_compatible BOOLEAN := false;
BEGIN
    -- Part A: Check if versioned function already exists
    SELECT p.oid, p.prosrc, p.prorettype, p.pronargs, p.prosecdef, l.lanname
    INTO v_fn_oid, v_src, v_prorettype, v_pronargs, v_prosecdef, v_lanname
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_catalog.pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public' AND p.proname = 'sync_enrollment_timestamp_v1';

    IF v_fn_oid IS NULL THEN
        -- Create versioned function dynamically if absent
        EXECUTE $fn$
            CREATE FUNCTION public.sync_enrollment_timestamp_v1()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            SET search_path = ''
            AS $body$
            DECLARE
                v_now TIMESTAMPTZ;
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    IF NEW.enrollment_date IS NULL AND NEW.enrolled_at IS NULL THEN
                        v_now := pg_catalog.clock_timestamp();
                        NEW.enrollment_date := v_now;
                        NEW.enrolled_at := v_now;
                    ELSIF NEW.enrollment_date IS NOT NULL AND NEW.enrolled_at IS NULL THEN
                        NEW.enrolled_at := NEW.enrollment_date;
                    ELSIF NEW.enrolled_at IS NOT NULL AND NEW.enrollment_date IS NULL THEN
                        NEW.enrollment_date := NEW.enrolled_at;
                    ELSIF NEW.enrollment_date IS DISTINCT FROM NEW.enrolled_at THEN
                        NEW.enrolled_at := NEW.enrollment_date;
                    END IF;

                    IF NEW.created_at IS NULL THEN
                        NEW.created_at := pg_catalog.clock_timestamp();
                    END IF;
                    IF NEW.updated_at IS NULL THEN
                        NEW.updated_at := pg_catalog.clock_timestamp();
                    END IF;

                ELSIF TG_OP = 'UPDATE' THEN
                    IF NEW.enrollment_date IS NULL AND NEW.enrolled_at IS NULL THEN
                        NEW.enrollment_date := OLD.enrollment_date;
                        NEW.enrolled_at := OLD.enrolled_at;
                    ELSIF NEW.enrollment_date IS NULL THEN
                        NEW.enrollment_date := COALESCE(NEW.enrolled_at, OLD.enrollment_date);
                        NEW.enrolled_at := NEW.enrollment_date;
                    ELSIF NEW.enrolled_at IS NULL THEN
                        NEW.enrolled_at := COALESCE(NEW.enrollment_date, OLD.enrolled_at);
                        NEW.enrollment_date := NEW.enrolled_at;
                    ELSIF NEW.enrollment_date IS DISTINCT FROM OLD.enrollment_date AND NEW.enrolled_at IS NOT DISTINCT FROM OLD.enrolled_at THEN
                        NEW.enrolled_at := NEW.enrollment_date;
                    ELSIF NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at AND NEW.enrollment_date IS NOT DISTINCT FROM OLD.enrollment_date THEN
                        NEW.enrollment_date := NEW.enrolled_at;
                    ELSIF NEW.enrollment_date IS DISTINCT FROM OLD.enrollment_date AND NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at AND NEW.enrollment_date IS DISTINCT FROM NEW.enrolled_at THEN
                        NEW.enrolled_at := NEW.enrollment_date;
                    END IF;

                    NEW.created_at := OLD.created_at;
                    NEW.updated_at := pg_catalog.clock_timestamp();
                END IF;

                RETURN NEW;
            END;
            $body$;
        $fn$;
        RAISE NOTICE 'Created versioned function public.sync_enrollment_timestamp_v1().';
    ELSE
        -- Function exists: trustworthy verification of signature, security, and implementation
        IF v_prorettype <> 'pg_catalog.trigger'::regtype
           OR v_pronargs <> 0
           OR v_prosecdef <> false
           OR v_lanname <> 'plpgsql' THEN
            v_impl_verified := false;
        END IF;

        -- Normalize source whitespace and verify required PL/pgSQL logic structure
        v_src_norm := regexp_replace(regexp_replace(lower(v_src), '--[^\n]*', '', 'g'), '\s+', ' ', 'g');

        IF v_src_norm NOT LIKE '%tg_op = ''insert''%'
           OR v_src_norm NOT LIKE '%tg_op = ''update''%'
           OR v_src_norm NOT LIKE '%new.created_at := old.created_at%'
           OR (v_src_norm NOT LIKE '%new.updated_at := pg_catalog.clock_timestamp()%' AND v_src_norm NOT LIKE '%new.updated_at := clock_timestamp()%')
           OR v_src_norm NOT LIKE '%new.enrollment_date is null and new.enrolled_at is null%'
           OR v_src_norm NOT LIKE '%new.enrollment_date is not null and new.enrolled_at is null%'
           OR v_src_norm NOT LIKE '%new.enrolled_at is not null and new.enrollment_date is null%'
           OR v_src_norm NOT LIKE '%new.enrollment_date is distinct from new.enrolled_at%'
           OR v_src_norm NOT LIKE '%new.enrollment_date := old.enrollment_date%'
           OR v_src_norm NOT LIKE '%new.enrolled_at := old.enrolled_at%'
           OR v_src_norm NOT LIKE '%new.enrollment_date is distinct from old.enrollment_date%'
           OR v_src_norm NOT LIKE '%new.enrolled_at is distinct from old.enrolled_at%'
           OR v_src_norm NOT LIKE '%return new%' THEN
            v_impl_verified := false;
        END IF;

        IF NOT v_impl_verified THEN
            RAISE EXCEPTION 'Safety Violation: Function public.sync_enrollment_timestamp_v1() already exists with unexpected or unverified implementation. Aborting migration.',
                v_fn_oid USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;

        SELECT count(*) INTO v_other_tg_count
        FROM pg_catalog.pg_trigger
        WHERE tgfoid = v_fn_oid AND tgrelid <> 'public.enrollments_users'::regclass;

        IF v_other_tg_count > 0 THEN
            RAISE NOTICE 'Function public.sync_enrollment_timestamp_v1() is referenced by % other trigger(s); preserving implementation without replacement.', v_other_tg_count;
        ELSE
            RAISE NOTICE 'Function public.sync_enrollment_timestamp_v1() already exists with verified implementation; preserving.';
        END IF;
    END IF;

    -- Part B: Inspect target trigger on public.enrollments_users
    SELECT 
        true,
        t.tgname,
        c.relname,
        tnsp.nspname,
        p.proname,
        pnsp.nspname,
        p.pronargs,
        p.prorettype,
        t.tgtype,
        t.tgenabled,
        t.tgqual IS NULL,
        t.tgnargs,
        t.tgisinternal,
        t.tgconstraint,
        (t.tgattr = ''::int2vector OR cardinality(t.tgattr) = 0)
    INTO 
        v_tg_exists,
        v_tgname,
        v_relname,
        v_nspname,
        v_proname,
        v_pro_nspname,
        v_pronargs,
        v_prorettype,
        v_tgtype,
        v_tgenabled,
        v_has_no_when,
        v_tgnargs,
        v_tgisinternal,
        v_tgconstraint,
        v_has_no_attr_restriction
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON t.tgrelid = c.oid
    JOIN pg_catalog.pg_namespace tnsp ON c.relnamespace = tnsp.oid
    JOIN pg_catalog.pg_proc p ON t.tgfoid = p.oid
    JOIN pg_catalog.pg_namespace pnsp ON p.pronamespace = pnsp.oid
    WHERE t.tgrelid = 'public.enrollments_users'::regclass
      AND t.tgname = 'trg_sync_enrollment_timestamp'
      AND NOT t.tgisinternal;

    IF COALESCE(v_tg_exists, false) THEN
        -- Verify that existing trigger points to the verified versioned function
        IF v_pro_nspname <> 'public' OR v_proname <> 'sync_enrollment_timestamp_v1' THEN
            RAISE EXCEPTION 'Safety Violation: Trigger trg_sync_enrollment_timestamp exists on public.enrollments_users but references unexpected function %.% instead of public.sync_enrollment_timestamp_v1. Aborting migration.',
                v_pro_nspname, v_proname
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;

        -- Verify all 12 catalog properties for full compatibility:
        IF v_nspname = 'public'
           AND v_relname = 'enrollments_users'
           AND v_pronargs = 0
           AND v_prorettype = 'pg_catalog.trigger'::regtype
           AND (v_tgtype & 63) = 23 -- ROW (1) + BEFORE (2) + INSERT (4) + UPDATE (16)
           AND v_tgenabled IN ('O', 'A') -- Enabled
           AND v_has_no_when -- No WHEN condition (tgqual IS NULL)
           AND v_tgnargs = 0 -- No trigger arguments
           AND v_has_no_attr_restriction -- Fires on update of any column
           AND NOT v_tgisinternal -- Not an internal trigger
           AND v_tgconstraint = 0 -- Not a constraint trigger
           AND (v_tgtype & 128) = 0 THEN
            v_is_compatible := true;
        END IF;

        IF NOT v_is_compatible THEN
            RAISE EXCEPTION 'Safety Violation: Trigger trg_sync_enrollment_timestamp exists on public.enrollments_users with incompatible properties (tgtype: %, tgenabled: %, has_no_when: %, tgnargs: %, has_no_attr_restriction: %, tgisinternal: %, tgconstraint: %). Aborting migration.',
                v_tgtype, v_tgenabled, v_has_no_when, v_tgnargs, v_has_no_attr_restriction, v_tgisinternal, v_tgconstraint
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;

        RAISE NOTICE 'Trigger trg_sync_enrollment_timestamp on public.enrollments_users is already attached to verified versioned function public.sync_enrollment_timestamp_v1; preserving existing trigger.';
    ELSE
        -- Trigger does not exist: create it safely using the versioned function
        EXECUTE 'CREATE TRIGGER trg_sync_enrollment_timestamp '
             || 'BEFORE INSERT OR UPDATE ON public.enrollments_users '
             || 'FOR EACH ROW EXECUTE FUNCTION public.sync_enrollment_timestamp_v1()';
        RAISE NOTICE 'Created trigger trg_sync_enrollment_timestamp on public.enrollments_users executing public.sync_enrollment_timestamp_v1().';
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 6. EXACT CATALOG-BASED INDEX VERIFICATION & REDUNDANCY PROTECTION
-- Inspects pg_catalog.pg_index, pg_class, pg_am, pg_attribute, pg_opclass, and expressions.
-- Verifies:
--   - Correct table (public.enrollments_users)
--   - B-tree access method
--   - Exact key columns / expressions and ordering
--   - Sort direction (DESC for enrollment_date, ASC for others)
--   - Operator classes (text_ops, timestamptz_ops)
--   - Non-unique, no partial predicate (indpred IS NULL), no included columns
--   - Valid and ready state (indisvalid = true AND indisready = true)
-- Aborts if an index name exists with an incompatible definition.
-- Skips creation if an equivalent index already exists under an alternate name.
-- --------------------------------------------------------------------
DO $$
DECLARE
    v_idx_oid OID;
    v_am_name TEXT;
    v_is_unique BOOLEAN;
    v_nkeyatts INT;
    v_natts INT;
    v_has_pred BOOLEAN;
    v_is_valid BOOLEAN;
    v_is_ready BOOLEAN;
    v_att_name TEXT;
    v_indoption INT;
    v_indoption1 INT;
    v_indoption2 INT;
    v_opc1 TEXT;
    v_opc2 TEXT;
    v_expr1 TEXT;
    v_expr2 TEXT;
    v_clean_expr1 TEXT;
    v_clean_expr2 TEXT;
    v_existing_name TEXT;
BEGIN
    -- ----------------------------------------------------------------
    -- Index 1: idx_enrollments_users_email ON (student_email)
    -- Target: B-tree, 1 key att ('student_email'), text_ops, ASC, non-unique, no predicate
    -- ----------------------------------------------------------------
    SELECT 
        c.oid,
        am.amname,
        i.indisunique,
        i.indnkeyatts,
        i.indnatts,
        (i.indpred IS NOT NULL),
        i.indisvalid,
        i.indisready,
        att.attname,
        (i.indoption[0] & 1),
        op.opcname
    INTO 
        v_idx_oid,
        v_am_name,
        v_is_unique,
        v_nkeyatts,
        v_natts,
        v_has_pred,
        v_is_valid,
        v_is_ready,
        v_att_name,
        v_indoption,
        v_opc1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
    JOIN pg_catalog.pg_am am ON c.relam = am.oid
    LEFT JOIN pg_catalog.pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
    LEFT JOIN pg_catalog.pg_opclass op ON op.oid = i.indclass[0]
    WHERE i.indrelid = 'public.enrollments_users'::regclass
      AND c.relname = 'idx_enrollments_users_email';

    IF v_idx_oid IS NOT NULL THEN
        IF v_am_name <> 'btree'
           OR v_nkeyatts <> 1
           OR v_natts <> 1
           OR v_att_name <> 'student_email'
           OR v_indoption <> 0 -- ASC
           OR v_opc1 <> 'text_ops'
           OR v_is_unique <> false
           OR v_has_pred <> false
           OR v_is_valid <> true
           OR v_is_ready <> true THEN
            RAISE EXCEPTION 'Safety Violation: Index idx_enrollments_users_email exists with incompatible definition (am: %, keyatts: %, att: %, desc: %, opc: %, unique: %, pred: %, valid: %). Aborting migration.',
                v_am_name, v_nkeyatts, v_att_name, v_indoption, v_opc1, v_is_unique, v_has_pred, v_is_valid
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;
        RAISE NOTICE 'Index idx_enrollments_users_email already exists with verified definition; preserving.';
    ELSE
        -- Check if an equivalent usable index already exists under another name
        SELECT c.relname INTO v_existing_name
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
        JOIN pg_catalog.pg_am am ON c.relam = am.oid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
        JOIN pg_catalog.pg_opclass op ON op.oid = i.indclass[0]
        WHERE i.indrelid = 'public.enrollments_users'::regclass
          AND am.amname = 'btree'
          AND i.indnkeyatts = 1
          AND i.indnatts = 1
          AND i.indexprs IS NULL
          AND att.attname = 'student_email'
          AND (i.indoption[0] & 1) = 0
          AND op.opcname = 'text_ops'
          AND i.indpred IS NULL
          AND i.indisunique = false
          AND i.indisvalid = true
          AND i.indisready = true
        LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE NOTICE 'An equivalent index on student_email already exists under name "%"; skipping creation.', v_existing_name;
        ELSE
            EXECUTE 'CREATE INDEX idx_enrollments_users_email ON public.enrollments_users (student_email)';
            RAISE NOTICE 'Created index idx_enrollments_users_email on public.enrollments_users (student_email).';
        END IF;
    END IF;

    -- ----------------------------------------------------------------
    -- Index 2: idx_enrollments_users_course ON (course_id)
    -- Target: B-tree, 1 key att ('course_id'), text_ops, ASC, non-unique, no predicate
    -- ----------------------------------------------------------------
    SELECT 
        c.oid,
        am.amname,
        i.indisunique,
        i.indnkeyatts,
        i.indnatts,
        (i.indpred IS NOT NULL),
        i.indisvalid,
        i.indisready,
        att.attname,
        (i.indoption[0] & 1),
        op.opcname
    INTO 
        v_idx_oid,
        v_am_name,
        v_is_unique,
        v_nkeyatts,
        v_natts,
        v_has_pred,
        v_is_valid,
        v_is_ready,
        v_att_name,
        v_indoption,
        v_opc1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
    JOIN pg_catalog.pg_am am ON c.relam = am.oid
    LEFT JOIN pg_catalog.pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
    LEFT JOIN pg_catalog.pg_opclass op ON op.oid = i.indclass[0]
    WHERE i.indrelid = 'public.enrollments_users'::regclass
      AND c.relname = 'idx_enrollments_users_course';

    IF v_idx_oid IS NOT NULL THEN
        IF v_am_name <> 'btree'
           OR v_nkeyatts <> 1
           OR v_natts <> 1
           OR v_att_name <> 'course_id'
           OR v_indoption <> 0 -- ASC
           OR v_opc1 <> 'text_ops'
           OR v_is_unique <> false
           OR v_has_pred <> false
           OR v_is_valid <> true
           OR v_is_ready <> true THEN
            RAISE EXCEPTION 'Safety Violation: Index idx_enrollments_users_course exists with incompatible definition (am: %, keyatts: %, att: %, desc: %, opc: %, unique: %, pred: %, valid: %). Aborting migration.',
                v_am_name, v_nkeyatts, v_att_name, v_indoption, v_opc1, v_is_unique, v_has_pred, v_is_valid
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;
        RAISE NOTICE 'Index idx_enrollments_users_course already exists with verified definition; preserving.';
    ELSE
        SELECT c.relname INTO v_existing_name
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
        JOIN pg_catalog.pg_am am ON c.relam = am.oid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
        JOIN pg_catalog.pg_opclass op ON op.oid = i.indclass[0]
        WHERE i.indrelid = 'public.enrollments_users'::regclass
          AND am.amname = 'btree'
          AND i.indnkeyatts = 1
          AND i.indnatts = 1
          AND i.indexprs IS NULL
          AND att.attname = 'course_id'
          AND (i.indoption[0] & 1) = 0
          AND op.opcname = 'text_ops'
          AND i.indpred IS NULL
          AND i.indisvalid = true
          AND i.indisready = true
        LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE NOTICE 'An equivalent index on course_id already exists under name "%"; skipping creation.', v_existing_name;
        ELSE
            EXECUTE 'CREATE INDEX idx_enrollments_users_course ON public.enrollments_users (course_id)';
            RAISE NOTICE 'Created index idx_enrollments_users_course on public.enrollments_users (course_id).';
        END IF;
    END IF;

    -- ----------------------------------------------------------------
    -- Index 3: idx_enrollments_users_date ON (enrollment_date DESC)
    -- Target: B-tree, 1 key att ('enrollment_date'), timestamptz_ops, DESC, non-unique, no predicate
    -- ----------------------------------------------------------------
    SELECT 
        c.oid,
        am.amname,
        i.indisunique,
        i.indnkeyatts,
        i.indnatts,
        (i.indpred IS NOT NULL),
        i.indisvalid,
        i.indisready,
        att.attname,
        (i.indoption[0] & 1),
        op.opcname
    INTO 
        v_idx_oid,
        v_am_name,
        v_is_unique,
        v_nkeyatts,
        v_natts,
        v_has_pred,
        v_is_valid,
        v_is_ready,
        v_att_name,
        v_indoption,
        v_opc1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
    JOIN pg_catalog.pg_am am ON c.relam = am.oid
    LEFT JOIN pg_catalog.pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
    LEFT JOIN pg_catalog.pg_opclass op ON op.oid = i.indclass[0]
    WHERE i.indrelid = 'public.enrollments_users'::regclass
      AND c.relname = 'idx_enrollments_users_date';

    IF v_idx_oid IS NOT NULL THEN
        IF v_am_name <> 'btree'
           OR v_nkeyatts <> 1
           OR v_natts <> 1
           OR v_att_name <> 'enrollment_date'
           OR v_indoption <> 1 -- DESC (indoption & 1 = 1)
           OR v_opc1 <> 'timestamptz_ops'
           OR v_is_unique <> false
           OR v_has_pred <> false
           OR v_is_valid <> true
           OR v_is_ready <> true THEN
            RAISE EXCEPTION 'Safety Violation: Index idx_enrollments_users_date exists with incompatible definition (am: %, keyatts: %, att: %, desc: %, opc: %, unique: %, pred: %, valid: %). Aborting migration.',
                v_am_name, v_nkeyatts, v_att_name, v_indoption, v_opc1, v_is_unique, v_has_pred, v_is_valid
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;
        RAISE NOTICE 'Index idx_enrollments_users_date already exists with verified definition; preserving.';
    ELSE
        SELECT c.relname INTO v_existing_name
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
        JOIN pg_catalog.pg_am am ON c.relam = am.oid
        JOIN pg_catalog.pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = i.indkey[0]
        JOIN pg_catalog.pg_opclass op ON op.oid = i.indclass[0]
        WHERE i.indrelid = 'public.enrollments_users'::regclass
          AND am.amname = 'btree'
          AND i.indnkeyatts = 1
          AND i.indnatts = 1
          AND i.indexprs IS NULL
          AND att.attname = 'enrollment_date'
          AND (i.indoption[0] & 1) = 1 -- DESC
          AND op.opcname = 'timestamptz_ops'
          AND i.indpred IS NULL
          AND i.indisvalid = true
          AND i.indisready = true
        LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE NOTICE 'An equivalent index on enrollment_date DESC already exists under name "%"; skipping creation.', v_existing_name;
        ELSE
            EXECUTE 'CREATE INDEX idx_enrollments_users_date ON public.enrollments_users (enrollment_date DESC)';
            RAISE NOTICE 'Created index idx_enrollments_users_date on public.enrollments_users (enrollment_date DESC).';
        END IF;
    END IF;

    -- ----------------------------------------------------------------
    -- Index 4: idx_enrollments_users_normalized ON (lower(btrim(student_email)), normalize_course_id(course_id))
    -- Target: B-tree, 2 key expressions in exact order, text_ops for both, ASC, non-unique, no predicate, no included columns
    -- ----------------------------------------------------------------
    SELECT 
        c.oid,
        am.amname,
        i.indisunique,
        i.indnkeyatts,
        i.indnatts,
        (i.indpred IS NOT NULL),
        i.indisvalid,
        i.indisready,
        (i.indoption[0] & 1),
        (i.indoption[1] & 1),
        op1.opcname,
        op2.opcname,
        pg_catalog.pg_get_indexdef(c.oid, 1, false),
        pg_catalog.pg_get_indexdef(c.oid, 2, false)
    INTO 
        v_idx_oid,
        v_am_name,
        v_is_unique,
        v_nkeyatts,
        v_natts,
        v_has_pred,
        v_is_valid,
        v_is_ready,
        v_indoption1,
        v_indoption2,
        v_opc1,
        v_opc2,
        v_expr1,
        v_expr2
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
    JOIN pg_catalog.pg_am am ON c.relam = am.oid
    LEFT JOIN pg_catalog.pg_opclass op1 ON op1.oid = i.indclass[0]
    LEFT JOIN pg_catalog.pg_opclass op2 ON op2.oid = i.indclass[1]
    WHERE i.indrelid = 'public.enrollments_users'::regclass
      AND c.relname = 'idx_enrollments_users_normalized';

    IF v_idx_oid IS NOT NULL THEN
        -- Normalize expressions for comparison
        v_clean_expr1 := regexp_replace(regexp_replace(lower(COALESCE(v_expr1, '')), 'pg_catalog\.', '', 'g'), '\s+', '', 'g');
        v_clean_expr2 := regexp_replace(regexp_replace(regexp_replace(lower(COALESCE(v_expr2, '')), 'pg_catalog\.', '', 'g'), 'public\.', '', 'g'), '\s+', '', 'g');

        IF v_am_name <> 'btree'
           OR v_nkeyatts <> 2
           OR v_natts <> 2
           OR v_is_unique <> false
           OR v_has_pred <> false
           OR v_is_valid <> true
           OR v_is_ready <> true
           OR v_indoption1 <> 0 -- ASC
           OR v_indoption2 <> 0 -- ASC
           OR v_opc1 <> 'text_ops'
           OR v_opc2 <> 'text_ops'
           OR v_clean_expr1 NOT IN ('lower(btrim(student_email))', 'lower(btrim((student_email)::text))')
           OR v_clean_expr2 NOT IN ('normalize_course_id(course_id)', 'normalize_course_id((course_id)::text)') THEN
            RAISE EXCEPTION 'Safety Violation: Index idx_enrollments_users_normalized exists with incompatible definition (am: %, keyatts: %, expr1: %, expr2: %, unique: %, pred: %, valid: %). Aborting migration.',
                v_am_name, v_nkeyatts, v_expr1, v_expr2, v_is_unique, v_has_pred, v_is_valid
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;
        RAISE NOTICE 'Index idx_enrollments_users_normalized already exists with verified definition; preserving.';
    ELSE
        -- Check if an equivalent usable index already exists under another name
        SELECT c.relname INTO v_existing_name
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON i.indexrelid = c.oid
        JOIN pg_catalog.pg_am am ON c.relam = am.oid
        LEFT JOIN pg_catalog.pg_opclass op1 ON op1.oid = i.indclass[0]
        LEFT JOIN pg_catalog.pg_opclass op2 ON op2.oid = i.indclass[1]
        WHERE i.indrelid = 'public.enrollments_users'::regclass
          AND am.amname = 'btree'
          AND i.indnkeyatts = 2
          AND i.indnatts = 2
          AND i.indexprs IS NOT NULL
          AND i.indpred IS NULL
          AND i.indisunique = false
          AND i.indisvalid = true
          AND i.indisready = true
          AND (i.indoption[0] & 1) = 0
          AND (i.indoption[1] & 1) = 0
          AND op1.opcname = 'text_ops'
          AND op2.opcname = 'text_ops'
          AND regexp_replace(regexp_replace(lower(pg_catalog.pg_get_indexdef(c.oid, 1, false)), 'pg_catalog\.', '', 'g'), '\s+', '', 'g')
              IN ('lower(btrim(student_email))', 'lower(btrim((student_email)::text))')
          AND regexp_replace(regexp_replace(regexp_replace(lower(pg_catalog.pg_get_indexdef(c.oid, 2, false)), 'pg_catalog\.', '', 'g'), 'public\.', '', 'g'), '\s+', '', 'g')
              IN ('normalize_course_id(course_id)', 'normalize_course_id((course_id)::text)')
        LIMIT 1;

        IF v_existing_name IS NOT NULL THEN
            RAISE NOTICE 'An equivalent composite normalized index already exists under name "%"; skipping creation.', v_existing_name;
        ELSE
            EXECUTE 'CREATE INDEX idx_enrollments_users_normalized '
                 || 'ON public.enrollments_users ('
                 || 'pg_catalog.lower(pg_catalog.btrim(student_email)), '
                 || 'public.normalize_course_id(course_id))';
            RAISE NOTICE 'Created index idx_enrollments_users_normalized on public.enrollments_users.';
        END IF;
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 7. FUNCTION PRIVILEGES & LEAST-PRIVILEGE SECURITY
-- Explicitly revokes default PUBLIC execution. Grants EXECUTE strictly
-- to verified application caller roles (authenticated, service_role).
-- Trigger function is restricted strictly to service_role.
-- --------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.normalize_course_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_course_id(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_course_title(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_course_title(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.sync_enrollment_timestamp_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_enrollment_timestamp_v1() TO service_role;

COMMIT;
