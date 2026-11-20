-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM — MIGRATION V1.1
-- Document Phase: Phase 1 — Google Forms Webhook Ingestion & Idempotency
-- Target Database: Supabase / PostgreSQL 15+
-- Authoritative Specifications:
--   - docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md
--   - docs/COURSE_APPLICATION_GOOGLE_FORMS_WEBHOOK_SPECIFICATION.md
--
-- Instructions: [MANUAL — YOU MUST DO THIS IN STAGING SQL EDITOR]
--   Execute this script in the Supabase Dashboard SQL Editor for Staging
--   Project: neexbpcvedcfwjxpgede
--
-- Safety Notice:
--   - Idempotent and non-destructive.
--   - Preserves all existing course application and enrollment records.
--   - Rollback instructions provided at the end of this script.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. PRECONDITION CHECKS
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'course_applications'
    ) THEN
        RAISE EXCEPTION 'Precondition Failed: public.course_applications does not exist. Execute v1.0 migration first.'
            USING ERRCODE = 'undefined_table';
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. ADD COLUMNS FOR GOOGLE FORMS INGESTION
-- --------------------------------------------------------------------

-- External submission identifier (e.g. Google Forms response ID: 2_ABaOnuc...)
-- Used for strict idempotency to prevent duplicate applications upon webhook retries.
ALTER TABLE public.course_applications
ADD COLUMN IF NOT EXISTS external_submission_id TEXT;

-- Ingestion source tracking ('web', 'google_forms', 'manual_import')
ALTER TABLE public.course_applications
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

-- Enforce valid source values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_course_applications_source'
    ) THEN
        ALTER TABLE public.course_applications
        ADD CONSTRAINT chk_course_applications_source
        CHECK (source IN ('web', 'google_forms', 'manual_import'));
    END IF;
END $$;

-- --------------------------------------------------------------------
-- 3. INDEXES FOR PERFORMANCE & IDEMPOTENCY
-- --------------------------------------------------------------------

-- Partial unique index: guarantees no two applications share the same external submission ID
-- (Allows multiple NULLs for legacy/web applications without an external ID)
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_applications_external_submission_id
ON public.course_applications (external_submission_id)
WHERE external_submission_id IS NOT NULL;

-- Source index for operational queries and auditing
CREATE INDEX IF NOT EXISTS idx_course_applications_source
ON public.course_applications (source);

-- --------------------------------------------------------------------
-- 4. UPDATE SECURITY-INVOKER VIEW FOR CANDIDATE APPLICATIONS
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS public.candidate_course_applications;
CREATE OR REPLACE VIEW public.candidate_course_applications
WITH (security_invoker = true)
AS
SELECT
    id,
    application_number,
    user_id,
    course_id,
    student_name,
    student_email,
    student_phone,
    academic_background,
    statement_of_purpose,
    status,
    payment_status,
    payment_amount_inr,
    documents_status,
    source,
    external_submission_id,
    rejection_reason,
    resubmission_notes,
    submitted_at,
    approved_at,
    enrolled_at,
    rejected_at,
    created_at,
    updated_at
FROM public.course_applications;

GRANT SELECT ON public.candidate_course_applications TO authenticated;

COMMIT;

-- ====================================================================
-- ROLLBACK GUIDANCE (IF REVERT IS REQUIRED):
--
-- BEGIN;
-- DROP VIEW IF EXISTS public.candidate_course_applications;
-- -- Re-create candidate view without source/external_submission_id
-- DROP INDEX IF EXISTS public.idx_course_applications_external_submission_id;
-- DROP INDEX IF EXISTS public.idx_course_applications_source;
-- ALTER TABLE public.course_applications DROP CONSTRAINT IF EXISTS chk_course_applications_source;
-- ALTER TABLE public.course_applications DROP COLUMN IF EXISTS source;
-- ALTER TABLE public.course_applications DROP COLUMN IF EXISTS external_submission_id;
-- COMMIT;
-- ====================================================================
