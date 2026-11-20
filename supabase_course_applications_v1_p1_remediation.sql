-- ====================================================================
-- PATHFINDER COURSE APPLICATIONS — REMEDIATION V1.2 (P0 & P1)
-- Environment: Staging Supabase (neexbpcvedcfwjxpgede)
-- Production Reference (knrmfpgwcdtpwcgkjrnk): STRICTLY PROHIBITED
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. ENROLLMENT UNIQUENESS GUARANTEE (P1-D)
-- Enforces concurrency-safe single active enrollment per student per course
-- Checked against staging: 4 existing records, 0 conflicts detected.
-- --------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_users_unique_student_course
ON public.enrollments_users (lower(btrim(student_email)), course_id);

-- --------------------------------------------------------------------
-- 2. COURSE APPLICATIONS ACTIVE UNIQUENESS GUARANTEE (P1-A)
-- [STATUS: MIGRATION APPLICATION PAUSED PER SAFETY DIRECTIVE]
-- Pre-migration data inspection detected 1 pre-existing duplicate pair in staging:
--   - Record 1: ID 4e32c44f-9388-4a19-8da8-d5a6e68a1c69 (APP-2026-01002, submitted)
--   - Record 2: ID a254b439-1abe-4e50-a4d5-254db52f704f (APP-2026-01003, submitted)
--   - Identity: staging-student-auth-1794758420317@example.com, course d6a21b1f-2682-4cf2-a83d-2c030f476625
-- Per strict user rules: Do not delete or merge records.
-- Application-level duplicate rejection is active in submitCourseApplicationCore.
-- Once the user authorizes reconciliation of APP-2026-01002 / APP-2026-01003, apply:
--
-- CREATE UNIQUE INDEX idx_course_app_unique_active_email
-- ON public.course_applications (lower(btrim(student_email)), course_id)
-- WHERE status IN ('submitted', 'under_review', 'resubmission_required', 'resubmitted', 'approved', 'enrolled');
-- --------------------------------------------------------------------

COMMIT;
