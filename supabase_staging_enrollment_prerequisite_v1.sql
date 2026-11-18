-- ====================================================================
-- PATHFINDER STAGING PREREQUISITE MIGRATION V1.4
-- Purpose: Safely provision missing foundational courses and enrollment
--          tables in the Staging Supabase environment (neexbpcvedcfwjxpgede)
--          WITHOUT touching or impacting existing Spin Wheel objects.
--
-- Authoritative Schema Alignment:
--   - docs/BACKEND_SUPABASE_SETUP.md (Section 2 & Section 4)
--   - docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md (Version 1.7.0, DEC-01 & DEC-03)
--   - src/lib/courses/course-identifiers.ts (Centralized Canonical Normalization)
--   - src/lib/courses/store.ts (LISTING_COLUMNS & mapDbToFull)
--   - src/routes/admin/enrollments.tsx & src/routes/dashboard/courses.tsx
--   - supabase_course_applications_v1_migration.sql (Triggers & RPCs)
--
-- Safety Guarantees:
--   - Idempotent and non-destructive: uses IF NOT EXISTS, column-level additions,
--     and conditional backfills.
--   - Reconciles both 'enrollment_date' and 'enrolled_at' columns with genuine NOT NULL
--     enforcement and trigger-managed initialization (no default-overwrite race).
--   - Handles legacy tables having only (id, student_email, course_id, enrolled_at).
--   - Preserves TEXT course IDs and public.enrollments_users architecture.
--   - Centralized normalize_course_id() and resolve_course_title() functions provide
--     100% seamless resolution between legacy IDs, slugs, and canonical UUIDs
--     WITHOUT silently rewriting historical enrollment records.
--   - Strictly non-destructive to spin_wheel_entries, spin_admin_audit_logs,
--     spin_webhook_logs, profile, users, and spin RPCs.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 0. PREREQUISITES & EXTENSIONS
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. COURSES TABLE & COLUMN-LEVEL UPGRADE SAFEGUARD
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    short_description TEXT,
    full_description TEXT,
    category TEXT,
    duration TEXT DEFAULT '30 Days',
    thumbnail TEXT,
    cover_image TEXT,
    mode TEXT DEFAULT 'Online',
    program_fee TEXT DEFAULT '₹1999',
    difficulty TEXT DEFAULT 'intermediate',
    certificate TEXT DEFAULT 'Certificate of Completion',
    learning_outcomes JSONB DEFAULT '[]'::jsonb,
    curriculum TEXT,
    requirements TEXT,
    who_should_join TEXT,
    faqs TEXT,
    seo_title TEXT,
    seo_description TEXT,
    status TEXT DEFAULT 'published' CHECK (status IN ('published', 'draft')),
    featured BOOLEAN DEFAULT false,
    content JSONB,
    apply_url TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Upgrade existing courses table if it was created previously with missing columns
DO $$
BEGIN
    IF to_regclass('public.courses') IS NOT NULL THEN
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS short_description TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS full_description TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'intermediate';
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS certificate TEXT DEFAULT 'Certificate of Completion';
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS learning_outcomes JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS curriculum TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS requirements TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS who_should_join TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS faqs TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS seo_title TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS seo_description TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS apply_url TEXT;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
        ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
    END IF;
END $$;

