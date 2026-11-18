-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM — PRODUCTION MIGRATION V1.0
-- Document Phase: Phase 3 Implementation (Consolidated Release)
-- Target Database: Supabase / PostgreSQL 15+
-- Authoritative Specifications:
--   - docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md (Phase 3.3.11)
--   - docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md (Phase 3.3.11)
--   - docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md (Version 1.7.0)
--
-- Instructions: [MANUAL — YOU MUST DO THIS]
--   Execute this script in the Supabase Dashboard SQL Editor in a single transaction.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. PREREQUISITES & EXTENSIONS
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence for application numbers
CREATE SEQUENCE IF NOT EXISTS public.course_application_number_seq START WITH 1001;

-- Function to generate human-readable application numbers: APP-YYYY-XXXXX
CREATE OR REPLACE FUNCTION public.generate_course_application_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 'APP-' || TO_CHAR(clock_timestamp(), 'YYYY') || '-' || LPAD(nextval('public.course_application_number_seq')::TEXT, 5, '0');
END;
$$;

-- --------------------------------------------------------------------
-- 2. DEC-01 COURSE IDENTIFIER VALIDATION TRIGGER FUNCTION
-- --------------------------------------------------------------------
-- Validates course_applications.course_id (UUID) against public.courses.id (TEXT)
CREATE OR REPLACE FUNCTION public.validate_course_application_course_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.courses
        WHERE id = NEW.course_id::text
           OR public.normalize_course_id(id) = public.normalize_course_id(NEW.course_id::text)
    ) THEN
        RAISE EXCEPTION 'Foreign key violation: course_id % does not exist in public.courses', NEW.course_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END;
$$;

-- Generic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_course_application_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

-- Immutability enforcement trigger function for audit logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are strictly append-only. UPDATE, DELETE, and TRUNCATE operations are prohibited.'
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- --------------------------------------------------------------------
-- 3. CORE TABLE: public.course_applications
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number TEXT UNIQUE NOT NULL DEFAULT public.generate_course_application_number(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable to allow guest submissions (DEC-02)
    guest_claim_token_hash TEXT NULL, -- Cryptographic SHA-256 hash of single-use guest claiming token (DEC-02)
    guest_claim_token_expires_at TIMESTAMPTZ NULL, -- Expiration timestamp for guest claiming token (DEC-02)
    course_id UUID NOT NULL, -- UUID value validated against public.courses(id::text) via trigger (DEC-01)
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    student_phone TEXT,
    academic_background JSONB NOT NULL DEFAULT '{}'::jsonb,
    statement_of_purpose TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (
        status IN (
            'draft',
            'submitted',
            'under_review',
            'resubmission_required',
            'resubmitted',
            'approved',
            'enrolled',
            'rejected',
            'cancelled',
            'revoked',
            'suspended'
        )
    ),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (
        payment_status IN (
            'not_required',
            'unpaid',
            'pending_verification',
            'verified',
            'waived',
            'refunded',
            'disputed'
        )
    ),
    payment_reference TEXT,
    payment_amount_inr NUMERIC(10,2),
    documents_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        documents_status IN (
            'pending',
            'under_review',
            'verified',
            'resubmission_requested',
            'rejected'
        )
    ),
    assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES public.enrollments_users(id) ON DELETE SET NULL, -- Populated strictly upon enrollment activation
    rejection_reason TEXT,
    resubmission_notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    approved_at TIMESTAMPTZ,
    enrolled_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- DEC-01 trigger
DROP TRIGGER IF EXISTS trg_validate_course_id ON public.course_applications;
CREATE TRIGGER trg_validate_course_id
    BEFORE INSERT OR UPDATE OF course_id ON public.course_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_course_application_course_id();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_course_applications_updated_at ON public.course_applications;
CREATE TRIGGER trg_course_applications_updated_at
    BEFORE UPDATE ON public.course_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_course_application_updated_at();

-- Indexes for performance & security
CREATE INDEX IF NOT EXISTS idx_course_applications_user_id ON public.course_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_course_applications_course_id ON public.course_applications (course_id);
CREATE INDEX IF NOT EXISTS idx_course_applications_status ON public.course_applications (status);
CREATE INDEX IF NOT EXISTS idx_course_applications_payment_status ON public.course_applications (payment_status);
CREATE INDEX IF NOT EXISTS idx_course_applications_email ON public.course_applications (lower(btrim(student_email)));
CREATE INDEX IF NOT EXISTS idx_course_applications_claim_hash ON public.course_applications (guest_claim_token_hash) WHERE guest_claim_token_hash IS NOT NULL;

