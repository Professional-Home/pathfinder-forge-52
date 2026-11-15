-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM — SCHEMA MIGRATION DRAFT (V1.2)
-- Phase 3.3.4: Guest Claim Security & Database Consistency Corrections
-- Repository: F:/Project/pathfinder-forge-52
-- Target Branch: feature/course-application-management
--
-- STRICT PRE-DEPLOYMENT NOTICE:
-- This is a static schema design draft for review. DO NOT EXECUTE against
-- production Supabase without explicit phase sign-off and authorization.
--
-- APPROVED BUSINESS DECISIONS EMBEDDED:
-- - DEC-01: courses.id remains TEXT. Applications use UUID validated via trigger.
-- - DEC-02: Guest applications allowed (user_id is nullable). Verified claiming via token hash & expiration.
-- - DEC-03: Academic review separate from payment and enrollment activation.
-- - DEC-04: Documents max 10MB (10485760 bytes), PDF/JPEG/PNG formats only.
-- - DEC-05: Permanent audit logs (ON DELETE SET NULL); 5yr/1yr/180d retention policy.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. APPLICATION NUMBER SEQUENCE & GENERATOR FUNCTION
-- --------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.course_application_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_course_application_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- UTC year extraction is deliberately formatted for display; sequence is zero-padded to 5 digits
    RETURN 'APP-' || TO_CHAR(timezone('utc'::text, now()), 'YYYY') || '-' || 
           LPAD(NEXTVAL('public.course_application_number_seq')::TEXT, 5, '0');
END;
$$;

-- --------------------------------------------------------------------
-- 2. CORE TABLE: public.course_applications
-- --------------------------------------------------------------------
-- Primary application dossier capturing student application details,
-- academic background, review states, payment references, guest claiming token hash & expiry,
-- and enrollment linkage.
CREATE TABLE IF NOT EXISTS public.course_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number TEXT UNIQUE NOT NULL DEFAULT public.generate_course_application_number(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable to allow guest submissions (DEC-02)
    guest_claim_token_hash TEXT NULL, -- Cryptographic hash of single-use guest claiming token (DEC-02)
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
    payment_amount_inr NUMERIC(10, 2),
    assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    enrollment_id UUID REFERENCES public.enrollments_users(id) ON DELETE SET NULL, -- Populated strictly upon enrollment activation
    rejection_reason TEXT,
    resubmission_notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Defense-in-depth: Enforce lifecycle separation (DEC-03)
    -- Enrolled status is forbidden unless payment is verified, waived, or not required.
    CONSTRAINT chk_course_applications_enrolled_payment CHECK (
        status != 'enrolled' OR payment_status IN ('verified', 'waived', 'not_required')
    )
);

-- Performance and lookup indexes for course_applications
CREATE INDEX IF NOT EXISTS idx_course_applications_email 
    ON public.course_applications (lower(trim(student_email)));

CREATE INDEX IF NOT EXISTS idx_course_applications_user_id 
    ON public.course_applications (user_id);

CREATE INDEX IF NOT EXISTS idx_course_applications_guest_claim 
    ON public.course_applications (guest_claim_token_hash, guest_claim_token_expires_at) 
    WHERE guest_claim_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_course_applications_course_id 
    ON public.course_applications (course_id);

CREATE INDEX IF NOT EXISTS idx_course_applications_status 
    ON public.course_applications (status);

CREATE INDEX IF NOT EXISTS idx_course_applications_created_at 
    ON public.course_applications (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_ref 
    ON public.course_applications (lower(trim(payment_reference))) 
    WHERE payment_reference IS NOT NULL AND payment_status NOT IN ('unpaid', 'refunded');

-- --------------------------------------------------------------------
-- 3. COURSE ID VALIDATION & REFERENTIAL INTEGRITY TRIGGERS (DEC-01)
-- --------------------------------------------------------------------
-- Validates that course_applications.course_id (UUID) references an existing
-- row in public.courses (where courses.id is TEXT), avoiding an invalid
-- cross-type foreign key while enforcing strict referential integrity.
--
-- Security Definer Justification:
-- Executed with elevated privileges so anonymous or guest applicants (DEC-02)
-- can validate course existence even when RLS on public.courses limits SELECT
-- access. Hardened search_path prevents search-path hijacking.
CREATE OR REPLACE FUNCTION public.validate_course_application_course_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Acquire a shared lock to prevent concurrent course deletion or mutation during application insertion
    IF NOT EXISTS (
        SELECT 1 FROM public.courses WHERE id = NEW.course_id::text FOR KEY SHARE
    ) THEN
        RAISE EXCEPTION 'Referential integrity violation: course_id % does not exist in public.courses', NEW.course_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END;
$$;

-- Restrict direct execution privileges (triggers only)
REVOKE EXECUTE ON FUNCTION public.validate_course_application_course_id() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_validate_course_application_course_id ON public.course_applications;
CREATE TRIGGER trg_validate_course_application_course_id
BEFORE INSERT OR UPDATE OF course_id ON public.course_applications
FOR EACH ROW
EXECUTE FUNCTION public.validate_course_application_course_id();

-- Complementary protection trigger on public.courses:
-- Prevents deletion or ID mutations of courses that have active application dossiers.
CREATE OR REPLACE FUNCTION public.prevent_referenced_course_deletion_or_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Guard against course ID mutation
    IF (TG_OP = 'UPDATE' AND OLD.id IS DISTINCT FROM NEW.id) THEN
        IF EXISTS (
            SELECT 1 FROM public.course_applications
            WHERE course_id::text = OLD.id
        ) THEN
            RAISE EXCEPTION 'Cannot update course ID %: active course applications reference this course.', OLD.id
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    END IF;

    -- Guard against course deletion
    IF (TG_OP = 'DELETE') THEN
        IF EXISTS (
            SELECT 1 FROM public.course_applications
            WHERE course_id::text = OLD.id
        ) THEN
            RAISE EXCEPTION 'Cannot delete course %: active course applications reference this course. Retire or unpublish the course instead.', OLD.id
                USING ERRCODE = 'foreign_key_violation';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Restrict direct execution privileges (triggers only)
REVOKE EXECUTE ON FUNCTION public.prevent_referenced_course_deletion_or_id_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_course_deletion_or_id_change ON public.courses;
CREATE TRIGGER trg_prevent_course_deletion_or_id_change
BEFORE UPDATE OF id OR DELETE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.prevent_referenced_course_deletion_or_id_change();

-- --------------------------------------------------------------------
-- 4. SUPPORTING TABLE: public.course_application_documents
-- --------------------------------------------------------------------
-- Tracks metadata for candidate CVs, academic transcripts, identity proofs,
-- and fee payment receipts uploaded to private Supabase Storage (DEC-04).
CREATE TABLE IF NOT EXISTS public.course_application_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (
        document_type IN ('resume', 'academic_transcript', 'id_proof', 'payment_proof', 'other')
    ),
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760), -- Max 10MB (DEC-04)
    mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    storage_path TEXT UNIQUE NOT NULL,
    sha256_hash TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false, -- Set true when replaced during resubmission
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_documents_app_id 
    ON public.course_application_documents (application_id);