-- Seed authoritative published courses
-- IDs are the canonical deterministic course identifiers matching both TEXT and UUID formats (DEC-01)
INSERT INTO public.courses (
    id, slug, title, short_description, full_description, category, duration, mode, program_fee, difficulty, status, featured
) VALUES
(
    'd2756643-0b82-4ebe-a123-9fa3be97bd13',
    'bioplastic-innovation',
    'BioPlastic Innovation',
    'A 30-day intensive online research internship mastering biodegradable materials from first principles to commercialization.',
    'Comprehensive 30-day curriculum covering biopolymer synthesis, PHA/PLA extraction, characterization, and commercial scale-up.',
    'Biotechnology',
    '30 Days',
    'Online',
    '₹1999',
    'intermediate',
    'published',
    true
),
(
    'd6a21b1f-2682-4cf2-a83d-2c030f476625',
    'ai-in-drug-discovery',
    'AI in Drug Discovery',
    'A 30-day online research internship introducing AI-powered drug discovery through bioinformatics, ML, and computational biology.',
    'Hands-on machine learning applications in molecular docking, QSAR modeling, virtual screening, and candidate validation.',
    'Bioinformatics',
    '30 Days',
    'Online',
    '₹1999',
    'intermediate',
    'published',
    true
),
(
    '840fed84-696d-458e-aeee-2df6b88d3428',
    'bioinformatics',
    'Bioinformatics & Genomic Data Analysis',
    'A 30-Day Research Project in Bioinformatics, Computational Biology & Genomic Data Analysis.',
    'Core computational genomics pipeline covering Next-Gen Sequencing (NGS), RNA-seq analysis, variant calling, and pathway enrichment.',
    'Biotechnology',
    '30 Days',
    'Online',
    '₹1999',
    'intermediate',
    'published',
    true
)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    short_description = EXCLUDED.short_description,
    full_description = EXCLUDED.full_description,
    category = EXCLUDED.category,
    duration = EXCLUDED.duration,
    mode = EXCLUDED.mode,
    program_fee = EXCLUDED.program_fee,
    difficulty = EXCLUDED.difficulty,
    status = EXCLUDED.status,
    featured = EXCLUDED.featured,
    updated_at = clock_timestamp();

CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses (status);