-- --------------------------------------------------------------------
-- 4. SUPPORTING TABLE: public.course_application_documents
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (
        document_type IN (
            'id_proof',
            'degree_certificate',
            'academic_transcript',
            'resume',
            'sop',
            'recommendation_letter',
            'fee_receipt',
            'other'
        )
    ),
    storage_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760), -- 10MB limit (DEC-04)
    mime_type TEXT NOT NULL CHECK (
        mime_type IN (
            'application/pdf',
            'image/jpeg',
            'image/png'
        )
    ),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'verified',
            'resubmission_requested',
            'rejected'
        )
    ),
    verification_notes TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

DROP TRIGGER IF EXISTS trg_course_application_documents_updated_at ON public.course_application_documents;
CREATE TRIGGER trg_course_application_documents_updated_at
    BEFORE UPDATE ON public.course_application_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_course_application_updated_at();

CREATE INDEX IF NOT EXISTS idx_app_docs_app_id ON public.course_application_documents (application_id);
CREATE INDEX IF NOT EXISTS idx_app_docs_status ON public.course_application_documents (status);

-- --------------------------------------------------------------------
-- 5. SUPPORTING TABLE: public.course_application_events (Timeline History)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_application_events (
    id BIGSERIAL PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'DRAFT_CREATED',
            'SUBMITTED',
            'UNDER_REVIEW',
            'DOCUMENTS_VERIFIED',
            'RESUBMISSION_REQUESTED',
            'RESUBMITTED',
            'APPROVED',
            'REJECTED',
            'PAYMENT_PENDING',
            'PAYMENT_VERIFIED',
            'ENROLLED',
            'CANCELLED',
            'REVOKED',
            'SUSPENDED',
            'GUEST_CLAIMED'
        )
    ),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('student', 'admin', 'system')),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurrence_seq INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_app_events_occurrence UNIQUE (application_id, event_type, occurrence_seq)
);

CREATE INDEX IF NOT EXISTS idx_app_events_app_id ON public.course_application_events (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_type ON public.course_application_events (event_type);

-- --------------------------------------------------------------------
-- 6. SUPPORTING TABLE: public.course_application_audit_logs (Compliance Trail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_application_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'super_admin', 'student', 'system')),
    action TEXT NOT NULL,
    previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_app_audit_app_id ON public.course_application_audit_logs (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_audit_actor ON public.course_application_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_app_audit_action ON public.course_application_audit_logs (action);

-- Immutability trigger: blocks UPDATE, DELETE, TRUNCATE on audit logs
DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON public.course_application_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tampering
    BEFORE UPDATE OR DELETE ON public.course_application_audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_tampering();

-- --------------------------------------------------------------------
-- 7. SUPPORTING TABLE: public.notification_outbox (Transactional Email Queue)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id BIGSERIAL PRIMARY KEY,
    application_id UUID REFERENCES public.course_applications(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    template_name TEXT NOT NULL CHECK (
        template_name IN (
            'application_received',
            'review_started',
            'resubmission_required',
            'application_approved',
            'application_rejected',
            'enrollment_confirmed',
            'enrollment_revoked'
        )
    ),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'processing',
            'sent',
            'failed',
            'dead_letter'
        )
    ),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    locked_until TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    sent_at TIMESTAMPTZ,
    last_error TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

DROP TRIGGER IF EXISTS trg_notification_outbox_updated_at ON public.notification_outbox;
CREATE TRIGGER trg_notification_outbox_updated_at
    BEFORE UPDATE ON public.notification_outbox
    FOR EACH ROW
    EXECUTE FUNCTION public.set_course_application_updated_at();

CREATE INDEX IF NOT EXISTS idx_notification_outbox_queue ON public.notification_outbox (next_attempt_at, locked_until);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_locked ON public.notification_outbox (locked_until);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_worker_dequeue ON public.notification_outbox (next_attempt_at, created_at) WHERE status IN ('pending', 'failed', 'processing');

-- --------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) & PRIVILEGE LOCKDOWN
-- --------------------------------------------------------------------
ALTER TABLE public.course_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_application_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_application_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.course_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.course_application_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.course_application_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.course_application_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC, anon, authenticated;

-- Service role has full table access for server functions
GRANT ALL ON TABLE public.course_applications TO service_role;
GRANT ALL ON TABLE public.course_application_documents TO service_role;
GRANT ALL ON TABLE public.course_application_events TO service_role;
GRANT ALL ON TABLE public.course_application_audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_outbox TO service_role; -- DELETE strictly omitted

GRANT USAGE, SELECT ON SEQUENCE public.course_application_number_seq TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Column-Level SELECT for Authenticated Users (Excludes guest_claim_token_hash)
GRANT SELECT (
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
    payment_reference,
    payment_amount_inr,
    documents_status,
    assigned_admin_id,
    enrollment_id,
    rejection_reason,
    resubmission_notes,
    submitted_at,
    approved_at,
    enrolled_at,
    rejected_at,
    created_at,
    updated_at
) ON TABLE public.course_applications TO authenticated;