CREATE INDEX IF NOT EXISTS idx_app_documents_type 
    ON public.course_application_documents (application_id, document_type) 
    WHERE is_archived = false;

-- --------------------------------------------------------------------
-- 5. SUPPORTING TABLE: public.course_application_events
-- --------------------------------------------------------------------
-- Student-facing and operational event history timeline for progress tracking.
CREATE TABLE IF NOT EXISTS public.course_application_events (
    id BIGSERIAL PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'DRAFT_CREATED',
            'SUBMITTED',
            'UNDER_REVIEW',
            'RESUBMISSION_REQUESTED',
            'RESUBMITTED',
            'APPROVED',
            'PAYMENT_VERIFIED',
            'ENROLLED',
            'REJECTED',
            'CANCELLED',
            'CLAIMED_BY_USER',
            'REVOKED'
        )
    ),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('student', 'admin', 'system')),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_events_app_id 
    ON public.course_application_events (application_id, created_at DESC);

-- --------------------------------------------------------------------
-- 6. SUPPORTING TABLE: public.course_application_audit_logs
-- --------------------------------------------------------------------
-- Immutable security, regulatory compliance, and administrative audit trail.
-- References application with ON DELETE SET NULL to guarantee permanent retention (DEC-05).
CREATE TABLE IF NOT EXISTS public.course_application_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    application_id UUID REFERENCES public.course_applications(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'student', 'system', 'service_role')),
    action TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    notes TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_audit_app_id 
    ON public.course_application_audit_logs (application_id);

CREATE INDEX IF NOT EXISTS idx_app_audit_created_at 
    ON public.course_application_audit_logs (created_at DESC);

-- Immutability enforcement trigger:
-- Forbids any UPDATE or DELETE operations on audit trail rows.
CREATE OR REPLACE FUNCTION public.prevent_course_application_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.'
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_course_application_audit_logs_immutable ON public.course_application_audit_logs;
CREATE TRIGGER trg_course_application_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.course_application_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_course_application_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_course_application_audit_logs_prevent_truncate ON public.course_application_audit_logs;
CREATE TRIGGER trg_course_application_audit_logs_prevent_truncate
BEFORE TRUNCATE ON public.course_application_audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.prevent_course_application_audit_log_mutation();

-- Defense-in-depth privilege revocation:
-- Prevent direct modification or truncation by public, anon, or authenticated roles.
REVOKE UPDATE, DELETE, TRUNCATE ON public.course_application_audit_logs FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------
-- 7. SUPPORTING TABLE: public.notification_outbox
-- --------------------------------------------------------------------
-- Transactional outbox ensuring reliable asynchronous email notifications.
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
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')
    ),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    locked_until TIMESTAMPTZ,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimized polling index matching worker query:
-- WHERE status IN ('pending', 'failed') AND next_attempt_at <= now()
-- Includes locked_until to support recovery of expired processing leases without table scans.
CREATE INDEX IF NOT EXISTS idx_notification_outbox_queue 
    ON public.notification_outbox (next_attempt_at, locked_until)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_outbox_locked 
    ON public.notification_outbox (locked_until)
    WHERE status = 'processing';

-- --------------------------------------------------------------------
-- 8. AUTOMATIC UPDATED_AT TRIGGER
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_course_application_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_applications_updated_at ON public.course_applications;
CREATE TRIGGER trg_course_applications_updated_at
BEFORE UPDATE ON public.course_applications
FOR EACH ROW
EXECUTE FUNCTION public.set_course_application_updated_at();

-- ====================================================================
-- END OF SCHEMA MIGRATION DRAFT (V1.2)
-- ====================================================================