-- --------------------------------------------------------------------
-- 1.1 CENTRALIZED COURSE IDENTIFIER NORMALIZATION FUNCTION
-- Maps any recognized course alias (legacy 'course-*' ID, slug, or UUID)
-- to its authoritative canonical UUID. Preserves unknown IDs as trimmed lowercase.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_course_id(p_course_id TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE lower(btrim(COALESCE(p_course_id, '')))
        -- BioPlastic Innovation
        WHEN 'course-bioplastic-innovation' THEN 'd2756643-0b82-4ebe-a123-9fa3be97bd13'
        WHEN 'bioplastic-innovation' THEN 'd2756643-0b82-4ebe-a123-9fa3be97bd13'
        WHEN 'd2756643-0b82-4ebe-a123-9fa3be97bd13' THEN 'd2756643-0b82-4ebe-a123-9fa3be97bd13'

        -- AI in Drug Discovery
        WHEN 'course-ai-drug-discovery' THEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625'
        WHEN 'course-ai-in-drug-discovery' THEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625'
        WHEN 'ai-in-drug-discovery' THEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625'
        WHEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625' THEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625'

        -- Bioinformatics & Genomic Data Analysis
        WHEN 'course-bioinformatics' THEN '840fed84-696d-458e-aeee-2df6b88d3428'
        WHEN 'bioinformatics' THEN '840fed84-696d-458e-aeee-2df6b88d3428'
        WHEN 'bioinformatics-frontend-seed' THEN '840fed84-696d-458e-aeee-2df6b88d3428'
        WHEN '840fed84-696d-458e-aeee-2df6b88d3428' THEN '840fed84-696d-458e-aeee-2df6b88d3428'

        ELSE lower(btrim(COALESCE(p_course_id, '')))
    END;
$$;

-- --------------------------------------------------------------------
-- 1.2 CENTRALIZED COURSE TITLE RESOLUTION FUNCTION
-- Resolves the authoritative course display title for any course identifier.
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_course_title(p_course_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT CASE public.normalize_course_id(p_course_id)
        WHEN 'd2756643-0b82-4ebe-a123-9fa3be97bd13' THEN 'BioPlastic Innovation'
        WHEN 'd6a21b1f-2682-4cf2-a83d-2c030f476625' THEN 'AI in Drug Discovery'
        WHEN '840fed84-696d-458e-aeee-2df6b88d3428' THEN 'Bioinformatics & Genomic Data Analysis'
        ELSE (SELECT title FROM public.courses WHERE id = p_course_id OR slug = p_course_id LIMIT 1)
    END;
$$;

-- --------------------------------------------------------------------
-- 2. ENROLLMENTS TABLE (public.enrollments_users)
-- Reconciles enrollment_date (used by active frontend & migration) and
-- enrolled_at (used by early setup documentation) for 100% compatibility.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name TEXT,
    student_email TEXT NOT NULL,
    course_id TEXT NOT NULL,
    enrollment_date TIMESTAMPTZ NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Upgrade existing table if it was created previously with only legacy columns
DO $$
BEGIN
    IF to_regclass('public.enrollments_users') IS NOT NULL THEN
        -- Step 1: Ensure all referenced columns exist before backfilling
        ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS student_name TEXT;
        ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMPTZ;
        ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;
        ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT clock_timestamp();
        ALTER TABLE public.enrollments_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT clock_timestamp();

        -- Step 2: Safe backfill across legacy rows without overwriting valid timestamps
        UPDATE public.enrollments_users
        SET enrollment_date = COALESCE(enrollment_date, enrolled_at, created_at, clock_timestamp()),
            enrolled_at = COALESCE(enrolled_at, enrollment_date, created_at, clock_timestamp())
        WHERE enrollment_date IS NULL OR enrolled_at IS NULL;

        UPDATE public.enrollments_users
        SET created_at = COALESCE(created_at, enrollment_date, enrolled_at, clock_timestamp()),
            updated_at = COALESCE(updated_at, enrollment_date, enrolled_at, clock_timestamp())
        WHERE created_at IS NULL OR updated_at IS NULL;

        -- Step 3: Enforce NOT NULL constraints on both timestamp columns
        ALTER TABLE public.enrollments_users ALTER COLUMN enrollment_date SET NOT NULL;
        ALTER TABLE public.enrollments_users ALTER COLUMN enrolled_at SET NOT NULL;

        -- Step 4: Drop any column-level defaults so trigger controls synchronization cleanly
        ALTER TABLE public.enrollments_users ALTER COLUMN enrollment_date DROP DEFAULT;
        ALTER TABLE public.enrollments_users ALTER COLUMN enrolled_at DROP DEFAULT;
    END IF;
END $$;

-- Robust, bidirectional timestamp synchronization trigger function for INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.sync_enrollment_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_now TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Case 1: Neither timestamp supplied -> both receive the EXACT same clock_timestamp()
        IF NEW.enrollment_date IS NULL AND NEW.enrolled_at IS NULL THEN
            v_now := clock_timestamp();
            NEW.enrollment_date := v_now;
            NEW.enrolled_at := v_now;

        -- Case 2: Only enrollment_date supplied -> enrolled_at receives enrollment_date
        ELSIF NEW.enrollment_date IS NOT NULL AND NEW.enrolled_at IS NULL THEN
            NEW.enrolled_at := NEW.enrollment_date;

        -- Case 3: Only enrolled_at supplied -> enrollment_date receives enrolled_at
        ELSIF NEW.enrolled_at IS NOT NULL AND NEW.enrollment_date IS NULL THEN
            NEW.enrollment_date := NEW.enrolled_at;

        -- Case 4: Both supplied with different values -> prioritize enrollment_date (active standard)
        ELSIF NEW.enrollment_date IS DISTINCT FROM NEW.enrolled_at THEN
            NEW.enrolled_at := NEW.enrollment_date;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Prevent setting either or both timestamps to NULL
        IF NEW.enrollment_date IS NULL AND NEW.enrolled_at IS NULL THEN
            NEW.enrollment_date := OLD.enrollment_date;
            NEW.enrolled_at := OLD.enrolled_at;
        ELSIF NEW.enrollment_date IS NULL THEN
            NEW.enrollment_date := COALESCE(NEW.enrolled_at, OLD.enrollment_date);
            NEW.enrolled_at := NEW.enrollment_date;
        ELSIF NEW.enrolled_at IS NULL THEN
            NEW.enrolled_at := COALESCE(NEW.enrollment_date, OLD.enrolled_at);
            NEW.enrollment_date := NEW.enrolled_at;
        -- If enrollment_date was explicitly changed, propagate to enrolled_at
        ELSIF NEW.enrollment_date IS DISTINCT FROM OLD.enrollment_date AND NEW.enrolled_at IS NOT DISTINCT FROM OLD.enrolled_at THEN
            NEW.enrolled_at := NEW.enrollment_date;
        -- If enrolled_at was explicitly changed, propagate to enrollment_date
        ELSIF NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at AND NEW.enrollment_date IS NOT DISTINCT FROM OLD.enrollment_date THEN
            NEW.enrollment_date := NEW.enrolled_at;
        -- If both were changed to differing values, prioritize enrollment_date (the active standard)
        ELSIF NEW.enrollment_date IS DISTINCT FROM OLD.enrollment_date AND NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at AND NEW.enrollment_date IS DISTINCT FROM NEW.enrolled_at THEN
            NEW.enrolled_at := NEW.enrollment_date;
        END IF;
    END IF;

    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollment_timestamp ON public.enrollments_users;
CREATE TRIGGER trg_sync_enrollment_timestamp
    BEFORE INSERT OR UPDATE ON public.enrollments_users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_enrollment_timestamp();

CREATE INDEX IF NOT EXISTS idx_enrollments_users_email ON public.enrollments_users (lower(btrim(student_email)));
CREATE INDEX IF NOT EXISTS idx_enrollments_users_course ON public.enrollments_users (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_users_date ON public.enrollments_users (enrollment_date DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_users_normalized ON public.enrollments_users (
    lower(btrim(student_email)),
    public.normalize_course_id(course_id)
);

-- --------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) FOR PREREQUISITE TABLES
-- --------------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments_users ENABLE ROW LEVEL SECURITY;

-- Courses: Anyone can read published courses
DROP POLICY IF EXISTS "courses_read_published" ON public.courses;
CREATE POLICY "courses_read_published"
    ON public.courses FOR SELECT
    USING (status = 'published');

-- Courses: Service role full access
DROP POLICY IF EXISTS "courses_service_role" ON public.courses;
CREATE POLICY "courses_service_role"
    ON public.courses FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Enrollments: Students read own enrollments (normalized email check)
DROP POLICY IF EXISTS "enrollments_users_student_read" ON public.enrollments_users;
CREATE POLICY "enrollments_users_student_read"
    ON public.enrollments_users FOR SELECT
    TO authenticated
    USING (
        lower(pg_catalog.btrim(student_email)) = lower(pg_catalog.btrim(auth.jwt() ->> 'email'))
    );

-- Enrollments: Admins read all enrollments (checks app_metadata role and profile role)
DROP POLICY IF EXISTS "enrollments_users_admin_read" ON public.enrollments_users;
CREATE POLICY "enrollments_users_admin_read"
    ON public.enrollments_users FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profile
            WHERE id = auth.uid() AND lower(role) IN ('admin', 'super_admin')
        )
    );

-- Enrollments: Service role full access (required for RPCs and workers)
DROP POLICY IF EXISTS "enrollments_users_service_role" ON public.enrollments_users;
CREATE POLICY "enrollments_users_service_role"
    ON public.enrollments_users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Explicit table grants for authenticated and service_role
GRANT SELECT ON TABLE public.courses TO authenticated, anon;
GRANT ALL ON TABLE public.courses TO service_role;

GRANT SELECT ON TABLE public.enrollments_users TO authenticated;
GRANT ALL ON TABLE public.enrollments_users TO service_role;

-- Function execution grants
GRANT EXECUTE ON FUNCTION public.normalize_course_id(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_course_title(TEXT) TO authenticated, anon, service_role;

COMMIT;