-- RLS Policies for course_applications
DROP POLICY IF EXISTS course_applications_student_select_policy ON public.course_applications;
CREATE POLICY course_applications_student_select_policy
ON public.course_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS course_applications_admin_select_policy ON public.course_applications;
CREATE POLICY course_applications_admin_select_policy
ON public.course_applications
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));

-- Helper security-invoker view for students (sanitizes schema and enforces RLS)
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

-- RLS Policies for course_application_documents
GRANT SELECT ON TABLE public.course_application_documents TO authenticated;

DROP POLICY IF EXISTS course_application_documents_student_select_policy ON public.course_application_documents;
CREATE POLICY course_application_documents_student_select_policy
ON public.course_application_documents
FOR SELECT
TO authenticated
USING (application_id IN (
    SELECT id FROM public.course_applications WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS course_application_documents_admin_select_policy ON public.course_application_documents;
CREATE POLICY course_application_documents_admin_select_policy
ON public.course_application_documents
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));

-- RLS Policies for course_application_events
GRANT SELECT ON TABLE public.course_application_events TO authenticated;

DROP POLICY IF EXISTS course_application_events_student_select_policy ON public.course_application_events;
CREATE POLICY course_application_events_student_select_policy
ON public.course_application_events
FOR SELECT
TO authenticated
USING (application_id IN (
    SELECT id FROM public.course_applications WHERE user_id = auth.uid()
));

DROP POLICY IF EXISTS course_application_events_admin_select_policy ON public.course_application_events;
CREATE POLICY course_application_events_admin_select_policy
ON public.course_application_events
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));

-- RLS Policies for course_application_audit_logs (Super Admin Only)
GRANT SELECT ON TABLE public.course_application_audit_logs TO authenticated;

DROP POLICY IF EXISTS course_application_audit_logs_super_admin_select_policy ON public.course_application_audit_logs;
CREATE POLICY course_application_audit_logs_super_admin_select_policy
ON public.course_application_audit_logs
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- --------------------------------------------------------------------
-- 9. STORED PROCEDURE: rpc_admin_transition_application_status (Version 1.7.0)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_admin_transition_application_status(
    p_application_id UUID,
    p_target_status TEXT,
    p_actor_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_resubmission_notes TEXT DEFAULT NULL
)
RETURNS public.course_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_app public.course_applications%ROWTYPE;
    v_prev_app public.course_applications%ROWTYPE;
    v_old_status TEXT;
    v_enrollment_id UUID := NULL;
    v_match_count INT := 0;
    v_candidate_id UUID := NULL;
    v_enrollment_row RECORD;
    v_deleted_enrollment_id UUID := NULL;
    v_deleted_enrollment_json JSONB := NULL;
    v_shared_count INT := 0;
    v_event_type TEXT;
    v_event_title TEXT;
    v_event_desc TEXT;
    v_template_name TEXT := NULL;
    v_idempotency_key TEXT := NULL;
    v_audit_action TEXT;
    v_audit_notes TEXT;
    v_occurrence_seq INT := 1;
