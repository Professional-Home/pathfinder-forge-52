-- ====================================================================
-- PATHFINDER COURSE APPLICATION MANAGEMENT SYSTEM — SCHEMA MIGRATION DRAFT (V1.3.3)
-- Phase: 3.3.11 (Final RLS Semantics Clarification)
-- Repository: F:/Project/pathfinder-forge-52
-- Target Branch: feature/course-application-management
--
-- BASE COMMITS & PROVENANCE:
-- - Upstream Branching Baseline: 0a9d79a95f28942e115bacf10d5166c6441e9267 (origin/main, PR #23 merge baseline)
-- - Consolidation Feature Commit: 43a0e0de277a9eac749bd9c53921ee0db52ea9a3 (origin/feature/course-application-management publication)
--
-- HISTORICAL PROGRESSION:
-- - Phase 3.3: Initial Core Relational Schema Design & Migration Draft
-- - Phase 3.3.2: Technical Audit Corrections (Constraints, Triggers, DEC Alignment)
-- - Phase 3.3.4: Cryptographic Guest Claim Security & Database Consistency Corrections
-- - Phase 3.3.7: Consolidation into Permanent Project Repository (F:/Project/pathfinder-forge-52)
-- - Phase 3.3.8: Final Schema Security Scope, RLS Prerequisites & Documentation Consistency Review
-- - Phase 3.3.9: Documentation Accuracy & Security Assumption Corrections (Privileges, Planner, RLS FORCE caveats)
-- - Phase 3.3.10: Final Security Caveat (SECURITY DEFINER / BYPASSRLS / FORCE RLS) & Protected-File Audit
-- - Phase 3.3.11: Final RLS Semantics Clarification (Precise FORCE RLS & BYPASSRLS Exemption Rules)
--
-- STRICT PRE-DEPLOYMENT NOTICE & SECURITY BLOCKER:
-- 1. This is a static schema design draft for review. DO NOT EXECUTE against
--    production Supabase without explicit phase sign-off and authorization.
-- 2. ROW LEVEL SECURITY (RLS) IS NOT YET CONFIGURED OR ENABLED IN THIS DRAFT.
--    Effective access to newly created tables depends on the database's configured
--    default privileges (ALTER DEFAULT PRIVILEGES), explicit role grants/revokes, and RLS.
--    In standard Supabase environments, public schema default privileges often grant
--    table access to anon and authenticated roles unless explicitly customized or restricted.
-- 3. UNVERIFIED PRODUCTION ACLs: The live production database's default privileges, table grants,
--    and role permissions have NOT been freshly verified, and these tables have NOT been deployed.
--    Production deployment is strictly BLOCKED until the live ACL configuration is verified
--    and comprehensive RLS and least-privilege access policies are designed and approved for all 5 tables:
--    - public.course_applications
--    - public.course_application_documents
--    - public.course_application_events
--    - public.course_application_audit_logs
--    - public.notification_outbox
-- 4. Audit-log immutability triggers protect only audit records against mutation/deletion;
--    they provide ZERO security for the other tables against unauthorized reads or writes.
-- 5. If RLS is enabled without policies, PostgreSQL defaults to DENY-ALL for client roles
--    (anon, authenticated), requiring trusted server-side execution (service_role or SECURITY DEFINER RPCs).
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
-- Security Definer Justification & Precise RLS Semantics:
-- Executed with the privileges of the function's owning role to validate course existence
-- even when the client caller lacks direct table SELECT permissions on public.courses.
-- Hardened search_path prevents search-path hijacking.
--
-- TECHNICAL SECURITY CAVEATS & RLS BOUNDARIES:
-- 1. SECURITY DEFINER executes with the privileges of the function's owning role.
--    It does NOT automatically bypass Row Level Security (RLS).
-- 2. In PostgreSQL, RLS is bypassed only if:
--    a. The owning role possesses the PostgreSQL BYPASSRLS role attribute, OR
--    b. The owning role is a PostgreSQL superuser, OR
--    c. The owning role is the table owner of public.courses AND 'FORCE ROW LEVEL SECURITY'
--       is NOT enabled on public.courses.
-- 3. FORCE ROW LEVEL SECURITY behavior and limits:
--    a. Enabling FORCE ROW LEVEL SECURITY ensures table owners become subject to RLS policies
--       if they do not otherwise bypass RLS.
--    b. FORCE ROW LEVEL SECURITY does NOT override the BYPASSRLS attribute or superuser bypass
--       (superusers and roles with BYPASSRLS remain exempt from RLS regardless of FORCE RLS).
-- 4. A role without BYPASSRLS that is neither a superuser nor an exempt table owner remains
--    subject to applicable RLS SELECT policies on public.courses, which evaluate and govern row visibility.
-- 5. In all cases, required underlying table privileges (SELECT on public.courses) must strictly exist.
-- 6. Production function ownership, role attributes (BYPASSRLS), table grants, and live
--    FORCE RLS settings have NOT been inspected or verified and are treated as implementation
--    prerequisites to be confirmed during Phase 3.4 prior to deployment.
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
-- Includes locked_until to support recovery of expired processing leases via index scan (subject to query planner cost evaluation).
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

-- --------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL PREREQUISITES
-- --------------------------------------------------------------------
-- CRITICAL SECURITY NOTICE (DEPLOYMENT BLOCKER):
-- The five core tables created in this draft currently do NOT have Row Level
-- Security enabled and do NOT have access policies attached.
--
-- Before ANY execution in production Supabase, the following security architecture
-- MUST be designed, reviewed, and implemented:
--
-- 1. PRIVILEGE & ACCESS ARCHITECTURE DISTINCTIONS:
--    a. PostgreSQL Object Privileges: Base permissions (SELECT, INSERT, UPDATE, DELETE)
--       assigned to database roles on tables.
--    b. Supabase Default Privileges: Configured via ALTER DEFAULT PRIVILEGES IN SCHEMA public.
--       In default projects, permissions are often granted broadly to anon and authenticated,
--       but live project configuration can alter these defaults.
--    c. RLS Policy Enforcement: Evaluated only when table-level privileges exist. Provides
--       row-by-row filtering and access control.
--    d. Live Project Status: The production project's live ACLs and default privileges have
--       not been verified. These tables have NOT been deployed to production.
--
-- 2. ACCESS TIERS REQUIRING DISTINCT POLICIES:
--    a. Authenticated Client Access (role: authenticated):
--       - Students: SELECT on course_applications, course_application_documents,
--         and course_application_events WHERE user_id = auth.uid().
--         INSERT of documents for owned applications.
--         UPDATE/DELETE strictly prohibited directly from client.
--       - Administrators: SELECT, UPDATE on applications assigned or authorized via
--         profile role verification (public.profile.role = 'admin').
--    b. Anonymous Guest Submission (role: anon):
--       - Submitting new applications (DEC-02) and initial documents.
--       - DIRECT table SELECT/UPDATE/DELETE MUST BE FORBIDDEN to prevent PII harvesting,
--         data tampering, and enumeration attacks.
--       - Submissions should be routed through a validated, rate-limited server API /
--         trusted RPC rather than exposing broad anon INSERT on public tables.
--    c. Trusted Server-Side Operations (role: service_role / SECURITY DEFINER):
--       - Notification Outbox worker: Exclusive processor of public.notification_outbox.
--         Client roles (anon, authenticated) must have ZERO access to notification_outbox.
--       - Guest Claim Processor: Atomic claiming RPC verifying SHA-256 token hashes.
--       - Enrollment Activation: Atomic approval RPC executing under advisory lock.
--
-- 3. CONSEQUENCES OF ENABLING RLS WITHOUT POLICIES:
--    - Running `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` without CREATE POLICY
--      statements enforces a complete DENY-BY-DEFAULT for anon and authenticated users.
--    - All client PostgREST queries will fail with HTTP 401/403.
--    - Server operations using service_role bypass RLS, but client UI flows will break
--      unless granular policies or dedicated RPCs are deployed in unison.
--
-- 4. AUDIT LOG SECURITY IS NOT GENERAL TABLE SECURITY:
--    - While public.course_application_audit_logs is protected against UPDATE, DELETE,
--      and TRUNCATE via triggers and REVOKE, this does NOT protect it against unauthorized
--      SELECT of sensitive audit trails (IPs, user agents, diffs).
--    - Furthermore, it provides ZERO security for the other 4 tables.
--
-- RLS enablement statements and granular policies will be formally drafted and reviewed
-- in the dedicated security phase prior to deployment.
-- ====================================================================
-- END OF SCHEMA MIGRATION DRAFT (V1.3.3)
-- ====================================================================