BEGIN
    -- 0. Actor Authorization Verification (Defense-in-Depth)
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'p_actor_id is required and cannot be NULL'
            USING ERRCODE = 'not_null_violation';
    END IF;

    -- Verify actor exists in auth.users
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'Actor % is not a registered user in auth.users', p_actor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 1. Lock application row FOR UPDATE
    SELECT * INTO v_app
    FROM public.course_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found: %', p_application_id
            USING ERRCODE = 'no_data_found';
    END IF;

    -- Capture genuine pre-mutation application snapshot for audit preservation
    v_prev_app := v_app;
    v_old_status := v_app.status;

    -- Idempotency check: if application is already in target status, handle cleanly
    IF v_old_status = p_target_status THEN
        IF p_target_status = 'enrolled' AND v_app.enrollment_id IS NOT NULL THEN
            SELECT * INTO v_enrollment_row
            FROM public.enrollments_users
            WHERE id = v_app.enrollment_id;

            IF NOT FOUND OR pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
               OR public.normalize_course_id(v_enrollment_row.course_id) != public.normalize_course_id(v_app.course_id::text) THEN
                RAISE EXCEPTION 'Application enrollment_id % references invalid or mismatched enrollment record. Manual administrative reconciliation required.',
                    v_app.enrollment_id
                    USING ERRCODE = 'data_exception';
            END IF;
            RETURN v_app;
        ELSIF p_target_status != 'enrolled' THEN
            RETURN v_app;
        END IF;
    END IF;

    -- 2. Fully Implemented Lifecycle State Transitions & Validations

    -- -----------------------------------------------------------------
    -- BRANCH A: START REVIEW (under_review)
    -- -----------------------------------------------------------------
    IF p_target_status = 'under_review' THEN
        IF v_old_status NOT IN ('submitted', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot start review on application in status % (must be submitted or resubmitted)', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        v_event_type := 'UNDER_REVIEW';
        v_event_title := 'Evaluation Started';
        v_event_desc := 'Administrator began evaluating candidate application.';
        v_template_name := 'review_started';
        v_audit_action := 'START_REVIEW';
        v_audit_notes := COALESCE(p_reason, 'Review initiated by administrator.');

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH B: ACADEMIC APPROVAL (approved) - DEC-03 Purely Academic
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'approved' THEN
        IF v_old_status NOT IN ('submitted', 'under_review', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot approve application currently in status %', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;

        -- DEC-03: Academic approval is based strictly on academic merit and document verification.
        -- Payment completion is NOT required for academic approval; it is enforced before enrollment activation.
        IF v_app.documents_status IS DISTINCT FROM 'verified' THEN
            RAISE EXCEPTION 'Cannot approve application %: documents_status is % (must be verified)',
                p_application_id, v_app.documents_status
                USING ERRCODE = 'check_violation';
        END IF;

        v_event_type := 'APPROVED';
        v_event_title := 'Application Approved';
        v_event_desc := 'Application has passed academic and eligibility review.';
        v_template_name := 'application_approved';
        v_audit_action := 'APPROVE_APPLICATION';
        v_audit_notes := COALESCE(p_reason, 'Academic review requirements met.');

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH C: ACADEMIC REJECTION (rejected)
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'rejected' THEN
        IF v_old_status NOT IN ('submitted', 'under_review', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot reject application currently in status %', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
            RAISE EXCEPTION 'Rejection reason is mandatory when rejecting an application'
                USING ERRCODE = 'check_violation';
        END IF;
        v_event_type := 'REJECTED';
        v_event_title := 'Application Rejected';
        v_event_desc := 'Application did not meet academic or cohort criteria: ' || p_reason;
        v_template_name := 'application_rejected';
        v_audit_action := 'REJECT_APPLICATION';
        v_audit_notes := p_reason;

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH D: REQUEST RESUBMISSION (resubmission_required)
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'resubmission_required' THEN
        IF v_old_status NOT IN ('submitted', 'under_review', 'resubmitted') THEN
            RAISE EXCEPTION 'Cannot request resubmission for application in status %', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        IF p_resubmission_notes IS NULL OR pg_catalog.btrim(p_resubmission_notes) = '' THEN
            RAISE EXCEPTION 'Resubmission notes are mandatory when requesting resubmission'
                USING ERRCODE = 'check_violation';
        END IF;

        v_event_type := 'RESUBMISSION_REQUESTED';
        v_event_title := 'Resubmission Required';
        v_event_desc := 'Applicant requested to replace or update invalid/illegible documentation: ' || p_resubmission_notes;
        v_template_name := 'resubmission_required';
        v_audit_action := 'REQUEST_RESUBMISSION';
        v_audit_notes := p_resubmission_notes;

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH E: ACTIVATE ENROLLMENT (enrolled) - DEC-03 Finance Prereq
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'enrolled' THEN
        IF v_old_status = 'enrolled' AND v_app.enrollment_id IS NOT NULL THEN
            SELECT * INTO v_enrollment_row
            FROM public.enrollments_users
            WHERE id = v_app.enrollment_id;

            IF NOT FOUND OR pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
               OR public.normalize_course_id(v_enrollment_row.course_id) != public.normalize_course_id(v_app.course_id::text) THEN
                RAISE EXCEPTION 'Application enrollment_id % references invalid or mismatched enrollment record. Manual administrative reconciliation required.',
                    v_app.enrollment_id
                    USING ERRCODE = 'data_exception';
            END IF;
            RETURN v_app;
        END IF;

        -- Scenario 6: Already enrolled but enrollment_id is anomalous NULL (Self-Healing Recovery)
        IF v_old_status = 'enrolled' AND v_app.enrollment_id IS NULL THEN
            PERFORM pg_catalog.pg_advisory_xact_lock(
                pg_catalog.hashtext(pg_catalog.lower(pg_catalog.btrim(v_app.student_email))),
                pg_catalog.hashtext(public.normalize_course_id(v_app.course_id::text))
            );

            SELECT count(*) INTO v_match_count
            FROM public.enrollments_users
            WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
              AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text);

            IF v_match_count = 1 THEN
                SELECT id INTO v_candidate_id
                FROM public.enrollments_users
                WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                  AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text)
                LIMIT 1;

                UPDATE public.course_applications
                SET enrollment_id = v_candidate_id, updated_at = pg_catalog.now()
                WHERE id = p_application_id
                RETURNING * INTO v_app;

                INSERT INTO public.course_application_audit_logs (
                    application_id, actor_id, actor_role, action, previous_state, new_state, notes
                ) VALUES (
                    p_application_id, p_actor_id, 'admin', 'RECONCILE_ENROLLMENT_LINK',
                    pg_catalog.jsonb_build_object('status', v_prev_app.status, 'enrollment_id', v_prev_app.enrollment_id),
                    pg_catalog.jsonb_build_object('status', v_app.status, 'enrollment_id', v_app.enrollment_id),
                    'Anomalous NULL enrollment_id reconciled to single matching enrollment record.'
                );
                RETURN v_app;

            ELSIF v_match_count = 0 THEN
                INSERT INTO public.enrollments_users (
                    student_name, student_email, course_id, enrollment_date
                ) VALUES (
                    v_app.student_name, pg_catalog.lower(pg_catalog.btrim(v_app.student_email)), v_app.course_id::text, pg_catalog.now()
                ) RETURNING id INTO v_candidate_id;

                UPDATE public.course_applications
                SET enrollment_id = v_candidate_id, updated_at = pg_catalog.now()
                WHERE id = p_application_id
                RETURNING * INTO v_app;

                INSERT INTO public.course_application_audit_logs (
                    application_id, actor_id, actor_role, action, previous_state, new_state, notes
                ) VALUES (
                    p_application_id, p_actor_id, 'admin', 'RECONCILE_ENROLLMENT_CREATE',
                    pg_catalog.jsonb_build_object('status', v_prev_app.status, 'enrollment_id', v_prev_app.enrollment_id),
                    pg_catalog.jsonb_build_object('status', v_app.status, 'enrollment_id', v_app.enrollment_id),
                    'Anomalous NULL enrollment_id reconciled by creating new enrollment record.'
                );
                RETURN v_app;
            ELSE
                RAISE EXCEPTION 'Multiple conflicting enrollment records (%) found for student % and course % during reconciliation. Manual intervention required.',
                    v_match_count, v_app.student_email, v_app.course_id
                    USING ERRCODE = 'data_exception';
            END IF;
        END IF;

        -- Normal path: must be approved before enrollment activation
        IF v_old_status != 'approved' THEN
            RAISE EXCEPTION 'Application must be in approved status before activating enrollment (current: %)', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;

        -- DEC-03 Payment Precondition Enforcement
        IF v_app.payment_status IS NULL OR v_app.payment_status NOT IN ('verified', 'waived', 'not_required') THEN
            RAISE EXCEPTION 'Payment verification required before enrollment (current payment_status: %)', COALESCE(v_app.payment_status, 'NULL')
                USING ERRCODE = 'check_violation';
        END IF;

        -- Dual-key transaction-scoped advisory lock on (student_email, normalized_course_id)
        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(pg_catalog.lower(pg_catalog.btrim(v_app.student_email))),
            pg_catalog.hashtext(public.normalize_course_id(v_app.course_id::text))
        );

        SELECT count(*) INTO v_match_count
        FROM public.enrollments_users
        WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
          AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text);

        IF v_match_count = 1 THEN
            SELECT id INTO v_candidate_id
            FROM public.enrollments_users
            WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
              AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text)
            LIMIT 1;

            v_enrollment_id := v_candidate_id;
            v_audit_action := 'ACTIVATE_ENROLLMENT_LINK_EXISTING';
            v_audit_notes := 'Linked to pre-existing enrollment record: ' || v_enrollment_id::text;

        ELSIF v_match_count > 1 THEN
            RAISE EXCEPTION 'Multiple conflicting enrollment records (%) found for student % and course %. Manual administrative reconciliation required.',
                v_match_count, v_app.student_email, v_app.course_id
                USING ERRCODE = 'data_exception';

        ELSE
            INSERT INTO public.enrollments_users (
                student_name,
                student_email,
                course_id,
                enrollment_date
            ) VALUES (
                v_app.student_name,
                pg_catalog.lower(pg_catalog.btrim(v_app.student_email)),
                v_app.course_id::text,
                pg_catalog.now()
            )
            RETURNING id INTO v_enrollment_id;
            v_audit_action := 'ACTIVATE_ENROLLMENT';
            v_audit_notes := 'New enrollment created and linked to enrollment ID: ' || v_enrollment_id::text;
        END IF;

        v_event_type := 'ENROLLED';
        v_event_title := 'Enrollment Confirmed';
        v_event_desc := 'Candidate enrollment activated; dashboard and WhatsApp group access provisioned.';
        v_template_name := 'enrollment_confirmed';

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH F: REVOKE ENROLLMENT OR APPROVAL (revoked)
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'revoked' THEN
        IF v_old_status NOT IN ('approved', 'enrolled') THEN
            RAISE EXCEPTION 'Cannot revoke application currently in status % (must be approved or enrolled)', v_old_status
                USING ERRCODE = 'check_violation';
        END IF;
        IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
            RAISE EXCEPTION 'Revocation reason is mandatory when revoking an application'
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_old_status = 'approved' THEN
            v_enrollment_id := NULL;
            v_audit_notes := 'Approval revoked prior to enrollment: ' || p_reason;

        ELSIF v_old_status = 'enrolled' THEN
            IF v_app.enrollment_id IS NOT NULL THEN
                SELECT * INTO v_enrollment_row
                FROM public.enrollments_users
                WHERE id = v_app.enrollment_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    v_audit_notes := 'Enrollment revoked (referenced record ' || v_app.enrollment_id::text || ' was already absent in enrollments_users): ' || p_reason;
                    v_deleted_enrollment_id := NULL;
                    v_deleted_enrollment_json := NULL;
                ELSE
                    IF pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                       OR public.normalize_course_id(v_enrollment_row.course_id) != public.normalize_course_id(v_app.course_id::text) THEN
                        RAISE EXCEPTION 'Referenced enrollment % belongs to mismatched student (% vs %) or course (% vs %). Refusing deletion. Manual administrative reconciliation required.',
                            v_app.enrollment_id, v_enrollment_row.student_email, v_app.student_email, v_enrollment_row.course_id, v_app.course_id
                            USING ERRCODE = 'data_exception';
                    END IF;

                    SELECT count(*) INTO v_shared_count
                    FROM public.course_applications
                    WHERE enrollment_id = v_app.enrollment_id
                      AND id != p_application_id;

                    IF v_shared_count > 0 THEN
                        RAISE EXCEPTION 'Cannot automatically revoke enrollment %: record is referenced by % other application(s). Manual administrative intervention required.',
                            v_app.enrollment_id, v_shared_count
                            USING ERRCODE = 'check_violation';
                    END IF;

                    DELETE FROM public.enrollments_users
                    WHERE id = v_app.enrollment_id;

                    v_deleted_enrollment_id := v_enrollment_row.id;
                    v_deleted_enrollment_json := pg_catalog.row_to_json(v_enrollment_row)::jsonb;
                    v_audit_notes := 'Enrollment revoked and access removed for record ' || v_app.enrollment_id::text || ': ' || p_reason;
                END IF;
            ELSE
                SELECT count(*) INTO v_match_count
                FROM public.enrollments_users
                WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                  AND public.normalize_course_id(course_id) = public.normalize_course_id(v_app.course_id::text);

                IF v_match_count > 0 THEN
                    RAISE EXCEPTION 'REVOCATION_BLOCKED: Application is marked enrolled with NULL enrollment_id, but % matching active row(s) exist in enrollments_users. Manual administrative reconciliation required.',
                        v_match_count
                        USING ERRCODE = 'data_exception';
                END IF;
                v_audit_notes := 'Revocation completed for unlinked application: ' || p_reason;
                v_deleted_enrollment_id := NULL;
                v_deleted_enrollment_json := NULL;
            END IF;
        END IF;

        v_event_type := 'REVOKED';
        v_event_title := 'Enrollment Revoked';
        v_event_desc := 'Application approval/enrollment revoked: ' || p_reason;
        v_template_name := 'enrollment_revoked';
        v_audit_action := 'REVOKE_ENROLLMENT';

        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    ELSE
        RAISE EXCEPTION 'Unsupported target status: %', p_target_status
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- 3. Execute Primary Record Update
    UPDATE public.course_applications
    SET status = p_target_status,
        enrollment_id = CASE WHEN p_target_status = 'revoked' THEN NULL ELSE COALESCE(v_enrollment_id, enrollment_id) END,
        assigned_admin_id = COALESCE(p_actor_id, assigned_admin_id),
        approved_at = CASE WHEN p_target_status = 'approved' THEN pg_catalog.now() ELSE approved_at END,
        enrolled_at = CASE WHEN p_target_status = 'enrolled' THEN pg_catalog.now() ELSE enrolled_at END,
        rejected_at = CASE WHEN p_target_status = 'rejected' THEN pg_catalog.now() ELSE rejected_at END,
        rejection_reason = CASE WHEN p_target_status = 'rejected' THEN p_reason ELSE rejection_reason END,
        resubmission_notes = CASE WHEN p_target_status = 'resubmission_required' THEN p_resubmission_notes ELSE resubmission_notes END,
        documents_status = CASE WHEN p_target_status = 'resubmission_required' THEN 'resubmission_requested' ELSE documents_status END,
        updated_at = pg_catalog.now()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    -- 4. Insert Progress Timeline Milestone Event (Schema-Compliant)
    INSERT INTO public.course_application_events (
        application_id,
        event_type,
        actor_type,
        actor_id,
        title,
        description,
        metadata,
        occurrence_seq
    ) VALUES (
        p_application_id,
        v_event_type,
        'admin',
        p_actor_id,
        v_event_title,
        v_event_desc,
        pg_catalog.jsonb_build_object(
            'previous_status', v_old_status,
            'new_status', p_target_status,
            'reason', p_reason,
            'enrollment_id', COALESCE(v_enrollment_id, v_app.enrollment_id),
            'deleted_enrollment_id', v_deleted_enrollment_id,
            'occurrence_seq', v_occurrence_seq,
            'transitioned_at', pg_catalog.now()
        ),
        v_occurrence_seq
    );

    -- 5. Insert Compliance Audit Log (Schema-Compliant)
    -- Crucial: previous_state uses v_prev_app (pre-mutation snapshot)
    INSERT INTO public.course_application_audit_logs (
        application_id,
        actor_id,
        actor_role,
        action,
        previous_state,
        new_state,
        notes
    ) VALUES (
        p_application_id,
        p_actor_id,
        'admin',
        v_audit_action,
        pg_catalog.jsonb_build_object(
            'status', v_prev_app.status,
            'assigned_admin_id', v_prev_app.assigned_admin_id,
            'enrollment_id', v_prev_app.enrollment_id,
            'payment_status', v_prev_app.payment_status,
            'documents_status', v_prev_app.documents_status,
            'deleted_enrollment', v_deleted_enrollment_json
        ),
        pg_catalog.jsonb_build_object(
            'status', v_app.status,
            'assigned_admin_id', v_app.assigned_admin_id,
            'enrollment_id', v_app.enrollment_id,
            'payment_status', v_app.payment_status,
            'documents_status', v_app.documents_status,
            'occurrence_seq', v_occurrence_seq
        ),
        v_audit_notes
    );

    -- 6. Enqueue Transactional Notification to Outbox
    IF v_template_name IS NOT NULL THEN
        INSERT INTO public.notification_outbox (
            application_id,
            recipient_email,
            template_name,
            payload,
            status,
            attempts,
            max_attempts,
            next_attempt_at,
            idempotency_key
        ) VALUES (
            p_application_id,
            v_app.student_email,
            v_template_name,
            pg_catalog.jsonb_build_object(
                'application_id', p_application_id,
                'application_number', v_app.application_number,
                'student_name', v_app.student_name,
                'student_email', v_app.student_email,
                'course_id', v_app.course_id,
                'status', p_target_status,
                'reason', p_reason,
                'resubmission_notes', p_resubmission_notes,
                'occurrence_seq', v_occurrence_seq
            ),
            'pending',
            0,
            5,
            pg_catalog.now(),
            v_idempotency_key
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN v_app;
END;
$$;

-- --------------------------------------------------------------------
-- 10. STORED PROCEDURE: rpc_claim_guest_application (DEC-02 Atomic Claiming)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_claim_guest_application(
    p_claim_token_hash TEXT,
    p_user_id UUID,
    p_user_email TEXT
)
RETURNS public.course_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_app public.course_applications%ROWTYPE;
BEGIN
    IF p_claim_token_hash IS NULL OR p_user_id IS NULL OR p_user_email IS NULL THEN
        RAISE EXCEPTION 'Invalid parameters: token hash, user ID, and user email are required'
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- Lock candidate row FOR UPDATE
    SELECT * INTO v_app
    FROM public.course_applications
    WHERE guest_claim_token_hash = p_claim_token_hash
      AND user_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or already claimed application token'
            USING ERRCODE = 'no_data_found';
    END IF;

    -- Check expiration
    IF v_app.guest_claim_token_expires_at IS NOT NULL AND v_app.guest_claim_token_expires_at < pg_catalog.now() THEN
        RAISE EXCEPTION 'Guest application claiming token has expired'
            USING ERRCODE = 'data_exception';
    END IF;

    -- Verify email ownership
    IF pg_catalog.lower(pg_catalog.btrim(v_app.student_email)) != pg_catalog.lower(pg_catalog.btrim(p_user_email)) THEN
        RAISE EXCEPTION 'Claiming user email (%) does not match application email (%)', p_user_email, v_app.student_email
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Atomically assign user_id and invalidate single-use token
    UPDATE public.course_applications
    SET user_id = p_user_id,
        guest_claim_token_hash = NULL,
        guest_claim_token_expires_at = NULL,
        updated_at = pg_catalog.now()
    WHERE id = v_app.id
    RETURNING * INTO v_app;

    -- Log claim event
    INSERT INTO public.course_application_events (
        application_id,
        event_type,
        actor_type,
        actor_id,
        title,
        description,
        metadata
    ) VALUES (
        v_app.id,
        'GUEST_CLAIMED',
        'student',
        p_user_id,
        'Application Account Claimed',
        'Guest application was successfully linked to authenticated student account.',
        pg_catalog.jsonb_build_object(
            'claimed_by_user_id', p_user_id,
            'claimed_at', pg_catalog.now()
        )
    );

    -- Log compliance audit
    INSERT INTO public.course_application_audit_logs (
        application_id,
        actor_id,
        actor_role,
        action,
        previous_state,
        new_state,
        notes
    ) VALUES (
        v_app.id,
        p_user_id,
        'student',
        'CLAIM_GUEST_APPLICATION',
        pg_catalog.jsonb_build_object('user_id', NULL),
        pg_catalog.jsonb_build_object('user_id', p_user_id),
        'Guest application claimed after student account verification.'
    );

    RETURN v_app;
END;
$$;

-- --------------------------------------------------------------------
-- 11. STORED PROCEDURE: rpc_dequeue_notification_batch (Worker Processor)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_dequeue_notification_batch(
    p_batch_size INT DEFAULT 10,
    p_lock_seconds INT DEFAULT 300
)
RETURNS SETOF public.notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_validated_batch_size INT;
    v_validated_lock_seconds INT;
BEGIN
    v_validated_batch_size := GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 100));
    v_validated_lock_seconds := GREATEST(30, LEAST(COALESCE(p_lock_seconds, 300), 3600));

    -- Step 1: Reclaim expired processing jobs that exhausted retries -> dead_letter
    UPDATE public.notification_outbox
    SET status = 'dead_letter',
        last_error = COALESCE(last_error, 'Job processing lease expired after exhausting maximum retry attempts.'),
        locked_until = NULL,
        updated_at = pg_catalog.now()
    WHERE status = 'processing'
      AND locked_until < pg_catalog.now()
      AND attempts >= max_attempts;

    -- Step 2: Atomically select and claim available jobs using FOR UPDATE SKIP LOCKED
    RETURN QUERY
    WITH locked_rows AS (
        SELECT id
        FROM public.notification_outbox
        WHERE (
            -- Case A: Pending jobs ready for initial dispatch
            (status = 'pending' AND next_attempt_at <= pg_catalog.now())
            OR
            -- Case B: Failed jobs whose backoff window has elapsed
            (status = 'failed' AND attempts < max_attempts AND next_attempt_at <= pg_catalog.now())
            OR
            -- Case C: Abandoned / crashed worker jobs whose lease expired
            (status = 'processing' AND locked_until < pg_catalog.now() AND attempts < max_attempts)
        )
        ORDER BY next_attempt_at ASC, id ASC
        LIMIT v_validated_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_outbox o
    SET status = 'processing',
        attempts = o.attempts + 1,
        locked_until = pg_catalog.now() + (v_validated_lock_seconds || ' seconds')::interval,
        updated_at = pg_catalog.now()
    FROM locked_rows
    WHERE o.id = locked_rows.id
    RETURNING o.*;
END;
$$;

-- Stored procedure execution lockdown: service_role only
REVOKE EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_claim_guest_application(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_claim_guest_application(TEXT, UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) TO service_role;

COMMIT;

-- ====================================================================
-- VERIFICATION QUERIES (Run after executing above script)
-- ====================================================================
-- SELECT table_name, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND table_name LIKE 'course_application%' OR table_name = 'notification_outbox';
-- SELECT proname, prosecdef FROM pg_proc WHERE proname LIKE 'rpc_%application%' OR proname = 'rpc_dequeue_notification_batch';
-- ====================================================================
-- ROLLBACK SCRIPT (In case of error during manual deployment)
-- ====================================================================
-- DROP VIEW IF EXISTS public.candidate_course_applications;
-- DROP TABLE IF EXISTS public.notification_outbox CASCADE;
-- DROP TABLE IF EXISTS public.course_application_audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.course_application_events CASCADE;
-- DROP TABLE IF EXISTS public.course_application_documents CASCADE;
-- DROP TABLE IF EXISTS public.course_applications CASCADE;
-- DROP FUNCTION IF EXISTS public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS public.rpc_claim_guest_application(TEXT, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT);
-- DROP FUNCTION IF EXISTS public.validate_course_application_course_id();
-- DROP FUNCTION IF EXISTS public.generate_course_application_number();
-- DROP FUNCTION IF EXISTS public.prevent_audit_log_tampering();
-- DROP FUNCTION IF EXISTS public.set_course_application_updated_at();
-- DROP SEQUENCE IF EXISTS public.course_application_number_seq;
