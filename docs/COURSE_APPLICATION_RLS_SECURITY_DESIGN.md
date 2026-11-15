# PathFinder Course Application Management System — Database Access-Control & RLS Security Design Specification

**Document Version:** 1.7.0  
**Phase:** 3.4.8 — Enrollment SQL Runtime, Audit-State Preservation, Business-Rule and Schema Reconciliation  
**Date:** 15 November 2026  
**Status:** **PROPOSED SECURITY DESIGN SPECIFICATION — NOT YET IMPLEMENTED OR EXECUTED**  
**Repository:** `F:/Project/pathfinder-forge-52`  
**Active Feature Branch:** `feature/course-application-management`  
**Consolidation Feature Commit:** `43a0e0de277a9eac749bd9c53921ee0db52ea9a3`  

---

> [!CAUTION]
> **CRITICAL PRE-DEPLOYMENT NOTICE & ARCHITECTURAL STATUS:**  
> This document is a comprehensive security design specification, privilege audit, and threat model. **It does NOT represent active or deployed database security configurations.**  
> Row Level Security (RLS) is currently **NOT** enabled on the five course application tables in any database, and no policies, grants, views, or storage buckets have been created in production.  
> Production database deployment is strictly blocked until this design is independently reviewed and approved.

---

### Document Revision History

| Version | Phase | Date | Primary Author / Focus | Key Architectural Changes |
| :--- | :--- | :--- | :--- | :--- |
| **V1.0.0** | Phase 3.4 | 15 Nov 2026 | Antigravity Engine | Initial standalone RLS & access-control design specification, threat model, and 5-table permission matrix. |
| **V1.1.0** | Phase 3.4.1 | 15 Nov 2026 | Antigravity Engine (Audit Corrections) | Reconciled client privileges: revoked direct client UPDATE on applications; restricted document/event INSERTs; introduced column grants and candidate view. |
| **V1.2.0** | Phase 3.4.3 | 15 Nov 2026 | Antigravity Engine (Security Hardening) | Decoupled grants, RLS, triggers; introduced atomic RPCs; standardized `SET search_path = ''`; reconciled admin queue access. |
| **V1.3.0** | Phase 3.4.4 | 15 Nov 2026 | Antigravity Engine (Schema Alignment) | Corrected event types, audit-log `actor_role` and `notes`, outbox templates, and initial idempotency logic. |
| **V1.4.0** | Phase 3.4.5 | 15 Nov 2026 | Antigravity Engine (Consolidated Corrections) | Consolidated SQL Validity, Lifecycle & Outbox Reliability: replaced invalid catalog calls with `GREATEST`/`LEAST`, fully implemented 6-target RPC, 6-case enrollment idempotency, outbox lease recovery and dead-letter. |
| **V1.5.0** | Phase 3.4.6 | 15 Nov 2026 | Antigravity Engine (Lifecycle & Revocation) | Added payment validation NULL guard against SQL three-valued logic, occurrence-aware notification keys, 6-scenario non-overlapping enrollment matrix, and 8-column outbox table. |
| **V1.6.0** | Phase 3.4.7 | 15 Nov 2026 | Antigravity Engine (Authorization, FK & Runtime) | Reconciled actor authorization (`auth.users`), documented `admin-guard.ts` boundary, analyzed `ON DELETE SET NULL`, eliminated unassigned RECORD crash with scalar variables, hardened revocation identity validation, and specified `V1.1_enrollments_users_lifecycle.sql`. |
| **V1.7.0** | Phase 3.4.8 | 15 Nov 2026 | Antigravity Engine (Runtime, Audit & Schema Reconciliation) | **Enrollment SQL Runtime, Audit-State Preservation, Business-Rule & Schema Reconciliation:**<br/>1. **Enrollment Schema & Column Alignment:** Reconciled conflicting schema evidence (`BACKEND_SUPABASE_SETUP.md` vs Phase 2.8 Step 46 preflight audit vs architecture docs). Aligned RPC to insert `enrollment_date` (not `enrolled_at`), maintained explicit `course_id::text` casting, preserved DEC-01 (`courses.id TEXT`), and retained live-schema verification as a mandatory Phase 3.5 deployment prerequisite.<br/>2. **Deterministic UUID Reconciliation:** Eliminated unsupported `min(id)` and `v_candidate_record RECORD` aggregation. Replaced with deterministic, strongly-typed count query and `SELECT id INTO v_candidate_id ... LIMIT 1` scalar UUID assignment.<br/>3. **DEC-03 Business Rule Alignment:** Decoupled academic approval from finance enrollment activation. Academic approval requires document verification (`documents_status = 'verified'`) without payment prerequisites; payment verification (`verified`, `waived`, `not_required`) is strictly enforced upon enrollment activation (`enrolled`).<br/>4. **Genuine Previous-State Audit Preservation:** Introduced typed `v_prev_app public.course_applications%ROWTYPE` snapshot taken immediately upon locking. Ensured `previous_state` is never overwritten by `RETURNING * INTO v_app` or corrupted by `ON DELETE SET NULL` cascades.<br/>5. **Notification Writer Locking Boundary Proven:** Audited codebase to verify event writers. Confirmed 0 event writers exist in `src/` today; proved `rpc_admin_transition_application_status` acquires `course_applications FOR UPDATE` before sequence calculation; documented boundary guarantees, limitations, and future database sequence constraint prerequisite. |

---

## 1. Executive Summary

The PathFinder Course Application Management System manages the end-to-end admissions lifecycle for candidate researchers, academic students, and guest applicants. Because application dossiers contain sensitive Personally Identifiable Information (PII)—including government identification proofs, academic transcripts, telephone numbers, financial payment references, and administrative assessment notes—the underlying database layer requires an uncompromising, defense-in-depth access-control architecture.

In standard Supabase environments, the public schema's default privileges grant broad `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions to client API roles (`anon` and `authenticated`) unless explicitly revoked or constrained by Row Level Security (RLS). Furthermore, enabling RLS without defining explicit policies activates PostgreSQL's default deny-all behavior, which would abruptly break client workflows.

This specification establishes a robust, mathematically verifiable least-privilege security architecture for the five tables introduced in `supabase_course_applications_schema_v1.sql`:

1. **Authenticated Student Tier (`authenticated`):** Granted strictly scoped, row-level read access to owned applications, documents, and progress events. Direct client updates, status alterations, payment verifications, and cross-tenant reads are mathematically forbidden. Sensitive claim tokens (`guest_claim_token_hash`, `guest_claim_token_expires_at`) are excluded from client SELECT grants and isolated behind a `security_invoker = true` candidate-facing view.
2. **Anonymous Guest Tier (`anon`):** Direct table `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations are completely denied. Submissions are mediated via trusted server endpoints to prevent PII harvesting, table flooding, and enumeration attacks. Guest claiming is governed by an atomic, cryptographically verified single-use token workflow that derives identity directly from the caller's verified JWT (`auth.uid()`) and returns generic failure responses to prevent enumeration.
3. **Administrative & Trusted Server Tier (`service_role` / Authorized Server Functions):** Sensitive administrative mutations (academic approvals, document rejection, fee waivers, payment verification, enrollment activation) and background asynchronous processing (transactional email dispatch, audit logging) execute through validated server endpoints and atomic PostgreSQL transactions. Direct client `UPDATE` on applications and direct client `INSERT` on events and documents are completely revoked from client roles.
4. **Asynchronous Notification Worker:** Background email workers operate under a clear state-machine model (`pending` $	o$ `processing` $	o$ `sent` / `failed` / `dead_letter`). Job claiming occurs atomically via a PostgreSQL stored procedure using `FOR UPDATE SKIP LOCKED` with automatic recovery for expired worker leases. `DELETE` privileges are completely revoked.

---

## 2. Scope and Non-Goals

### 2.1 In Scope
- Access-control design and RLS policy specifications for all 5 new application tables:
  1. `public.course_applications`
  2. `public.course_application_documents`
  3. `public.course_application_events`
  4. `public.course_application_audit_logs`
  5. `public.notification_outbox`
- Candidate-facing view specification (`public.candidate_course_applications`) isolating sensitive token columns with `security_invoker = true`.
- Complete atomic multi-table lifecycle transaction architecture via PostgreSQL stored procedure `rpc_admin_transition_application_status` complying with exact schema constraints.
- Complete 6-case enrollment idempotency and reconciliation specification under dual-key advisory locking.
- Atomic notification worker dequeue/claim procedure `rpc_dequeue_notification_batch` using `FOR UPDATE SKIP LOCKED` with lease recovery, bounded parameters, and dead-letter handling.
- Stable notification idempotency key strategy.
- Supabase Storage security design for the private bucket `course-application-documents`.
- Function ownership strategy, execution grants, caller identity propagation, and `SET search_path = ''` hardening.
- Complete working administrator queue-access workflow reconciling server guards (`ADMIN_EMAILS`) with database RLS.
- Threat modeling across 14 distinct attack scenarios with concrete mitigation controls.
- Comprehensive cross-document consistency table reconciling schema, architecture, migrations, and security design.

### 2.2 Out of Scope (Non-Goals for Phase 3.4.8)
- **Zero SQL Execution:** No SQL statements, triggers, functions, or policies will be executed against Supabase or any local/remote database during this phase.
- **Zero Code Modifications:** No changes to existing React/TypeScript frontend routes, server functions, or schema migration files.
- **Storage Bucket Creation:** The private bucket `course-application-documents` will be specified conceptually, not provisioned on live infrastructure.
- **Modifications to Existing Pre-existing Schemas:** Existing schemas (`courses`, `enrollments_users`, `profile`, `users`, `mentors`) will not be altered.
- **Modifications to Phase 3.3 Artifacts:** `supabase_course_applications_schema_v1.sql`, `docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md`, and `docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md` remain strictly read-only references.

---

## 3. Verified Current Architecture & Authorization Findings

A comprehensive, read-only inspection of the repository source code was conducted to determine the actual mechanisms governing authentication, authorization, and database access.

### 3.1 Source Inspection Findings Summary

| Architectural Area | Inspected Source File(s) | Verified Implementation Reality | Security Classification |
| :--- | :--- | :--- | :--- |
| **Client Supabase Initialization** | [`src/utils/supabase.ts`](file:///F:/Project/pathfinder-forge-52/src/utils/supabase.ts) | Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (`anon` key) with `persistSession: true` and `detectSessionInUrl: true`. All direct client PostgREST calls run under PostgreSQL `anon` or `authenticated` roles. | **Verified Fact** |
| **Server Supabase Administration** | [`src/lib/server/supabase-admin.ts`](file:///F:/Project/pathfinder-forge-52/src/lib/server/supabase-admin.ts) | Exports `supabaseAdmin` proxy using `SUPABASE_SERVICE_ROLE_KEY`. Configured with `persistSession: false` and `autoRefreshToken: false`. Fails closed if keys are missing. Operates as `service_role` (bypasses RLS). | **Verified Fact** |
| **Client Admin Route Guard** | [`src/lib/adminAuth.ts`](file:///F:/Project/pathfinder-forge-52/src/lib/adminAuth.ts)<br/>[`src/routes/admin.tsx`](file:///F:/Project/pathfinder-forge-52/src/routes/admin.tsx) | Client-side `isAdminLoggedIn()` merely checks `localStorage.getItem("mf_admin_user")` and checks for stored auth token keys. It is purely cosmetic/UX protection and can be easily bypassed by browser manipulation. | **Verified Fact (UX Only)** |
| **Authoritative Server Admin Guard** | [`src/lib/server/admin-guard.ts`](file:///F:/Project/pathfinder-forge-52/src/lib/server/admin-guard.ts) | Authoritative `verifyAdminSession(authToken)` calls `supabaseAdmin.auth.getUser(token)`. Validates admin status by checking: (1) `user.app_metadata.role IN ('admin', 'super_admin')`, OR (2) server environment variable `ADMIN_EMAILS`. Explicitly rejects user-mutable `user_metadata.role` and legacy client tokens. | **Verified Fact (Server Enforced)** |
| **User Profile Role & Database Triggers** | [`supabase_auth_profile_schema.sql`](file:///F:/Project/pathfinder-forge-52/supabase_auth_profile_schema.sql)<br/>[`supabase_auth_profile_role_security_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_auth_profile_role_security_v1.sql) | Table `public.profile` has column `role TEXT DEFAULT 'user'`. Trigger `trg_prevent_profile_role_escalation` forces `role := 'user'` unless the executing role is `service_role`. Prevents self-escalation. | **Verified Fact** |
| **Spin Wheel Security Precedent** | [`supabase_spin_wheel_rls_lockdown_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_spin_wheel_rls_lockdown_v1.sql)<br/>[`src/lib/server/spin-wheel-security.ts`](file:///F:/Project/pathfinder-forge-52/src/lib/server/spin-wheel-security.ts) | Employs strict deny-by-default RLS (`USING (false)` for anon/authenticated), explicit `REVOKE ALL FROM anon, authenticated, public`, and executes atomic mutations via `supabaseAdmin.rpc(...)` server-side. | **Verified Fact (Precedent)** |
| **RPC Search-Path Hardening Precedent** | [`supabase_auth_admin_rpc_lockdown_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_auth_admin_rpc_lockdown_v1.sql#L15) | Enforces `SET search_path = ''` on administrative RPC functions to prevent search-path hijacking attacks. | **Verified Fact (Precedent)** |
| **Existing Storage Handling** | [`src/utils/supabase-storage.ts`](file:///F:/Project/pathfinder-forge-52/src/utils/supabase-storage.ts) | Operates on public bucket `article-images`. Lacks signed private URL handling or binary magic-byte inspection. | **Verified Fact** |

---

## 4. Five-Table Access-Control Matrix (Decoupled & Reconciled)

To eliminate any ambiguity between SQL privilege grants, Row Level Security (RLS) predicates, and runtime trigger enforcement, this matrix rigorously distinguishes:
- **Table-Level Grants:** SQL privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) granted or revoked on the relation itself.
- **Column-Level Grants:** Explicit SQL privileges restricted to specific column sets.
- **Row-Level Security (RLS):** SQL row-filtering expressions (`USING` / `WITH CHECK`) evaluated by the query planner.
- **Trigger-Enforced Restrictions:** Programmatic `BEFORE` triggers that abort operations at runtime via `RAISE EXCEPTION`. (Note: Trigger aborts occur at runtime and are distinct from query planning parse-time privilege revocation).
- **Trusted Server (`service_role`):** Backend operations executing via `supabaseAdmin` with `BYPASSRLS`.

### 4.1 Reconciled Privilege Matrix

| Table Name | Database Role | Table-Level SQL Privilege | Column-Level SQL Grants | RLS Row Condition (`USING` / `WITH CHECK`) | Runtime Trigger Enforcement | Effective Access Summary & Mandatory Invariants |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **`public.course_applications`** | `anon` | **REVOKED (ALL)** | None | Deny-All (RLS enabled, zero policies) | None | **Zero Client Access.** Submissions handled exclusively via server function `submitCourseApplicationServerFn`. |
| | `authenticated` (Student) | **REVOKED (ALL)** | `GRANT SELECT (id, application_number, user_id, course_id, student_name, student_email, student_phone, academic_background, statement_of_purpose, status, payment_status, payment_reference, payment_amount_inr, assigned_admin_id, enrollment_id, rejection_reason, resubmission_notes, submitted_at, approved_at, rejected_at, created_at, updated_at)` | `USING (user_id = auth.uid())` | None (Direct client UPDATE/INSERT/DELETE are rejected at query plan time via privilege revocation). | **Read-Only Owned Applications.** Claim token hash & expiry excluded from column grant. Polled via `candidate_course_applications` view (`security_invoker = true`). Cannot view other applicants. |
| | `authenticated` (Admin) | **REVOKED (ALL)** | Same column set as `authenticated` | `USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'))` | Direct client UPDATE/INSERT/DELETE rejected at query plan time. | **Read-Only Queue Inspection.** Direct client `UPDATE` is completely revoked. Administrative mutations routed through atomic server RPC. |
| | `service_role` (Trusted Server) | `GRANT ALL` | All columns | Full RLS Bypass (`BYPASSRLS`) | `validate_course_application_course_id()` validates `course_id` existence. | **Full Server Access.** Executes atomic state transitions, payment verifications, and enrollment linkage via `rpc_admin_transition_application_status`. |
| **`public.course_application_documents`** | `anon` | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** Upload tickets generated server-side. |
| | `authenticated` (Student) | `GRANT SELECT` | All columns | `USING (application_id IN (SELECT id FROM public.course_applications WHERE user_id = auth.uid()))` | Direct client INSERT/UPDATE/DELETE rejected at query plan time via privilege revocation. | **Read-Only Owned Document Metadata.** Direct client `INSERT` revoked. Metadata written strictly server-side post magic-byte validation. |
| | `authenticated` (Admin) | `GRANT SELECT` | All columns | `USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'))` | Direct client INSERT/UPDATE/DELETE rejected at query plan time. | **Read-Only Inspection.** Document verification and archival status transitions handled server-side. |
| | `service_role` (Trusted Server) | `GRANT ALL` | All columns | Full RLS Bypass (`BYPASSRLS`) | None | **Full Server Access.** Inserts metadata post-upload confirmation. Toggles `is_archived` on resubmissions. |
| **`public.course_application_events`** | `anon` | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** |
| | `authenticated` (Student) | `GRANT SELECT` | All columns | `USING (application_id IN (SELECT id FROM public.course_applications WHERE user_id = auth.uid()))` | Direct client INSERT/UPDATE/DELETE rejected at query plan time. | **Read-Only Progress Timeline.** Milestone events visible to applicant. Client cannot forge approval or enrollment milestones. |
| | `authenticated` (Admin) | `GRANT SELECT` | All columns | `USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'))` | Direct client INSERT/UPDATE/DELETE rejected at query plan time. | **Read-Only Inspection.** Events emitted atomically with application status changes server-side. |
| | `service_role` (Trusted Server) | `GRANT SELECT, INSERT` | All columns | Full RLS Bypass (`BYPASSRLS`) | `UPDATE` and `DELETE` revoked from all roles. Events are strictly immutable. | **Append-Only Timeline Emission.** Emits events atomically during application state transitions using schema-validated `event_type` and `actor_type`. |
| **`public.course_application_audit_logs`** | `anon` | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** |
| | `authenticated` (Student) | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** Confidential compliance trail; student progress tracked via `course_application_events`. |
| | `authenticated` (Admin) | `GRANT SELECT` | All columns | `USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')` | `UPDATE`, `DELETE`, and `TRUNCATE` rejected by trigger `prevent_course_application_audit_log_mutation()`. | **Restricted Compliance Read.** Accessible only to `super_admin`. Immutable audit trail. |
| | `service_role` (Trusted Server) | `GRANT SELECT, INSERT` | All columns | Full RLS Bypass (`BYPASSRLS`) | `prevent_course_application_audit_log_mutation()` unconditionally aborts any `UPDATE`, `DELETE`, or `TRUNCATE`. | **Append-Only Compliance Logging.** Writes audit logs atomically inside administrative RPCs supplying `actor_role` and `notes`. Immutable. |
| **`public.notification_outbox`** | `anon` | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** |
| | `authenticated` (Student) | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** Confidential queue containing recipient emails and payload tokens. |
| | `authenticated` (Admin) | **REVOKED (ALL)** | None | Deny-All | None | **Zero Client Access.** |
| | `service_role` / Worker | `GRANT SELECT, INSERT, UPDATE` | All columns | Full RLS Bypass (`BYPASSRLS`) | **`DELETE` privilege is strictly REVOKED.** Completed jobs remain marked `'sent'`. | **Worker Execution.** Worker claims batches atomically via `rpc_dequeue_notification_batch()` using `FOR UPDATE SKIP LOCKED`. |

---

## 5. Sensitive Column Protection & Candidate View Architecture

### 5.1 The Column Security Vulnerability in Standard RLS
In PostgreSQL, Row Level Security (RLS) filters rows, **not columns**. If table-level `SELECT` is granted to `authenticated`:
```sql
-- DANGEROUS PATTERN: Grants access to all columns of visible rows
GRANT SELECT ON TABLE public.course_applications TO authenticated;
```
When a student queries `SELECT * FROM course_applications WHERE id = :id`, PostgreSQL returns every column in that row, including:
- `guest_claim_token_hash TEXT`
- `guest_claim_token_expires_at TIMESTAMPTZ`

Exposing cryptographic token hashes or expiration timestamps to clients enables offline pre-computation, dictionary attacks, and token enumeration.

### 5.2 Defensible Column Security Architecture
To solve this vulnerability, the system enforces a two-layer defense-in-depth architecture:

#### Layer 1: Column-Level Privilege Grants on Base Table
Table-wide `SELECT` is **revoked** from `authenticated`, `anon`, and `PUBLIC`. Instead, PostgreSQL column-level privileges are granted explicitly on non-sensitive columns:
```sql
-- 1. Baseline lockdown: Revoke table-wide SELECT
REVOKE SELECT ON TABLE public.course_applications FROM PUBLIC, anon, authenticated;

-- 2. Grant column-specific SELECT to authenticated users (excluding claim tokens)
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
    assigned_admin_id,
    enrollment_id,
    rejection_reason,
    resubmission_notes,
    submitted_at,
    approved_at,
    rejected_at,
    created_at,
    updated_at
) ON TABLE public.course_applications TO authenticated;
```
*Behavior under PostgREST:* If a client attempts `SELECT * FROM course_applications`, PostgreSQL raises an immediate permission violation (`SQLSTATE 42501: permission denied for column guest_claim_token_hash`). The client is forced to explicitly request granted columns.

#### Layer 2: Canonical Candidate-Facing View (`security_invoker = true`)
To prevent client PostgREST wildcard selection errors while guaranteeing column omission, a public view is provided:
```sql
CREATE OR REPLACE VIEW public.candidate_course_applications
WITH (security_invoker = true) AS
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
    payment_reference,
    payment_amount_inr,
    assigned_admin_id,
    enrollment_id,
    rejection_reason,
    resubmission_notes,
    submitted_at,
    approved_at,
    rejected_at,
    created_at,
    updated_at
FROM public.course_applications;

GRANT SELECT ON public.candidate_course_applications TO authenticated;
```
*Why `security_invoker = true` is critical:* In PostgreSQL 15+, a view created with `security_invoker = true` evaluates underlying RLS policies and privileges using the **querying user's permissions** (`auth.uid()`), rather than the view owner's permissions. This guarantees that:
1. Row ownership RLS (`user_id = auth.uid()`) is strictly enforced on the view.
2. The view can never be used to bypass RLS.
3. Sensitive claim tokens do not exist in the view definition and can never be retrieved by clients.

---

---

---

---

## 6. Atomic Transaction Architecture & Administrative Lifecycle Stored Procedure

### 6.1 Vulnerability of Chained PostgREST / Supabase JS Requests
In many naive implementations, a complex administrative lifecycle state transition is attempted across multiple chained client or server-side Supabase JS SDK calls:
```typescript
// HAZARDOUS ANTI-PATTERN: Multiple stateless HTTP requests
await supabaseAdmin.from('course_applications').update({ status: 'approved' }).eq('id', appId);
await supabaseAdmin.from('course_application_events').insert({ ... });
await supabaseAdmin.from('course_application_audit_logs').insert({ ... });
await supabaseAdmin.from('notification_outbox').insert({ ... });
await supabaseAdmin.from('enrollments_users').insert({ ... });
```
**Why this breaks atomicity and data integrity:**
1. PostgREST operates over stateless HTTP. Each SDK method call issues an independent HTTP request that commits in its own database transaction.
2. If step 4 (outbox insert) or step 5 (enrollment insert) fails due to a network timeout, constraint violation, or server crash, steps 1 through 3 remain committed.
3. The database enters an inconsistent, corrupt state.
4. Concurrency hazards: Two administrators approving simultaneously could create duplicate enrollments or mismatched timeline states.

### 6.2 Architectural Requirement: Single PostgreSQL Stored Procedure / RPC
All multi-table atomic lifecycle operations **MUST be encapsulated in a single PostgreSQL stored procedure / function** called via `supabaseAdmin.rpc(...)`. PostgreSQL guarantees that functions execute within a single atomic transaction: either all mutations commit together, or all roll back automatically.

### 6.3 Complete Application Lifecycle State Machine Reconciliation
The actual database schema (`public.course_applications.status`) permits eleven states:
`'draft'`, `'submitted'`, `'under_review'`, `'resubmission_required'`, `'resubmitted'`, `'approved'`, `'enrolled'`, `'rejected'`, `'cancelled'`, `'revoked'`, and `'suspended'`.

To ensure complete architectural clarity and enforce DEC-03, operational boundaries and lifecycle paths are explicitly delineated:

| Transition | Initiating Actor | Execution Mechanism | Preconditions & Validation Rules | Resulting Events & Notifications |
| :--- | :--- | :--- | :--- | :--- |
| **`draft` → `submitted`** | Student (Guest/Auth) | `submitCourseApplicationServerFn` (Server) | Dossier complete; valid course UUID. | Event: `SUBMITTED`. Outbox: `application_received`. |
| **`submitted` / `resubmitted` → `under_review`** | Admin Reviewer | `rpc_admin_transition_application_status` (RPC) | Initiates academic evaluation. May repeat after resubmissions. | Event: `UNDER_REVIEW`. Outbox: `review_started`. |
| **`under_review` → `resubmission_required`** | Admin Reviewer | `rpc_admin_transition_application_status` (RPC) | Requires non-empty `resubmission_notes`. May repeat if documents remain inadequate. | Event: `RESUBMISSION_REQUESTED`. Outbox: `resubmission_required`. |
| **`resubmission_required` → `resubmitted`** | Student Applicant | `confirmDocumentUploadServerFn` (Server) | Replacement document uploaded and verified. | Event: `RESUBMITTED`. No direct outbox (re-enters queue). |
| **`under_review` → `approved`** | Admin Reviewer | `rpc_admin_transition_application_status` (RPC) | **DEC-03 Academic Approval:** Purely academic/document vetting (`documents_status = 'verified'`). Sets `approved_at = now()`. **Payment is NOT required for approval.** | Event: `APPROVED`. Outbox: `application_approved`. |
| **`approved` → `enrolled`** | Admin Reviewer / System | `rpc_admin_transition_application_status` (RPC) | **DEC-03 Enrollment Activation:** Requires prior `approved` status AND confirmed payment (`payment_status IN ('verified', 'waived', 'not_required')`). Advisory lock. Snapshot deduplication. Idempotent. | Event: `ENROLLED`. Outbox: `enrollment_confirmed`. |
| **`under_review` → `rejected`** | Admin Reviewer | `rpc_admin_transition_application_status` (RPC) | Terminal negative state. Requires non-empty `rejection_reason`. Sets `rejected_at = now()`. | Event: `REJECTED`. Outbox: `application_rejected`. |
| **`submitted` / `resubmission_required` → `cancelled`** | Student Applicant | `cancelApplicationServerFn` (Server) | Terminal voluntary withdrawal. Caller owns application (`user_id = auth.uid()`). | Event: `CANCELLED`. No outbox. |
| **`approved` / `enrolled` → `revoked`** | Admin Superuser | `rpc_admin_transition_application_status` (RPC) | Terminal administrative revocation. Requires non-empty `p_reason`. Access immediately terminated. | Event: `REVOKED`. Outbox: `enrollment_revoked`. |
| **`under_review` / `enrolled` → `suspended`** | Admin Superuser | `suspendApplicationServerFn` (Server) | Administrative hold pending investigation. | Future administrative workflow. |

#### Repeatable Lifecycle Cycles & Multi-Occurrence State Flow
The application state machine is not strictly linear. Applications legitimately cycle through evaluation phases:
1. **Document Resubmission Cycles:** An application in `under_review` may be moved to `resubmission_required`, updated by the student to `resubmitted`, and moved back to `under_review`.
2. **Post-Resubmission Evaluations:** Multiple review cycles may occur if submitted materials remain incomplete or illegible.
3. **Re-Evaluation Following Administrative Override:** An application previously in `rejected` or `revoked` might be reopened by a super-administrator upon an appeal.

### 6.4 Enrollment Idempotency & Reconciliation (Complete 6-Scenario Non-Overlapping Analysis)

The activation of an application into `enrolled` status must interact with `public.enrollments_users`. To prevent duplicate course allocations, orphan records, or concurrent race conditions, the stored procedure enforces a mutually exclusive, collectively exhaustive 6-scenario decision matrix:

#### Detailed Scenario Breakdown
1. **Scenario 1: Verified Idempotent Re-Execution (`status = 'enrolled'`, valid link exists)**
   - **Initial State:** `v_old_status = 'enrolled'` and `v_app.enrollment_id IS NOT NULL`.
   - **Verification:** Locks and inspects `public.enrollments_users WHERE id = v_app.enrollment_id`. Confirms `student_email` (case-insensitive, trimmed) and `course_id::text` match.
   - **Action:** No mutation. Returns `v_app` immediately.
2. **Scenario 2: Corrupted Enrollment Reference (`status = 'enrolled'`, link exists but row is missing or mismatched)**
   - **Initial State:** `v_old_status = 'enrolled'` and `v_app.enrollment_id IS NOT NULL`, but referenced row does not exist or attributes mismatch.
   - **Action:** Strictly aborts with `data_exception`. Refuses automatic recovery without administrative investigation.
3. **Scenario 3: Standard Green-Field Enrollment (`status = 'approved'`, `enrollment_id IS NULL`, 0 existing rows)**
   - **Initial State:** `v_old_status = 'approved'`, `v_app.enrollment_id IS NULL`.
   - **Operation:** Under dual-key advisory lock, counts matching rows (`v_match_count = 0`). Inserts fresh row into `public.enrollments_users` (`student_name`, `student_email`, `course_id`, `enrollment_date`). Sets `v_enrollment_id` to returned ID.
4. **Scenario 4: Pre-Existing Manual Enrollment Reconciliation (`status = 'approved'`, `enrollment_id IS NULL`, exactly 1 existing row)**
   - **Initial State:** `v_old_status = 'approved'`, `v_app.enrollment_id IS NULL`, but a row already exists in `public.enrollments_users` for `(student_email, course_id)`.
   - **Operation:** Under advisory lock, detects `v_match_count = 1`. Deterministically selects `id INTO v_candidate_id ... LIMIT 1`. Reconciles by linking `enrollment_id = v_candidate_id` without creating a duplicate row.
5. **Scenario 5: Ambiguous Duplicate Collision (`status = 'approved'`, `enrollment_id IS NULL`, >1 existing rows)**
   - **Initial State:** `v_old_status = 'approved'`, `v_app.enrollment_id IS NULL`, and multiple matching rows exist in `enrollments_users`.
   - **Action:** Strictly aborts with `data_exception` (`Multiple conflicting enrollment records found`). Requires manual database cleanup.
6. **Scenario 6: Self-Healing Anomalous Enrollment (`status = 'enrolled'`, `enrollment_id IS NULL`)**
   - **Initial State:** Application is marked `enrolled`, but `enrollment_id` was cleared or unlinked.
   - **Subcase 6A (1 match):** Deterministically selects `id INTO v_candidate_id ... LIMIT 1`. Links application to existing enrollment row and emits compliance audit log `RECONCILE_ENROLLMENT_LINK`.
   - **Subcase 6B (0 matches):** Inserts fresh enrollment row under advisory lock, sets link, and emits audit log `RECONCILE_ENROLLMENT_CREATE`.
   - **Subcase 6C (>1 matches):** Strictly aborts with `data_exception`.

| Scenario # & Name | Initial Application Status | Existing `enrollment_id` | Matching Rows in `enrollments_users` | Payment Prerequisite | Action Executed | Audit Action Recorded |
| :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **1. Confirmed Active** | `enrolled` | Valid UUID | Exactly 1 (Valid) | Verified / Waived | Early return `v_app` (Idempotent No-Op) | None (No mutation) |
| **2. Corrupted Reference** | `enrolled` | Stale / Mismatched UUID | 0 or Mismatched | Irrelevant | Strictly Abort (`data_exception`) | None (Transaction rolls back) |
| **3. Green-Field Activation** | `approved` | `NULL` | Exactly 0 | Verified / Waived | Lock advisory; insert new row; set link | `ACTIVATE_ENROLLMENT` |
| **4. Existing Reconciled** | `approved` | `NULL` | Exactly 1 | Verified / Waived | Lock advisory; reuse UUID (`LIMIT 1`); set link | `ACTIVATE_ENROLLMENT_LINK_EXISTING` |
| **5. Duplicate Collision** | `approved` | `NULL` | > 1 | Verified / Waived | Strictly Abort (`data_exception`) | None (Transaction rolls back) |
| **6A. Self-Healing Link** | `enrolled` | `NULL` | Exactly 1 | Verified / Waived | Lock advisory; link existing row (`LIMIT 1`) | `RECONCILE_ENROLLMENT_LINK` |
| **6B. Self-Healing Create** | `enrolled` | `NULL` | Exactly 0 | Verified / Waived | Lock advisory; insert new row; set link | `RECONCILE_ENROLLMENT_CREATE` |
| **6C. Self-Healing Conflict** | `enrolled` | `NULL` | > 1 | Verified / Waived | Strictly Abort (`data_exception`) | None (Transaction rolls back) |

### 6.5 Transactional Occurrence-Aware Notification Idempotency Strategy

#### Vulnerability of Static Idempotency Keys on Repeatable Transitions
In early naive designs, notification keys used static strings: `'notif_' || p_application_id::text || '_' || v_template_name`.
When an application legitimately repeated review cycles (`under_review` → `resubmission_required` → `resubmitted` → `under_review`), the second review notification conflicted with the existing outbox key, silently suppressing the student notification via `ON CONFLICT DO NOTHING`.

#### Transactional Occurrence-Aware Derivation Algorithm
To eliminate notification suppression while maintaining network retry idempotency, notification keys are derived from historical milestone events:

```sql
SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
FROM public.course_application_events
WHERE application_id = p_application_id
  AND event_type = v_event_type;

v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;
```

#### Lifecycle Properties, Locking Protocol Boundary & Concrete Codebase Reality
1. **Concurrency Serialization Protocol:**
   Inside `rpc_admin_transition_application_status`, the application row is locked exclusively via:
   `SELECT * INTO v_app FROM public.course_applications WHERE id = p_application_id FOR UPDATE;`
   Because this lock is acquired *before* computing `v_occurrence_seq` and inserting milestone events, concurrent executions of `rpc_admin_transition_application_status` on the same application are strictly serialized.
2. **Concrete Codebase Audit of Event & Outbox Writers:**
   An empirical search across the entire repository confirmed the following reality:
   - **`src/` Application Code:** Contains **ZERO** writers to `course_application_events` or `notification_outbox`. Server functions for application management (`submitCourseApplicationServerFn`, `confirmDocumentUploadServerFn`, `cancelApplicationServerFn`) have not yet been implemented in TypeScript and are scheduled for future implementation phases.
   - **SQL Specifications:** The **ONLY** concrete SQL implementation writing to these tables is `rpc_admin_transition_application_status`.
   - **Lock Acquisition Timing:** In `rpc_admin_transition_application_status`, the parent application lock `FOR UPDATE` is acquired in Step 1, strictly *before* calculating the occurrence sequence in Step 2/3 and inserting events in Step 4.
3. **Protocol Limitations & Non-Enforcement Scenarios:**
   - **Uncoordinated Writers:** The event-count approach serializes only cooperating writers that acquire `course_applications FOR UPDATE`. An external script, uncoordinated microservice, or direct administrative SQL insert that writes to `course_application_events` without locking the parent application row could race and produce duplicate sequence numbers.
   - **Future Server Functions Requirement:** In Phase 3.5, every server function that writes to `course_application_events` or `notification_outbox` must be explicitly implemented to acquire `SELECT ... FROM public.course_applications WHERE id = ... FOR UPDATE` before deriving occurrence sequences.
4. **Permanent Database Sequence Constraint Prerequisite (Phase 3.5):**
   To convert this cooperative convention into an absolute database-enforced relational constraint independent of application logic, Phase 3.5 will introduce:
   ```sql
   ALTER TABLE public.course_application_events ADD COLUMN occurrence_seq INT NOT NULL DEFAULT 1;
   CREATE UNIQUE INDEX uq_app_events_occurrence ON public.course_application_events (application_id, event_type, occurrence_seq);
   ```

### 6.6 Schema-Accurate Stored Procedure Specification: `rpc_admin_transition_application_status`

```sql
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

    -- Verify actor exists in auth.users (Defensible database-level existence check)
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
        -- If already enrolled, verify enrollment link integrity (Scenario 1 & 2)
        IF p_target_status = 'enrolled' AND v_app.enrollment_id IS NOT NULL THEN
            SELECT * INTO v_enrollment_row
            FROM public.enrollments_users
            WHERE id = v_app.enrollment_id;

            IF NOT FOUND OR pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
               OR v_enrollment_row.course_id::text != v_app.course_id::text THEN
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

        -- Occurrence-aware sequence derivation
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

        -- DEC-03 Academic & Document Verification Prerequisite
        -- Admissions approval is based strictly on academic merit and document verification.
        -- Payment completion is NOT required for academic approval; it is enforced before enrollment activation.
        IF v_app.documents_status != 'verified' THEN
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

        -- Occurrence-aware sequence derivation
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

        -- Occurrence-aware sequence derivation
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

        -- Occurrence-aware sequence derivation
        SELECT COALESCE(pg_catalog.count(*), 0) + 1 INTO v_occurrence_seq
        FROM public.course_application_events
        WHERE application_id = p_application_id
          AND event_type = v_event_type;
        v_idempotency_key := 'notif_' || p_application_id::text || '_' || pg_catalog.lower(v_event_type) || '_' || v_occurrence_seq::text;

    -- -----------------------------------------------------------------
    -- BRANCH E: ACTIVATE ENROLLMENT (enrolled) - DEC-03 Finance Prereq
    -- -----------------------------------------------------------------
    ELSIF p_target_status = 'enrolled' THEN
        -- Scenario 1 & 2: Already enrolled and has valid enrollment_id
        IF v_old_status = 'enrolled' AND v_app.enrollment_id IS NOT NULL THEN
            SELECT * INTO v_enrollment_row
            FROM public.enrollments_users
            WHERE id = v_app.enrollment_id;

            IF NOT FOUND OR pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
               OR v_enrollment_row.course_id::text != v_app.course_id::text THEN
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
                pg_catalog.hashtext(v_app.course_id::text)
            );

            -- Deterministic matching row count
            SELECT count(*) INTO v_match_count
            FROM public.enrollments_users
            WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
              AND course_id::text = v_app.course_id::text;

            IF v_match_count = 1 THEN
                -- Subcase 6A: Exactly one match -> retrieve scalar UUID deterministically
                SELECT id INTO v_candidate_id
                FROM public.enrollments_users
                WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                  AND course_id::text = v_app.course_id::text
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
                -- Subcase 6B: Zero matches -> create fresh enrollment row using enrollment_date
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
                -- Subcase 6C: Conflicting matches -> fail safely
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

        -- DEC-03 Payment Precondition Enforcement (Finance Clearance)
        IF v_app.payment_status IS NULL OR v_app.payment_status NOT IN ('verified', 'waived', 'not_required') THEN
            RAISE EXCEPTION 'Payment verification required before enrollment (current payment_status: %)', COALESCE(v_app.payment_status, 'NULL')
                USING ERRCODE = 'check_violation';
        END IF;

        -- Dual-key transaction-scoped advisory lock on (student_email, course_id)
        PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(pg_catalog.lower(pg_catalog.btrim(v_app.student_email))),
            pg_catalog.hashtext(v_app.course_id::text)
        );

        -- Snapshot-consistent deduplication query on public.enrollments_users
        SELECT count(*) INTO v_match_count
        FROM public.enrollments_users
        WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
          AND course_id::text = v_app.course_id::text;

        -- Scenario 4: Exactly one matching record -> Reuse UUID
        IF v_match_count = 1 THEN
            SELECT id INTO v_candidate_id
            FROM public.enrollments_users
            WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
              AND course_id::text = v_app.course_id::text
            LIMIT 1;

            v_enrollment_id := v_candidate_id;
            v_audit_action := 'ACTIVATE_ENROLLMENT_LINK_EXISTING';
            v_audit_notes := 'Linked to pre-existing enrollment record: ' || v_enrollment_id::text;

        -- Scenario 5: Multiple conflicting records -> Fail safely
        ELSIF v_match_count > 1 THEN
            RAISE EXCEPTION 'Multiple conflicting enrollment records (%) found for student % and course %. Manual administrative reconciliation required.',
                v_match_count, v_app.student_email, v_app.course_id
                USING ERRCODE = 'data_exception';

        -- Scenario 3: Zero matching records -> Insert safely under advisory lock using enrollment_date
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

        -- Occurrence-aware sequence derivation
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

        -- Revocation Semantics & Access Termination Handling
        IF v_old_status = 'approved' THEN
            -- Case 1: Was approved but never enrolled (no enrollments_users row created)
            v_enrollment_id := NULL;
            v_audit_notes := 'Approval revoked prior to enrollment: ' || p_reason;

        ELSIF v_old_status = 'enrolled' THEN
            -- Case 2: Was enrolled; must revoke student dashboard access
            IF v_app.enrollment_id IS NOT NULL THEN
                -- Lock referenced enrollment row FOR UPDATE to prevent concurrent modifications
                SELECT * INTO v_enrollment_row
                FROM public.enrollments_users
                WHERE id = v_app.enrollment_id
                FOR UPDATE;

                IF NOT FOUND THEN
                    -- Referenced record is already missing (stale link)
                    v_audit_notes := 'Enrollment revoked (referenced record ' || v_app.enrollment_id::text || ' was already absent in enrollments_users): ' || p_reason;
                    v_deleted_enrollment_id := NULL;
                    v_deleted_enrollment_json := NULL;
                ELSE
                    -- Identity validation: ensure referenced enrollment matches application student and course
                    IF pg_catalog.lower(pg_catalog.btrim(v_enrollment_row.student_email)) != pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                       OR v_enrollment_row.course_id::text != v_app.course_id::text THEN
                        RAISE EXCEPTION 'Referenced enrollment % belongs to mismatched student (% vs %) or course (% vs %). Refusing deletion. Manual administrative reconciliation required.',
                            v_app.enrollment_id, v_enrollment_row.student_email, v_app.student_email, v_enrollment_row.course_id, v_app.course_id
                            USING ERRCODE = 'data_exception';
                    END IF;

                    -- Check if this enrollment_id is referenced by another application
                    SELECT count(*) INTO v_shared_count
                    FROM public.course_applications
                    WHERE enrollment_id = v_app.enrollment_id
                      AND id != p_application_id;

                    IF v_shared_count > 0 THEN
                        RAISE EXCEPTION 'Cannot automatically revoke enrollment %: record is referenced by % other application(s). Manual administrative intervention required.',
                            v_app.enrollment_id, v_shared_count
                            USING ERRCODE = 'check_violation';
                    END IF;

                    -- In Current Schema (v1.0), enrollments_users lacks a status column.
                    -- Perform targeted deletion of the verified unshared enrollment row.
                    DELETE FROM public.enrollments_users
                    WHERE id = v_app.enrollment_id;

                    -- Populate scalar and JSONB snapshot variables safely (no unassigned record access)
                    v_deleted_enrollment_id := v_enrollment_row.id;
                    v_deleted_enrollment_json := pg_catalog.row_to_json(v_enrollment_row)::jsonb;
                    v_audit_notes := 'Enrollment revoked and access removed for record ' || v_app.enrollment_id::text || ': ' || p_reason;
                END IF;
            ELSE
                -- Anomalous state: enrolled without an enrollment_id
                SELECT count(*) INTO v_match_count
                FROM public.enrollments_users
                WHERE pg_catalog.lower(pg_catalog.btrim(student_email)) = pg_catalog.lower(pg_catalog.btrim(v_app.student_email))
                  AND course_id::text = v_app.course_id::text;

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

        -- Occurrence-aware sequence derivation
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
        metadata
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
        )
    );

    -- 5. Insert Compliance Audit Log (Schema-Compliant)
    -- Crucial: previous_state uses v_prev_app (pre-mutation snapshot), guaranteeing
    -- genuine pre-transition values even if ON DELETE SET NULL cascades or update occurred.
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
```

### 6.7 Advisory Lock Protocol Limitation
The dual-key transaction-scoped advisory lock:
`pg_advisory_xact_lock(hashtext(email), hashtext(course_id::text))`
coordinates only *cooperative* callers that explicitly acquire the same lock. If an external script, developer, or legacy procedure inserts directly into `public.enrollments_users` without acquiring this advisory lock, a duplicate enrollment could theoretically be created. True mathematical uniqueness requires an actual unique index:
`CREATE UNIQUE INDEX uq_enrollments_users_email_course ON public.enrollments_users (lower(btrim(student_email)), course_id);`
Because `public.enrollments_users` is a pre-existing production table whose contents have not been audited for duplicates, creating this unique index is classified as a **Future Schema Change Requiring Separate Authorization in Phase 3.5**.

---

### 6.8 Enrollment Revocation Semantics & Access Termination Architecture

#### The Operational Vulnerability of Shallow Revocation
In naive designs, revoking an application merely sets `course_applications.status = 'revoked'`.
Inspection of the Pathfinder codebase reveals why this shallow approach fails to protect course content:
1. **Student Dashboard Direct Query:** As verified in [`src/routes/dashboard/courses.tsx:34-42`](file:///F:/Project/pathfinder-forge-52/src/routes/dashboard/courses.tsx#L34-L42) and [`src/routes/dashboard/index.tsx:38-44`](file:///F:/Project/pathfinder-forge-52/src/routes/dashboard/index.tsx#L38-L44), the student portal queries `public.enrollments_users` directly using the student's verified session email:
   ```typescript
   // src/routes/dashboard/courses.tsx
   const { data: enrollments } = await supabase
     .from("enrollments_users")
     .select("course_id")
     .eq("student_email", userEmail);
   ```
2. **Access Persistence:** The student dashboard never inspects `public.course_applications` to determine whether a student can access course materials, watch lectures, or join private WhatsApp cohorts.
3. **The Danger:** If an application is revoked in `course_applications` while its corresponding row in `public.enrollments_users` remains active, **the student continues to enjoy full, uninterrupted access to the course indefinitely**.

#### Foreign-Key Constraint Analysis (`ON DELETE SET NULL`)
In `supabase_course_applications_schema_v1.sql:115`, the foreign-key relationship is explicitly defined:
`enrollment_id UUID REFERENCES public.enrollments_users(id) ON DELETE SET NULL`
This foreign-key specification establishes critical database behaviors:
1. **Referential Cascades on Deletion:** When a row in `public.enrollments_users` is deleted, PostgreSQL automatically executes `ON DELETE SET NULL`, setting `course_applications.enrollment_id = NULL` on any application row referencing it.
2. **The Shared Enrollment Hazard:** If multiple applications were linked to the same enrollment row (e.g. from an un-coordinated manual linking script or dual-program scenario), deleting the single `enrollments_users` row would automatically and silently nullify `enrollment_id` on other applications. This is why the procedure enforces a mandatory shared-dependency check (`v_shared_count > 0`), strictly refusing automatic deletion if any other application references the enrollment.
3. **Physical Deletion as an Operational Compromise:** Physically deleting a record from `public.enrollments_users` destroys historical operational data. It is an **interim operational compromise forced solely by the current v1.0 schema's lack of an `is_active` or `status` column**. It should not be presented as a permanent, ideal relational architecture.

#### Comprehensive Schema Source Reconciliation & Audit Evidence
An exhaustive audit of checked-in files, architecture documents, and previous preflight records reveals significant discrepancies in how `public.enrollments_users` is described across project artifacts:

| Column / Attribute | `docs/BACKEND_SUPABASE_SETUP.md` | `docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md` | `src/routes/admin/enrollments.tsx` & `dashboard/index.tsx` | Phase 2.8 Step 46 Preflight Evidence | Authoritative Resolution for Version 1.7.0 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `UUID PRIMARY KEY` | `id: string` | `id UUID` | **`UUID PRIMARY KEY`** (Consistently verified across all sources). |
| **`student_email`** | `TEXT NOT NULL` | `TEXT NOT NULL` | `student_email: string` | `student_email TEXT` | **`TEXT NOT NULL`** (Consistently verified; filtered case-insensitively via `lower(btrim(...))`). |
| **`course_id`** | `TEXT NOT NULL` | `TEXT NOT NULL` (DEC-01) | Queried as FK / slug | Recorded as `UUID NULL` in preflight | **Explicit Casting (`course_id::text`):** DEC-01 authoritatively defines `courses.id TEXT`. To prevent runtime crashes regardless of whether `enrollments_users.course_id` is physically `UUID` or `TEXT`, all RPC comparisons cast explicitly to `::text`. |
| **Timestamp Column** | **`enrolled_at TIMESTAMPTZ`** | **`enrollment_date TIMESTAMPTZ`** | `admin/enrollments.tsx` queries **`enrollment_date`**; `dashboard/index.tsx:66` queries `enrolled_at` (causing PostgREST error 400!) | Recorded as **`enrollment_date TIMESTAMPTZ`**; confirmed **`enrolled_at` DOES NOT EXIST** | **`enrollment_date TIMESTAMPTZ` is Authoritative:** The RPC inserts `enrollment_date`. `BACKEND_SUPABASE_SETUP.md` is early setup documentation, and `dashboard/index.tsx:66` was identified in Phase 2.8 Step 46 as having a bug because it queried `enrolled_at`. |
| **`student_name`** | Omitted in setup doc | Included in Architecture insert | Displayed in admin table | Recorded as `student_name TEXT` in preflight | **`student_name TEXT`** (Included in insert; populated from `v_app.student_name`). |
| **`status` / Lifecycle** | Does NOT exist | Does NOT exist | Does NOT exist | Does NOT exist | **Missing in v1.0:** Table lacks lifecycle column. Requires physical deletion or Phase 3.5 migration `V1.1_enrollments_users_lifecycle.sql`. |

**Mandatory Pre-Deployment Prerequisite:**
Because live database access is strictly prohibited during design phases, the exact live column types of `public.enrollments_users` cannot be compiled against live PostgreSQL today. **A live read-only schema inspection of `public.enrollments_users` remains an explicit, mandatory pre-deployment prerequisite before executing any migration in Phase 3.5.**

#### Current Schema (v1.0) Architecture & Operational Strategy
In the current production database, `public.enrollments_users` has the following schema:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `student_name TEXT`
- `student_email TEXT NOT NULL`
- `course_id` (matched via `::text` casting)
- `enrollment_date TIMESTAMPTZ DEFAULT now()`
- `created_at TIMESTAMPTZ`

Crucially, **`public.enrollments_users` does not currently possess a `status`, `is_active`, or `revoked_at` column**.
Under this current schema, the system executes the following safe, auditable revocation strategy:

1. **Pre-Enrollment Revocation (`status = 'approved'`):**
   - The candidate was approved, but enrollment was not activated.
   - `enrollment_id` is `NULL`; zero rows exist in `public.enrollments_users`.
   - The RPC updates `course_applications.status = 'revoked'`, emits the `REVOKED` milestone event, logs the action in `course_application_audit_logs`, and enqueues `'enrollment_revoked'` in the outbox.
   - No mutation is required on `enrollments_users`.
2. **Post-Enrollment Revocation (`status = 'enrolled'` with valid `enrollment_id`):**
   - The candidate is actively enrolled.
   - **Row-Level Concurrency Protection:** The procedure locks the referenced enrollment row via `SELECT * INTO v_enrollment_row FROM public.enrollments_users WHERE id = v_app.enrollment_id FOR UPDATE;`.
   - **Identity & Integrity Validation:** If the row exists, the procedure validates:
     - `lower(btrim(v_enrollment_row.student_email)) = lower(btrim(v_app.student_email))`
     - `v_enrollment_row.course_id::text = v_app.course_id::text`
     If either attribute mismatches, the procedure **strictly aborts with `data_exception`**, refusing to delete an enrollment that belongs to another student or course.
   - **Shared Enrollment Check:** The procedure checks whether any other application references the same `enrollment_id` (`SELECT count(*) FROM course_applications WHERE enrollment_id = ... AND id != ...`). If shared, the RPC immediately aborts with `check_violation`, preventing accidental de-enrollment of another applicant and requiring manual administrative handling.
   - **Targeted Deletion with Complete Audit Capture:** If unshared, the procedure deletes the specific row:
     `DELETE FROM public.enrollments_users WHERE id = v_app.enrollment_id;`
   - **Zero Audit Loss Guarantee:** Because hard deletion removes the operational row from `enrollments_users`, the procedure captures the complete deleted record (`id`, `student_name`, `student_email`, `course_id`, `enrollment_date`) as structured JSON in `v_deleted_enrollment_json`, preserved in both `course_application_events.metadata` and `course_application_audit_logs.previous_state`.
   - **Access Immediate Termination:** Because the row is deleted, the student dashboard query (`.from("enrollments_users").eq("student_email", userEmail)`) immediately ceases returning the course ID. Access is terminated in real time.
3. **Anomalous Enrolled Revocation (`status = 'enrolled'` with NULL `enrollment_id`):**
   - The procedure queries matching rows in `enrollments_users`:
     - If 0 matching rows exist: the procedure safely completes revocation and logs the event.
     - If 1 or more matching rows exist: because the link was missing, deleting a record blindly risks removing an unrelated manual enrollment. The procedure immediately aborts with `data_exception`, requiring an administrator to reconcile the record.

#### Future Schema Change (Target State v1.1 — Phase 3.5 Migration)
Soft-deactivation is architecturally superior to physical deletion for enterprise audit compliance. The following migration is specified for implementation in Phase 3.5:

```sql
-- FUTURE SCHEMA CHANGE (To be executed in Phase 3.5 upon authorization):
ALTER TABLE public.enrollments_users
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'suspended')),
ADD COLUMN revoked_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN revoked_reason TEXT DEFAULT NULL,
ADD COLUMN revoked_by UUID DEFAULT NULL REFERENCES auth.users(id);

CREATE INDEX idx_enrollments_users_active_lookup
ON public.enrollments_users (lower(btrim(student_email)), course_id)
WHERE status = 'active';
```

Upon deploying this future schema change, revocation transitions from `DELETE` to soft update:
`UPDATE public.enrollments_users SET status = 'revoked', revoked_at = now(), revoked_reason = p_reason, revoked_by = p_actor_id WHERE id = v_app.enrollment_id;`
and the student dashboard query in `src/routes/dashboard/courses.tsx` will be updated to:
`supabase.from("enrollments_users").select("course_id").eq("student_email", userEmail).eq("status", "active");`

#### Comprehensive Revocation & Access Control State Machine

| Initial Status | Target Status | Preconditions & Inputs | Operations on `course_applications` | Operations on `enrollments_users` | Progress Event Emitted | Compliance Audit Log Action | Outbox Dispatch |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`approved`** | **`revoked`** | `p_reason` non-empty | Sets `status = 'revoked'`, `enrollment_id = NULL` | None (`enrollments_users` row was never created) | `REVOKED` (`actor_type = 'admin'`) | `REVOKE_ENROLLMENT` (`notes = 'Approval revoked prior to enrollment'`) | Enqueues `'enrollment_revoked'` |
| **`enrolled`** (Valid Link) | **`revoked`** | `p_reason` non-empty; `enrollment_id` matches student & course; `v_shared_count = 0` | Sets `status = 'revoked'`, `enrollment_id = NULL` | Deletes unshared row in `enrollments_users` via verified ID | `REVOKED` (captures `deleted_enrollment_id` in metadata) | `REVOKE_ENROLLMENT` (captures full snapshot in `previous_state`) | Enqueues `'enrollment_revoked'` |
| **`enrolled`** (Shared Link) | **`revoked`** | `v_shared_count > 0` | **ABORTS TRANSACTION** (`check_violation`) | None (Mutation blocked) | None (Rolled back) | None (Rolled back) | None |
| **`enrolled`** (Mismatched Link) | **`revoked`** | Student email or course ID differs | **ABORTS TRANSACTION** (`data_exception`) | None (Mutation blocked) | None (Rolled back) | None (Rolled back) | None |
| **`enrolled`** (Anomalous NULL Link, 0 DB matches) | **`revoked`** | `p_reason` non-empty; 0 matches in `enrollments_users` | Sets `status = 'revoked'` | None (Row already absent) | `REVOKED` | `REVOKE_ENROLLMENT` (`notes = 'Revocation completed for unlinked application'`) | Enqueues `'enrollment_revoked'` |
| **`enrolled`** (Anomalous NULL Link, ≥1 DB matches) | **`revoked`** | Link NULL but matching rows exist in `enrollments_users` | **ABORTS TRANSACTION** (`data_exception`) | None (Prevents accidental deletion of unlinked enrollment) | None (Rolled back) | None (Rolled back) | None |

---

## 7. Document Metadata Permissions & Upload Security

### 7.1 Reconciled Document Metadata Model
Direct client `INSERT` on `public.course_application_documents` is **COMPLETELY DENIED** to students, guests, and administrators. 

Document metadata is inserted **strictly server-side** following binary upload verification. This guarantees that:
- Clients cannot forge file sizes or MIME types.
- Clients cannot associate documents with applications they do not own.
- Clients cannot inject forged SHA-256 hashes.
- Clients cannot upload unapproved file types disguised with valid extensions.

### 7.2 End-to-End Secure Upload Workflow
1. **Pre-flight Ticket Request (`requestDocumentUploadTicketServerFn`):**
   - Student calls server function with their JWT auth token, declaring `applicationId`, `documentType`, `fileName`, `declaredSizeBytes`, and `mimeType`.
   - Server validates caller's session via `supabase.auth.getUser(token)` and confirms application ownership (`user_id = auth.uid()`).
   - Server checks application status: must be `'draft'` or `'resubmission_required'`.
   - Server validates declared size ($\le 10,485,760$ bytes) and MIME type (`application/pdf`, `image/jpeg`, `image/png`).
   - Server generates a deterministic, tenant-isolated storage path:
     `applications/{application_id}/{document_type}/{random_uuid}_{sanitized_basename}.{ext}`
   - Server creates a short-lived **signed upload URL** (15-minute TTL) via `supabaseAdmin.storage.from('course-application-documents').createSignedUploadUrl(storagePath)`.
   - Returns signed URL and temporary ticket token to the client.
2. **Binary Upload to Private Storage:**
   - Client uploads binary directly to the signed upload URL in Supabase Storage. Direct public read on the bucket is disabled.
3. **Upload Confirmation & Magic-Byte Verification (`confirmDocumentUploadServerFn`):**
   - Client notifies server function upon upload completion.
   - Server downloads the first 512 bytes of the uploaded file directly from private storage to perform authoritative **magic-byte inspection**:
     - **PDF:** starts with `%PDF-` (`0x25 0x50 0x44 0x46`)
     - **JPEG:** starts with `0xFF 0xD8 0xFF`
     - **PNG:** starts with `PNG


` (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`)
   - Server computes the SHA-256 hash across the entire binary.
   - If verification succeeds, server writes the metadata record into `public.course_application_documents` using `supabaseAdmin` (`service_role`).
   - If resubmitting, previous active documents of the same type are atomically marked `is_archived = true` with `archived_at = now()`.
   - Emits a timeline event to `public.course_application_events` (`event_type = 'RESUBMITTED'`, `actor_type = 'student'`).
4. **Handling Failed or Abandoned Uploads:**
   - If a client requests a ticket but never uploads the file, or if magic-byte inspection fails, **no database record is ever created** in `course_application_documents`.
   - A daily background maintenance script scans `course-application-documents` for storage objects created $> 24$ hours ago that lack a corresponding row in `course_application_documents` and permanently purges them.

---

## 8. Application Events Access Model & Atomicity

### 8.1 Reconciled Event Permissions
Direct client `INSERT`, `UPDATE`, and `DELETE` on `public.course_application_events` are **COMPLETELY DENIED** to all client roles (`anon`, `authenticated` students, and `authenticated` administrators).

### 8.2 Event Generation Principles
1. **Strict Server-Side Atomicity:** Every event in `course_application_events` is inserted inside the same database transaction as the underlying application state transition via `rpc_admin_transition_application_status` or document confirmation.
2. **Schema Adherence:** Every insert supplies all mandatory columns: `application_id`, `event_type`, `actor_type`, `title`, and uses only values permitted by the schema's CHECK constraint (`DRAFT_CREATED`, `SUBMITTED`, `UNDER_REVIEW`, `RESUBMISSION_REQUESTED`, `RESUBMITTED`, `APPROVED`, `PAYMENT_VERIFIED`, `ENROLLED`, `REJECTED`, `CANCELLED`, `CLAIMED_BY_USER`, `REVOKED`).
3. **No Orphaned or Fabricated Events:** Because clients cannot insert into this table, a student can never forge an `APPROVED` or `ENROLLED` milestone event, and an administrator cannot create uncoordinated events.
4. **Immutability:** Event rows are historical timeline facts. They are never updated or deleted by application code. Cascading deletion occurs only if the entire parent application dossier is purged.

---

## 9. Canonical Administrator Authorization & Complete Queue Access Strategy

### 9.1 The Authorization Divergence & Working Queue Strategy
Inspection of the codebase revealed a dual authorization reality:
- **Server Guard (`src/lib/server/admin-guard.ts`):** Authoritatively validates admin access by checking: (1) `user.app_metadata.role IN ('admin', 'super_admin')`, OR (2) server environment variable `ADMIN_EMAILS`.
- **Database RLS Policies:** Evaluated by PostgreSQL inside the database engine. PostgreSQL cannot access Node.js process environment variables (`process.env.ADMIN_EMAILS`).

**The Critical Architectural Problem:** If administrators are listed in `ADMIN_EMAILS` but do not have `app_metadata.role` provisioned in Supabase Auth, they pass the server guard for mutations, but **cannot read the application queue** if the dashboard queries PostgREST directly with client JWT tokens! An administrator cannot review applications without a functional queue reading mechanism.

### 9.2 Complete Working Queue-Access Architecture (Two Pathways)

```mermaid
flowchart TD
    AdminUser["Admin User (Browser)"] --> Choice{Dashboard Architecture}
    
    subgraph PathwayA["Pathway A: Server-Mediated Dashboard (Default & Authoritative)"]
        Choice -->|Queue Reads & Mutations| ServerRoutes["Server Functions (src/lib/server/)<br/>- listApplicationsAdminServerFn<br/>- getApplicationDetailsAdminServerFn<br/>- approveApplicationServerFn"]
        ServerRoutes -->|verifyAdminSession(token)| Guard["admin-guard.ts<br/>(Validates app_metadata.role OR ADMIN_EMAILS)"]
        Guard -->|Passes| ServiceClient["supabaseAdmin (service_role)<br/>Full Queue Access (Bypasses RLS)"]
        ServiceClient -->|Retrieves Dossiers & Queues| DB[(PostgreSQL Database)]
    end
    
    subgraph PathwayB["Pathway B: Direct PostgREST Client RLS (Optional Optimization)"]
        Choice -->|Direct Client Reads| DirectREST["supabase.from('course_applications').select(...)"]
        DirectREST -->|Requires Provisioned JWT| PG_RLS["PostgreSQL RLS Policy:<br/>(auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')"]
        PG_RLS -->|Prerequisite: Provisioned| PermittedRead[Returns Application Rows]
        PG_RLS -->|Unprovisioned / ADMIN_EMAILS only| DeniedRead["DENIED (0 rows / 403 Forbidden)"]
    end
```

### 9.3 Detailed Queue-Access Specifications

#### Pathway A: Server-Mediated Administrative Dashboard (Default & Fully Functional)
To guarantee that all administrators (including those authenticated via `ADMIN_EMAILS`) have complete read and write access immediately:
1. **Queue Retrieval (`listApplicationsAdminServerFn`):**
   - Frontend invokes `listApplicationsAdminServerFn({ filter, page, pageSize })` with the admin auth token.
   - Server function validates caller using `verifyAdminSession(authToken)`.
   - Upon verification, the function queries `course_applications` using `supabaseAdmin` (`service_role`), applying search, status filtering, and pagination.
   - Returns application summaries to the admin client.
2. **Dossier Detail Retrieval (`getApplicationDetailsAdminServerFn`):**
   - Retrieves application details, associated documents, timeline events, and audit logs via `supabaseAdmin`.
3. **Status Transitions:**
   - Invokes `rpc_admin_transition_application_status` via `supabaseAdmin.rpc(...)`.

#### Pathway B: Direct PostgREST Client Access (Requires Auth Provisioning Prerequisite)
If direct client-side querying via `@supabase/supabase-js` is desired for the admin dashboard:
1. **Prerequisite Migration / Hook:** All administrative accounts in `ADMIN_EMAILS` must have their `raw_app_meta_data` updated to include `{"role": "admin"}` in `auth.users`.
2. **Enforcement:** Direct PostgREST queries evaluate:
   ```sql
   CREATE POLICY course_applications_admin_select_policy
   ON public.course_applications
   FOR SELECT
   TO authenticated
   USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));
   ```
3. **Explicit Rule:** Until Pathway B's prerequisite provisioning is confirmed on live infrastructure, **Pathway A is the mandatory, authoritative design standard**.

### 9.4 Actor Authorization, Identity Integrity & Defense-in-Depth Execution Model

To establish an authorization architecture that accurately reflects the verified Pathfinder codebase, the execution model reconciles server-side authentication guards, database role grants, and audit log attribution:

#### 1. Codebase Verification: Real vs. Assumed Authorization Structures
An empirical audit of the repository root, SQL migration scripts, and server code reveals the actual authorization reality:
- **`public.admin_users` Does Not Exist:** There is no `admin_users` table anywhere in the repository or database schema. Any SQL condition querying `public.admin_users` fails at runtime with `relation "public.admin_users" does not exist`.
- **`public.profile` (Singular) Schema:** The user profile relation is `public.profile` (singular), defined in `supabase_auth_profile_schema.sql:8` as:
  `CREATE TABLE public.profile (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email TEXT NOT NULL, name TEXT NOT NULL, mobile TEXT, college TEXT, degree TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);`
- **Role Escalation Lockdown:** As enforced in `supabase_auth_profile_role_security_v1.sql`, normal users cannot alter `public.profile.role` or escalate privileges. However, `public.profile.role` defaults to `'user'` and is not populated for all administrators.
- **Authoritative Server Guard (`src/lib/server/admin-guard.ts`):** The canonical administrative authentication mechanism is `verifyAdminSession(authToken)`. It authenticates users via `supabaseAdmin.auth.getUser(token)` and validates admin status via two distinct checks:
  1. Authoritative `user.app_metadata.role`: accepts `'admin'` or `'super_admin'`.
  2. Server environment allowlist: `process.env.ADMIN_EMAILS`.
  - **Mutable Metadata Explicitly Ignored:** The guard strictly ignores `user.user_metadata.role` (user-mutable) to prevent privilege escalation.

#### 2. Clear Architectural Distinctions Across the Authorization Boundary
To prevent logical conflation between application code and database engine guarantees, the system explicitly separates four distinct security layers:

```mermaid
flowchart TD
    subgraph ClientLayer["1. Client / Browser Boundary"]
        ClientUser["Admin Browser"] -->|HTTP REST / RPC| PostgREST["PostgREST API Gateway"]
        PostgREST -->|REVOKE EXECUTE (anon, auth)| DeniedClient["403 Forbidden<br/>(Client cannot execute RPC)"]
    end

    subgraph ServerLayer["2. Server-Side Authentication Layer"]
        ClientUser -->|Authenticated Request + JWT| ServerFn["Server Functions (src/lib/server/)"]
        ServerFn -->|verifyAdminSession(token)| Guard["admin-guard.ts<br/>- app_metadata.role IN ('admin', 'super_admin')<br/>OR<br/>- email IN ADMIN_EMAILS"]
        Guard -->|Validates & Extracts| AdminId["Verified adminUser.userId"]
    end

    subgraph DatabaseLayer["3. Database Execution & Validation Layer"]
        ServerFn -->|p_actor_id = adminUser.userId<br/>(via SUPABASE_SERVICE_ROLE_KEY)| RPC["rpc_admin_transition_application_status"]
        RPC -->|Step 0 Validation| AuthCheck["EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor_id)"]
        AuthCheck -->|Valid User| ExecuteMutations["Execute Row Mutations & Events"]
        AuthCheck -->|Invalid User| Abort["Abort (insufficient_privilege)"]
    end

    subgraph AuditLayer["4. Audit Actor Attribution"]
        ExecuteMutations --> AuditLogs["course_application_audit_logs<br/>actor_id = p_actor_id<br/>(Operational Traceability)"]
        ExecuteMutations --> Events["course_application_events<br/>actor_id = p_actor_id<br/>(Timeline Attribution)"]
    end
```

1. **Server-Side Administrator Authentication:** Handled exclusively in Node.js/TanStack Start server code (`verifyAdminSession()`). This is the authoritative gatekeeper that verifies the administrator's JWT, checks `app_metadata.role IN ('admin', 'super_admin')` or `ADMIN_EMAILS`, and extracts `adminUser.userId`.
2. **Service-Role Execution Boundary:** Direct browser execution of `rpc_admin_transition_application_status` is revoked (`REVOKE EXECUTE FROM PUBLIC, anon, authenticated`). PostgREST immediately blocks any direct client call. The stored procedure is executable ONLY by `service_role`, held in encrypted server environment variables (`SUPABASE_SERVICE_ROLE_KEY`).
3. **Database-Level Administrator Validation:** Inside the database, Step 0 of the stored procedure validates that `p_actor_id` is NOT NULL and exists as a real user in `auth.users`:
   ```sql
   IF p_actor_id IS NULL THEN
       RAISE EXCEPTION 'p_actor_id is required and cannot be NULL'
           USING ERRCODE = 'not_null_violation';
   END IF;

   IF NOT EXISTS (
       SELECT 1 FROM auth.users WHERE id = p_actor_id
   ) THEN
       RAISE EXCEPTION 'Actor % is not a registered user in auth.users', p_actor_id
           USING ERRCODE = 'insufficient_privilege';
   END IF;
   ```
   **Why this check is defensively calibrated:** PostgreSQL cannot inspect Node.js environment variables (`process.env.ADMIN_EMAILS`). If the database procedure demanded that `p_actor_id` have `role = 'admin'` in `auth.users` or `public.profile`, legitimate administrators authorized via `ADMIN_EMAILS` through the established server guard would be **incorrectly rejected** by the database. Validating existence in `auth.users` ensures the actor is a real registered account while relying on the server gateway for role determination.
4. **Audit Actor Attribution (Honest Cryptographic Assessment):** The verified `p_actor_id` is recorded in `course_application_events.actor_id` and `course_application_audit_logs.actor_id`. This establishes **operational accountability and compliance traceability**. It does **not** constitute absolute mathematical or cryptographic non-repudiation, because `service_role` passes `p_actor_id` as an input parameter. True cryptographic non-repudiation would require hardware-backed signatures or database-native authentication tokens.

#### 3. Missing Prerequisite for Database-Native Admin Verification (Phase 3.5)
If project leadership requires the database engine to independently enforce administrator role checks without trusting the server guard:
- **Required Future Schema Prerequisite:** An authorized migration must synchronize all administrator emails in `ADMIN_EMAILS` into `auth.users.raw_app_meta_data->>'role' = 'admin'` or populate a dedicated database role table.
- Until such a migration is executed on production, **the trusted server guard (`admin-guard.ts`) is the authoritative authorization boundary**, and the database procedure performs existence validation on `auth.users`.

---

## 10. SECURITY DEFINER Hardening, Search-Path Convention & Ownership Strategy

### 10.1 Hardened Search-Path Convention (`SET search_path = ''`)
In accordance with the repository's established security lockdown standard ([`supabase_auth_admin_rpc_lockdown_v1.sql:15`](file:///F:/Project/pathfinder-forge-52/supabase_auth_admin_rpc_lockdown_v1.sql#L15)) and PostgreSQL CIS security benchmarks:
- **Every `SECURITY DEFINER` function MUST set `SET search_path = ''`.**
- Setting `search_path = ''` completely prevents search-path hijacking attacks where a malicious user creates a Trojan function, type, or operator in a writable schema (such as `public`).
- **All database relations, functions, and system utilities MUST be explicitly schema-qualified**:
  - Relations: `public.course_applications`, `public.course_application_events`, `public.course_application_audit_logs`, `public.notification_outbox`, `public.enrollments_users`, `auth.users`
  - System Functions: `pg_catalog.now()`, `pg_catalog.lower()`, `pg_catalog.btrim()`, `pg_catalog.encode()`, `pg_catalog.to_char()`, `pg_catalog.hashtext()`, `pg_catalog.pg_advisory_xact_lock()`, `pg_catalog.array_agg()`, `pg_catalog.jsonb_build_object()`, `pg_catalog.lpad()`, `pg_catalog.nextval()`, `pg_catalog.timezone()`
  - Extension Functions: `extensions.digest()`, `pg_catalog.gen_random_uuid()`
  - Built-in SQL Language Constructs: `COALESCE`, `GREATEST`, `LEAST`, and `NULLIF` are standard SQL expressions, not functions in `pg_catalog`. They are written bare without catalog qualification.

### 10.2 Function Ownership Strategy: Removing Unverified Role Assumptions
In standard Supabase PostgreSQL environments, custom roles such as `app_owner` or `auth_admin` **do not exist**. Specifying `OWNER TO app_owner;` without provisioning DDL will immediately crash database migrations with:
`ERROR: role "app_owner" does not exist`.

This specification establishes two concrete strategies, distinguishing verified reality from future proposals:

#### Strategy 1: Supabase Native Standard (Recommended Baseline)
- **Proposed Owner:** `postgres` (the default database owner and superuser in Supabase).
- **Required Privileges & RLS Behavior:**
  - As `postgres`, the function possesses necessary privileges on `public` tables and read access to `auth.users(id, email, email_confirmed_at)`.
  - Functions owned by `postgres` have superuser status and bypass RLS on internal tables.
- **Defense-in-Depth Lockdown:**
  - Because `postgres` is highly privileged, execution permissions on the functions are tightly restricted:
    - Direct client RPCs (`claim_guest_course_application`): `REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated;`
    - Administrative RPCs (`rpc_admin_transition_application_status`): `REVOKE EXECUTE FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;`
  - Hardened with `SET search_path = ''` and fully qualified identifiers.

#### Strategy 2: Dedicated Least-Privilege Custom Role (Future Provisioning Prerequisite)
If project leadership requires eliminating `postgres` function ownership in a future phase:
- **Required Provisioning DDL (Prerequisite):**
  ```sql
  -- Mandatory Prerequisite DDL before assigning ownership:
  CREATE ROLE app_owner WITH NOLOGIN NOBYPASSRLS INHERIT;
  GRANT USAGE ON SCHEMA public TO app_owner;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_owner;
  GRANT SELECT (id, email, email_confirmed_at) ON auth.users TO app_owner;
  ```
- **RLS Behavior:** Because `app_owner` has `NOBYPASSRLS`, it is subject to RLS on any table where it is not the table owner, or on all tables if `FORCE ROW LEVEL SECURITY` is enabled.
- **Classification:** Strategy 2 is classified strictly as an **Unverified Future Prerequisite**. Strategy 1 is the active, implementable baseline.

---

## 11. Guest-Claim RPC Caller Identity Propagation & Generic Failure Response

### 11.1 Identity Propagation & Anti-Enumeration Defense
The guest-claim function (`claim_guest_course_application`) must verify that the claiming user owns the email address associated with the application without leaking enumeration information to attackers:
1. **Derive Identity from Context:** Caller identity is derived exclusively from `auth.uid()`. Caller-supplied email parameters are forbidden.
2. **Explicit Authentication Check:** If `auth.uid()` is null, raises an `insufficient_privilege` exception (`SQLSTATE 42501`). This clearly distinguishes unauthenticated callers from claim validation failures.
3. **Verified Account Requirement:** Authenticated user account must possess `email_confirmed_at IS NOT NULL`.
4. **Cryptographic Verification:** Supplied plain token is hashed with SHA-256 and compared against `guest_claim_token_hash`.
5. **Token Invalidation:** Successful claiming atomically nullifies both `guest_claim_token_hash` and `guest_claim_token_expires_at`.
6. **Anti-Hijacking:** If `user_id` is already populated on the application dossier, the claim fails closed. An already linked application can never be reassigned.
7. **Generic Failure Response:** If an application ID is not found, token is invalid, token is expired, application is already claimed, or email does not match, the function **returns `FALSE`** uniformly.
8. **Residual Timing Side-Channel Caveat:** While generic boolean responses prevent error message leakage and user-enumeration via distinct exception messages, database query execution and cryptographic comparison introduce minor microsecond-level timing variations. Database overhead and index scanning differences mean that timing variance cannot be 100% eliminated at the SQL layer; this residual variance is acknowledged as an operational reality.

### 11.2 Definitive Guest Claim Stored Procedure Specification

```sql
CREATE OR REPLACE FUNCTION public.claim_guest_course_application(
    p_application_id UUID,
    p_plain_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_auth_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_computed_hash TEXT;
    v_app_record public.course_applications%ROWTYPE;
BEGIN
    -- 1. Explicit Authentication Check (Distinguished from claim validation)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to claim an application'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 2. Fetch verified email from auth.users (executing under SECURITY DEFINER privileges)
    SELECT email, email_confirmed_at
    INTO v_auth_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_caller_id;

    IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN
        -- Generic failure: do not disclose unconfirmed account status
        RETURN FALSE;
    END IF;

    -- 3. Lock application row FOR UPDATE
    SELECT * INTO v_app_record
    FROM public.course_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Generic failure: do not disclose whether application ID exists
        RETURN FALSE;
    END IF;

    -- 4. Compute SHA-256 hash of provided plain token
    v_computed_hash := pg_catalog.encode(extensions.digest(p_plain_token, 'sha256'), 'hex');

    -- 5. Validate claim preconditions with uniform generic failure response
    -- Checks: unassigned target, token hash match, unexpired token, verified email ownership match
    IF v_app_record.user_id IS NOT NULL
       OR v_app_record.guest_claim_token_hash IS NULL
       OR v_app_record.guest_claim_token_hash IS DISTINCT FROM v_computed_hash
       OR v_app_record.guest_claim_token_expires_at IS NULL
       OR v_app_record.guest_claim_token_expires_at <= pg_catalog.now()
       OR pg_catalog.lower(pg_catalog.btrim(v_app_record.student_email)) IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(v_auth_email))
    THEN
        -- Fails closed with uniform boolean FALSE to prevent enumeration / timing discrepancies
        RETURN FALSE;
    END IF;

    -- 6. Atomically update application: link user_id, nullify single-use token and expiration
    UPDATE public.course_applications
    SET user_id = v_caller_id,
        guest_claim_token_hash = NULL,
        guest_claim_token_expires_at = NULL,
        updated_at = pg_catalog.now()
    WHERE id = p_application_id;

    -- 7. Insert timeline progress event (Schema-compliant)
    INSERT INTO public.course_application_events (
        application_id,
        event_type,
        actor_type,
        actor_id,
        title,
        description,
        metadata
    ) VALUES (
        p_application_id,
        'CLAIMED_BY_USER',
        'student',
        v_caller_id,
        'Application Claimed',
        'Guest application successfully linked to authenticated student account.',
        pg_catalog.jsonb_build_object(
            'claimed_at', pg_catalog.now(),
            'claimed_by_email', v_auth_email
        )
    );

    -- 8. Insert compliance audit log (Schema-compliant)
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
        v_caller_id,
        'student',
        'CLAIM_GUEST_APPLICATION',
        pg_catalog.jsonb_build_object('user_id', NULL),
        pg_catalog.jsonb_build_object('user_id', v_caller_id),
        'Guest application claimed by verified student: ' || v_auth_email
    );

    RETURN TRUE;
END;
$$;

-- Grant execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.claim_guest_course_application(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_course_application(UUID, TEXT) TO authenticated;
```

---

---

---

## 12. Notification Outbox Worker Recovery & Security Boundary

### 12.1 Operational Requirements & Complete 8-Column State Machine

The asynchronous notification dispatch worker runs inside the server process (`src/server.ts`). Its operational lifecycle on `public.notification_outbox` is governed by a strict, deterministic state machine.

To guarantee zero message loss, zero infinite retry loops, and deterministic crash recovery, the exact behavior of every column across all eight operational transitions is specified below:

#### Complete 8-Column Outbox State Machine Matrix

| # | Operational Lifecycle Transition | Initial State (`status`) | Resulting State (`status`) | `attempts` | `max_attempts` | `locked_until` | `next_attempt_at` | `last_error` | `sent_at` | `updated_at` |
| :-: | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | **Initial Job Enqueueing** (RPC transition) | *(Nonexistent)* | **`pending`** | `0` | `5` | `NULL` | `now()` | `NULL` | `NULL` | `now()` |
| **2** | **Dequeue Claim for Processing** (`rpc_dequeue`) | `pending` | **`processing`** | `attempts + 1` (1) | Unchanged (5) | `now() + interval 'p_lock_seconds'` | Unchanged | Retained | `NULL` | `now()` |
| **3** | **Successful Delivery** (Worker SMTP success) | `processing` | **`sent`** | Unchanged (1) | Unchanged (5) | `NULL` (Released) | Unchanged | Unchanged | `now()` | `now()` |
| **4** | **Transient Failure w/ Retries Left** (Worker err) | `processing` | **`failed`** | Unchanged (1) | Unchanged (5) | `NULL` (Released) | `now() + 1min * 2^attempts` | Captured error string | `NULL` | `now()` |
| **5** | **Retry Dequeue Claim** (`rpc_dequeue`) | `failed` | **`processing`** | `attempts + 1` (2..5) | Unchanged (5) | `now() + interval 'p_lock_seconds'` | Unchanged | Retained previous | `NULL` | `now()` |
| **6** | **Expired Lease w/ Retries Left** (Crash recovery) | `processing` | **`processing`** | `attempts + 1` | Unchanged (5) | `now() + interval 'p_lock_seconds'` (Fresh) | Unchanged | Retained / Lease noted | `NULL` | `now()` |
| **7** | **Expired Lease w/ Exhausted Retries** (Reclaim) | `processing` | **`dead_letter`** | Unchanged (≥5) | Unchanged (5) | `NULL` (Released) | Unchanged | `'Job lease expired after max attempts'` | `NULL` | `now()` |
| **8** | **Permanent Failure / Hard Bounce** (Worker err) | `processing` | **`dead_letter`** | Unchanged | Unchanged (5) | `NULL` (Released) | Unchanged | Terminal error string | `NULL` | `now()` |

#### Detailed Transition Specifications
1. **Transition 1 (Initial Enqueueing):** Inserted atomically during lifecycle state transitions inside `rpc_admin_transition_application_status`. Initialized with `status = 'pending'`, `attempts = 0`, `locked_until = NULL`, and `next_attempt_at = now()`.
2. **Transition 2 (Dequeue Batch Claim):** `rpc_dequeue_notification_batch` claims available jobs via `FOR UPDATE SKIP LOCKED`. Atomically sets `status = 'processing'`, increments `attempts = attempts + 1`, and grants an advisory lease `locked_until = now() + (lock_seconds || ' seconds')::interval`.
3. **Transition 3 (Successful Dispatch):** Worker dispatches message via provider (SMTP/SES/Resend). On success, worker executes immediate completion update: sets `status = 'sent'`, stamps `sent_at = now()`, clears `locked_until = NULL`, and sets `updated_at = now()`.
4. **Transition 4 (Transient Failure with Retries Remaining):** Provider encounters temporary rate-limiting, network timeout, or 5xx error. If `attempts < max_attempts`, worker sets `status = 'failed'`, records `last_error = :err`, applies exponential backoff on `next_attempt_at = now() + (interval '1 minute' * power(2, attempts))`, clears `locked_until = NULL`, and updates `updated_at = now()`.
5. **Transition 5 (Retry Claim):** Once the backoff window elapses (`next_attempt_at <= now()`), `rpc_dequeue_notification_batch` re-claims the job into `status = 'processing'`, incrementing `attempts = attempts + 1` and extending a fresh lease `locked_until`.
6. **Transition 6 (Expired Lease Recovery with Retries Remaining):** If a worker crashes or hangs during processing, its lease expires (`locked_until < now()`). If `attempts < max_attempts`, `rpc_dequeue_notification_batch` (Eligible Case C) automatically recovers the stalled job, granting a fresh lease and incrementing `attempts` to account for the failed execution attempt.
7. **Transition 7 (Expired Lease Reclamation to Dead-Letter):** If a crashed or stalled job has exhausted its attempts (`attempts >= max_attempts`) and its lease expires (`locked_until < now()`), Step 1 of `rpc_dequeue_notification_batch` automatically reclaims the record into `status = 'dead_letter'`, recording `'Job processing lease expired after exhausting maximum retry attempts.'`, releasing `locked_until = NULL`, and permanently preventing un-monitored zombie jobs.
8. **Transition 8 (Permanent Terminal Failure):** If an unrecoverable failure occurs (e.g. invalid recipient syntax, hard bounce, mailbox does not exist), or if `attempts >= max_attempts` after dispatch, the worker transitions the row directly to `status = 'dead_letter'`, stamps `last_error`, releases `locked_until = NULL`, and triggers an administrative alerting webhook.

### 12.2 Atomic Dequeue, Lease-Recovery & Dead-Letter Stored Procedure

```sql
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
    -- Validate and bound inputs to prevent denial-of-service or lock exhaustion
    v_validated_batch_size := GREATEST(1, LEAST(COALESCE(p_batch_size, 10), 100));
    v_validated_lock_seconds := GREATEST(30, LEAST(COALESCE(p_lock_seconds, 300), 3600));

    -- Step 1: Reclaim expired processing jobs that have exhausted maximum attempts -> dead_letter
    -- Prevents stalled/abandoned jobs from lingering in 'processing' forever
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
            -- Eligible Case A: Pending jobs ready for initial dispatch
            (status = 'pending' AND next_attempt_at <= pg_catalog.now())
            -- Eligible Case B: Failed jobs with retry attempts remaining and backoff elapsed
            OR (status = 'failed' AND attempts < max_attempts AND next_attempt_at <= pg_catalog.now())
            -- Eligible Case C: Stalled / abandoned jobs in processing whose lease expired (crash recovery)
            OR (status = 'processing' AND locked_until < pg_catalog.now() AND attempts < max_attempts)
        )
        ORDER BY next_attempt_at ASC, created_at ASC
        LIMIT v_validated_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.notification_outbox n
    SET status = 'processing',
        locked_until = pg_catalog.now() + (v_validated_lock_seconds || ' seconds')::interval,
        attempts = n.attempts + 1,
        updated_at = pg_catalog.now()
    FROM locked_rows lr
    WHERE n.id = lr.id
    RETURNING n.*;
END;
$$;

-- Revoke execute from all public/client roles; permit service_role only
REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) TO service_role;
```

### 12.3 Worker Post-Processing Lifecycle Queries
Once the worker dispatches the email payload via SMTP/SES, it executes one of the following state updates:

1. **Successful Delivery:**
   ```sql
   UPDATE public.notification_outbox
   SET status = 'sent',
       sent_at = pg_catalog.now(),
       locked_until = NULL,
       updated_at = pg_catalog.now()
   WHERE id = :p_job_id;
   ```
2. **Transient Delivery Failure (attempts < max_attempts):**
   ```sql
   UPDATE public.notification_outbox
   SET status = 'failed',
       last_error = :p_error_message,
       next_attempt_at = pg_catalog.now() + (interval '1 minute' * power(2, attempts)),
       locked_until = NULL,
       updated_at = pg_catalog.now()
   WHERE id = :p_job_id;
   ```
3. **Permanent Delivery Failure (attempts >= max_attempts OR unrecoverable):**
   ```sql
   UPDATE public.notification_outbox
   SET status = 'dead_letter',
       last_error = :p_error_message,
       locked_until = NULL,
       updated_at = pg_catalog.now()
   WHERE id = :p_job_id;
   ```

### 12.4 Queue Index Gap & Future Schema Optimization
- **Current Draft Indexes (`supabase_course_applications_schema_v1.sql`):**
  - `idx_notification_outbox_queue ON public.notification_outbox (next_attempt_at, locked_until) WHERE status IN ('pending', 'failed');`
  - `idx_notification_outbox_locked ON public.notification_outbox (locked_until) WHERE status = 'processing';`
- **Performance Gap Analysis:**
  The polling query performs `ORDER BY next_attempt_at ASC, created_at ASC` and combines `pending`, `failed`, and `processing` statuses. Because the two existing partial indexes do not index `created_at` or unify all three active states, PostgreSQL may require a BitmapOr and in-memory sort under high queue volume.
- **Proposed Future Schema Change (Requires Separate Authorization in Phase 3.5):**
  ```sql
  -- Future Schema Change (Do NOT execute in Phase 3.4):
  CREATE INDEX idx_notification_outbox_worker_dequeue
  ON public.notification_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed', 'processing');
  ```
  This is classified strictly as a **Future Schema Change Requiring Separate Authorization**.

### 12.5 Security Boundary & Least-Privilege Honest Assessment
- **Current Trusted Server Boundary:** The background worker currently executes using `service_role`. In Supabase, `service_role` is a broad management key that bypasses RLS across all tables. Calling this "least privilege" is inaccurate: it is a **trusted-server administrative execution model**.
- **True Least Privilege Role Proposal (Future Migration):** In Phase 3.5 or future hardening, a dedicated PostgreSQL background role (`worker_notification_role`) can be provisioned via DDL:
  - `GRANT SELECT, UPDATE ON public.notification_outbox TO worker_notification_role;`
  - Zero access to `course_applications`, `documents`, `audit_logs`, or `auth.users`.
  Until such a custom role is provisioned, the execution boundary is protected by trusted server-side execution isolation.

---

## 13. Proposed PostgreSQL Grants, Revocations & RLS Policies Specification

```sql
-- ====================================================================
-- PROPOSED POSTGRESQL GRANTS, REVOCATIONS & RLS POLICIES (V1.7.0)
-- ====================================================================

-- 1. BASELINE LOCKDOWN: Enable RLS and Revoke all public/default permissions
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

-- 2. COURSE APPLICATIONS: Column-Level SELECT for Authenticated Users (Excludes claim tokens)
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
    assigned_admin_id,
    enrollment_id,
    rejection_reason,
    resubmission_notes,
    submitted_at,
    approved_at,
    rejected_at,
    created_at,
    updated_at
) ON TABLE public.course_applications TO authenticated;

-- RLS Policy: Students read own applications
CREATE POLICY course_applications_student_select_policy
ON public.course_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Administrators read all applications (Pathway B)
CREATE POLICY course_applications_admin_select_policy
ON public.course_applications
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));

-- 3. CANDIDATE VIEW: Grant SELECT on security-invoker view
GRANT SELECT ON public.candidate_course_applications TO authenticated;

-- 4. DOCUMENTS: Read-Only for Authenticated Users
GRANT SELECT ON TABLE public.course_application_documents TO authenticated;

-- RLS Policy: Students read documents of owned applications
CREATE POLICY course_application_documents_student_select_policy
ON public.course_application_documents
FOR SELECT
TO authenticated
USING (application_id IN (
    SELECT id FROM public.course_applications WHERE user_id = auth.uid()
));

-- RLS Policy: Administrators read all documents
CREATE POLICY course_application_documents_admin_select_policy
ON public.course_application_documents
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));

-- 5. EVENTS: Read-Only for Authenticated Users
GRANT SELECT ON TABLE public.course_application_events TO authenticated;

-- RLS Policy: Students read events of owned applications
CREATE POLICY course_application_events_student_select_policy
ON public.course_application_events
FOR SELECT
TO authenticated
USING (application_id IN (
    SELECT id FROM public.course_applications WHERE user_id = auth.uid()
));

-- RLS Policy: Administrators read all events
CREATE POLICY course_application_events_admin_select_policy
ON public.course_application_events
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'));

-- 6. AUDIT LOGS: Read-Only for Super Admin via RLS
GRANT SELECT ON TABLE public.course_application_audit_logs TO authenticated;

CREATE POLICY course_application_audit_logs_super_admin_select_policy
ON public.course_application_audit_logs
FOR SELECT
TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- 7. NOTIFICATION OUTBOX: Zero Client Access
-- All permissions remain REVOKED from anon, authenticated, and PUBLIC.

-- 8. SERVICE ROLE: Full Operational Privileges for Trusted Server Functions
GRANT ALL ON TABLE public.course_applications TO service_role;
GRANT ALL ON TABLE public.course_application_documents TO service_role;
GRANT ALL ON TABLE public.course_application_events TO service_role;
GRANT ALL ON TABLE public.course_application_audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_outbox TO service_role; -- DELETE strictly omitted

-- 9. STORED PROCEDURE EXECUTION GRANTS: Service-Role Only (Browser Client Roles Revoked)
REVOKE EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) TO service_role;
```

---

## 14. Storage & Private Document Access Security

- **Bucket Name:** `course-application-documents`
- **Bucket Visibility:** **Private** (`public = false`). Direct public CDN URLs disabled.
- **Upload Path Structure:**  
  `applications/{application_id}/{document_type}/{crypto_uuid}_{sanitized_basename}.{ext}`
- **Upload Mechanism:** Mediated exclusively via 15-minute signed upload URLs generated by `requestDocumentUploadTicketServerFn`.
- **Download Mechanism:** Mediated exclusively via 60-second signed download URLs generated by `requestDocumentDownloadUrlServerFn` after validating caller ownership or administrative role.

---

## 15. Threat Model & Abuse Scenarios (14 Scenarios)

| # | Threat Scenario | Attack Vector & Threat Action | Security Control & Defense Mechanism | Residual Risk & Operational Caveat |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Anonymous Application Enumeration** | Attacker queries `course_applications` via PostgREST to harvest applicant names, emails, and phone numbers. | `SELECT` on `course_applications` is completely REVOKED from `anon`. RLS denies all queries. | Low. Public route exposure is zero. |
| **2** | **Claim Token Hash Exfiltration** | Authenticated student queries `course_applications` requesting `guest_claim_token_hash`. | Column-level SELECT privileges omit claim token columns. View `candidate_course_applications` does not include them. | Zero. Database engine raises permission error. |
| **3** | **Student Status Tampering** | Student attempts PostgREST `PATCH` to advance status from `'submitted'` to `'approved'`. | Direct `UPDATE` is completely REVOKED from all client roles on `course_applications`. | Zero. Status updates are mediated server-side. |
| **4** | **Payment Verification Forgery** | Student attempts to update `payment_status` to `'verified'` or supply fake transaction references. | Direct `UPDATE` is REVOKED. Check constraint `chk_course_applications_enrolled_payment` enforces payment state. | Zero at database level. Admin diligence required for UTR matching. |
| **5** | **Bypass Approval to Activate Enrollment** | Student attempts to invoke `enrollments_users` insert directly. | Direct insert on `enrollments_users` is locked down. Enrollment creation is gated by atomic approval RPC requiring admin authorization. | Zero. |
| **6** | **Guest Token Replay & Hijacking** | Attacker intercepts expired claim token or attempts to claim an already linked application. | Claiming RPC requires `user_id IS NULL`, unexpired token, matching hash, and matching verified account email. Tokens nullified on first use. Returns uniform `FALSE` on failure. | Attacker possessing both the token and control of the verified email account could claim it. Mitigated by 7-day TTL and email security. |
| **7** | **Unauthorized Document Access** | Student probes storage URL to download another student's academic transcript or ID proof. | Storage bucket `course-application-documents` is private. Downloads require signed URLs generated server-side after ownership verification. | Signed URLs expire in 60 seconds. Client sharing active URL is residual client risk. |
| **8** | **Document Metadata / Path Spoofing** | Attacker attempts to insert document metadata pointing to another user's file. | Direct `INSERT` on `course_application_documents` is completely REVOKED from clients. Metadata written strictly server-side post-verification. | Zero. |
| **9** | **Privilege Escalation to Admin** | Authenticated user modifies `localStorage` or injects `user_metadata.role = 'admin'` to execute admin actions. | Server functions authoritatively verify `app_metadata.role` via `supabaseAdmin.auth.getUser()`, ignoring `user_metadata` and client tokens. Database RLS checks `auth.jwt() -> 'app_metadata'`. | Low. Requires compromise of Supabase service-role secret to forge `app_metadata`. |
| **10** | **Lifecycle Event Fabrication** | Student or admin inserts a fabricated `APPROVED` event into `course_application_events`. | Direct `INSERT` on `course_application_events` is REVOKED from all client roles. Events created strictly by server functions with schema-validated types. | Zero. |
| **11** | **Audit Trail Tampering or Inspection** | Attacker attempts to delete or alter compliance audit logs, or read confidential IP trails. | Statement and row triggers block `UPDATE`, `DELETE`, and `TRUNCATE`. `SELECT` is denied to students and anon; restricted to `super_admin`. | PostgreSQL superusers can bypass triggers; mitigated by isolating database credentials. |
| **12** | **Notification Queue Poisoning or Deletion** | Client queries, inserts, or deletes email jobs in `notification_outbox`. | All permissions on `notification_outbox` are REVOKED from client roles. Worker role has `DELETE` revoked. | Zero client access. |
| **13** | **Compromised Backend Credential** | Attacker obtains `SUPABASE_SERVICE_ROLE_KEY`. | Service role possesses broad access. Mitigated by environment variable isolation, secret rotation protocols, and monitoring. | Critical infrastructure risk if secret leaked; standard Supabase architecture constraint. |
| **14** | **`SECURITY DEFINER` Misconfiguration** | Function owner possesses excessive privileges or search-path vulnerability allows privilege escalation. | Functions set explicit `SET search_path = ''`, revoke execute from `PUBLIC`, fully qualify all identifiers, and use standard `postgres` ownership. | Low. Hardened against search-path and privilege injection attacks. |

---

## 16. Security Risks, Assumptions & Classified Production Realities

To maintain complete intellectual honesty and prevent migration failures, all architectural assertions are classified into distinct categories:

### 16.1 Verified Facts (Empirically Proven via Repository Audit)
1. Direct client Supabase requests run under `anon` or `authenticated` roles via `src/utils/supabase.ts`.
2. Authoritative administrative verification is performed by `src/lib/server/admin-guard.ts` using `app_metadata.role` and `ADMIN_EMAILS`.
3. The repository precedent for administrative functions (`supabase_auth_admin_rpc_lockdown_v1.sql`) mandates `SET search_path = ''`.
4. Spin wheel and IELTS implementations confirm that client-facing tables require strict backend mediation to prevent bypass.

### 16.2 Proposed Design (Specified in this Document for Future Implementation)
1. Five-table least-privilege matrix with column-level `GRANT SELECT` on non-sensitive columns.
2. Candidate view `candidate_course_applications` with `security_invoker = true`.
3. Atomic administrative lifecycle stored procedure `rpc_admin_transition_application_status` enforcing schema-valid events, audit logs, and outbox templates.
4. Atomic notification worker stored procedure `rpc_dequeue_notification_batch` with `FOR UPDATE SKIP LOCKED` and expired lease recovery.
5. Stable transition-specific notification idempotency key strategy.
6. Server-mediated admin dashboard queue-access architecture (Pathway A).

### 16.3 Production Assumptions & Implementation Prerequisites (Requires Verification in Phase 3.5)
1. **`pgcrypto` Extension Schema:** The guest claim RPC uses `extensions.digest(token, 'sha256')`. In Supabase, `pgcrypto` is located in schema `extensions`. The implementation phase must verify whether `extensions.digest` or `public.digest` is active.
2. **Default Schema Privileges:** The production database's existing `ALTER DEFAULT PRIVILEGES IN SCHEMA public` has not been directly inspected. Explicit `REVOKE ALL` statements in the migration script are mandatory.
3. **Database Roles:** Roles `app_owner` and `auth_admin` do **not** exist in vanilla Supabase. Functions default to `postgres` ownership. If custom roles are desired, they must be provisioned via explicit DDL beforehand.

---

---

---

---

## 17. Comprehensive Cross-Document Consistency Matrix

The following table formally audits and classifies the consistency of every core system element across:
1. `supabase_course_applications_schema_v1.sql` (Phase 3.3.11)
2. `docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md` (Phase 3.3.11)
3. `docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md` (Phase 3.3.11)
4. `docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md` (Version 1.7.0, Phase 3.4.8)

| Domain / Architectural Element | Phase 3.3.11 Schema Specification | Phase 3.3.11 Architecture & Migrations | Phase 3.4.8 Security Design Document | Status Classification | Technical Verification & Implementation Note |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Five Application Tables** | `course_applications`, `documents`, `events`, `audit_logs`, `outbox` | Same 5 tables defined | Same 5 tables defined | **Consistent** | Byte-for-byte identical table names and relation schemas. |
| **Course ID Model (DEC-01)** | `UUID` on `course_applications`, validated via trigger against `courses.id::text` | Explicitly documents `courses.id` as `TEXT` and application `course_id` as `UUID` | Aligned with trigger validation | **Consistent** | Governed by approved decision DEC-01. Explicit casting (`course_id::text`) used in all RPC comparisons. |
| **DEC-03 Academic vs. Finance Sequencing** | Academic evaluation precedes payment | Explicitly mandates academic evaluation first; payment verification required before enrollment | Reconciled in Phase 3.4.8: `approved` requires document verification only; `enrolled` requires confirmed payment (`verified`, `waived`, `not_required`) | **Consistent** | Enforces strict business separation between academic approval and enrollment activation. |
| **Application Status Enum** | 11 states: `draft`, `submitted`, `under_review`, `resubmission_required`, `resubmitted`, `approved`, `enrolled`, `rejected`, `cancelled`, `revoked`, `suspended` | 11 states documented | Fully implemented 6-target RPC; documented student/server endpoints | **Consistent** | RPC implements `under_review`, `approved`, `rejected`, `resubmission_required`, `enrolled`, `revoked`. Student/server endpoints handle `draft`, `submitted`, `resubmitted`, `cancelled`. |
| **Event Table Schema & Types** | Requires `actor_type`, `title`. CHECK restricts `event_type` to 12 exact types. | Timeline progress model | Fully reconciled in `rpc_admin_transition_application_status` | **Consistent** | All inserts supply `application_id`, `event_type`, `actor_type`, `actor_id`, `title`, `description`, `metadata`. |
| **Audit Log Table Schema** | Requires `actor_role`. Notes column is `notes` (no `reason` column). | Documents immutable compliance trail | Fully reconciled in Section 4, 6, 11 | **Consistent** | Replaced nonexistent `reason` column with actual `notes` column; supplies valid `actor_role` (`admin`, `student`). |
| **Genuine Previous-State Audit Preservation** | Audit log stores `previous_state` JSONB | Documents snapshot consistency | Captures pre-mutation `v_prev_app` immediately upon row lock; immune to `RETURNING * INTO v_app` overwrite and `ON DELETE SET NULL` cascades | **Corrected in this phase** | Guarantees genuine pre-transition application state and original enrollment ID are preserved in audit history. |
| **Notification Outbox Templates** | CHECK permits 7 exact templates: `application_received`, `review_started`, `resubmission_required`, `application_approved`, `application_rejected`, `enrollment_confirmed`, `enrollment_revoked` | Same 7 templates documented | Fully reconciled in Section 6.6 | **Consistent** | Eliminates invalid `application_enrolled`; maps transitions to exact permitted enum strings. |
| **Notification Idempotency Strategy** | `idempotency_key TEXT UNIQUE NOT NULL` | Documents idempotency requirement | Occurrence-aware keys transactionally derived from event counts under row locks | **Corrected in this phase** | Eliminates notification suppression for repeatable review/resubmission cycles; documents locking boundary across writers and specifies future database sequence constraint. |
| **Enrollment Deduplication & Idempotency** | References `enrollments_users(id)` | Dual-key advisory lock with snapshot deduplication | Rebuilt 6-scenario non-overlapping analysis; handles corrupt links, duplicate aborts, self-healing | **Corrected in this phase** | Deterministic UUID selection via scalar `v_candidate_id ... LIMIT 1` (eliminates `min(id)` and `RECORD` aggregation); inserts `enrollment_date`. |
| **Enrollment Schema Reconciliation** | `enrollment_id UUID REFERENCES enrollments_users(id)` | Inserts `enrollment_date` | Reconciled `BACKEND_SUPABASE_SETUP.md` vs preflight evidence; uses `enrollment_date` and casts `course_id::text`; retains live schema verification as prerequisite | **Corrected in this phase** | Eliminates confusion over non-existent `enrolled_at` column on `enrollments_users` in production. |
| **Enrollment Foreign-Key & Deletion Integrity** | `enrollment_id UUID REFERENCES enrollments_users(id) ON DELETE SET NULL` | Documents administrative revocation | Analyzed `ON DELETE SET NULL`; documented physical deletion as an interim operational compromise; established Phase 3.5 migration for soft deactivation | **Consistent** | Resolves student dashboard access persistence gap while honestly documenting the foreign-key and historical auditing consequences of physical deletion. |
| **Hardened Revocation Identity Validation** | Noted in schema comments | High-level revocation noted | Locks row `FOR UPDATE`, validates email normalization and course ID match, verifies unshared dependency, aborts on mismatch | **Consistent** | Guarantees that an enrollment belonging to another student or course is NEVER deleted; prevents concurrent modification races. |
| **PL/pgSQL Runtime Crash Prevention** | Unspecified | Unspecified | Declares scalar `UUID` and `JSONB` variables initialized to `NULL`; eliminated unsafe field access on unassigned `RECORD` | **Consistent** | Eliminates fatal runtime PL/pgSQL crashes on non-revocation execution branches. |
| **Actor Authorization & Integrity** | Stored procedure execution | Server-mediated review guard (`admin-guard.ts`) | Replaced nonexistent `admin_users` and `profiles` assumptions; reconciled server guard (`app_metadata.role` or `ADMIN_EMAILS`) with database `auth.users` existence check | **Consistent** | Preserves least privilege via `service_role` execution while preventing false rejections of legitimate administrators; distinguishes operational attribution from cryptographic non-repudiation. |
| **Row Level Security (RLS)** | Default-deny on all tables | Outlines student/admin access | Complete 5-table RLS specification, column grants, helper views, client lockdown | **Consistent** | Authoritative security specification ready for Phase 3.5 migration implementation. |
| **Storage Security** | Bucket `course-application-documents` | Private bucket with pathing convention | Strict storage policies: path tenancy, admin download, mime validation | **Consistent** | Client access locked to private paths; pre-signed URLs required for admin downloads. |

---

## 18. Manual Verification Checklist (For Future Implementation Phase 3.5)

Prior to executing any migration in Phase 3.5:
- [ ] Conduct live read-only inspection of `public.enrollments_users` column definitions (verifying `enrollment_date` vs `enrolled_at`, and `course_id` type).
- [ ] Inspect production `ALTER DEFAULT PRIVILEGES IN SCHEMA public` to identify inherited grants.
- [ ] Verify `pgcrypto` extension installation and schema location (`extensions` vs `public`).
- [ ] Confirm all existing administrator accounts possess `app_metadata.role = 'admin'` or use Pathway A server-mediated dashboard.
- [ ] Verify private storage bucket creation with public access disabled.
- [ ] Test that `anon` receives HTTP 401/403 when querying `course_applications`.
- [ ] Test that authenticated students attempting `SELECT * FROM course_applications` receive a column permission error for `guest_claim_token_hash`.
- [ ] Test that authenticated students querying `candidate_course_applications` see only their own records and no claim tokens.
- [ ] Test that direct client `UPDATE` on `course_applications` is rejected for both students and administrators.
- [ ] Test that direct client `INSERT` on `course_application_documents` and `course_application_events` is rejected.
- [ ] Verify that audit log immutability triggers reject `UPDATE`, `DELETE`, and `TRUNCATE`.
- [ ] Verify that `rpc_dequeue_notification_batch` correctly locks and returns jobs via `SKIP LOCKED` and that `DELETE` on `notification_outbox` is rejected.
- [ ] Verify that `rpc_admin_transition_application_status` permits academic `approved` status when `documents_status = 'verified'` regardless of `payment_status` (DEC-03).
- [ ] Verify that `rpc_admin_transition_application_status` rejects `enrolled` status when `payment_status` is unpaid, null, or unverified with `check_violation` (DEC-03).
- [ ] Verify that `course_application_audit_logs.previous_state` records the genuine pre-mutation application row and original `enrollment_id` even after update or revocation cascades.
- [ ] Verify that UUID reconciliation selects deterministic IDs via `LIMIT 1` into scalar UUID variables without runtime errors.
- [ ] Verify that revoking an enrolled application safely validates enrollment ownership, terminates access, captures full snapshots, and aborts if shared or mismatched.
- [ ] Verify that PL/pgSQL execution does not crash on unassigned RECORD access during non-revocation transitions.
- [ ] Verify that repeated review and resubmission cycles generate distinct, sequential notification idempotency keys (`_1`, `_2`).

---

## 19. Deployment Prerequisites & Implementation Dependencies

1. **Mandatory Live Schema Audit:** Perform a live, read-only inspection of `public.enrollments_users` in production to verify exact column names (`enrollment_date` vs `enrolled_at`) and types (`course_id UUID` vs `TEXT`) before executing Phase 3.5 migrations.
2. **Phase 3.5 Schema & Policy Migration:** Formal SQL migration script containing `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `REVOKE` statements, column-level `GRANT` statements, `CREATE VIEW candidate_course_applications`, `CREATE FUNCTION rpc_admin_transition_application_status`, `CREATE FUNCTION rpc_dequeue_notification_batch`, and explicit `CREATE POLICY` statements.
3. **Future Schema Changes (Target State Enhancements):**
   - Migration `V1.1_enrollments_users_lifecycle.sql` adding `status`, `revoked_at`, `revoked_reason`, and `revoked_by` to `public.enrollments_users`.
   - Addition of `occurrence_seq INT NOT NULL DEFAULT 1` and unique index `uq_app_events_occurrence ON public.course_application_events (application_id, event_type, occurrence_seq)` for database-enforced event ordering.
   - Creation of partial composite queue index `idx_notification_outbox_worker_dequeue ON public.notification_outbox (next_attempt_at, created_at) WHERE status IN ('pending', 'failed', 'processing')`.
   - Creation of unique index `uq_enrollments_users_email_course ON public.enrollments_users (lower(btrim(student_email)), course_id)` following deduplication data cleanup.
4. **Storage Provisioning Script:** Automated script or bucket migration creating `course-application-documents` with strict private policies.
5. **Server Functions Integration:** Implementation of TanStack Start server functions (`submitCourseApplication`, `claimGuestApplication`, `uploadDocumentTicket`, `confirmDocumentUpload`, administrative review endpoints) in `src/lib/server/`, ensuring all event-writing server functions acquire `course_applications FOR UPDATE`.
6. **Student Dashboard Query Updates:** Updating `src/routes/dashboard/courses.tsx` and `src/routes/dashboard/index.tsx` to filter by `status = 'active'` once future migration is deployed.
7. **Independent Review Approval:** Explicit sign-off on this Phase 3.4.8 design specification from project leadership.

---

## 20. Project Progress Tracking & Verification Baseline

### 20.1 Project-Wide Progress Document Inspection
An inspection of the repository root and `docs/` directory confirmed that **no central project-wide progress tracking document** (such as `PROGRESS.md`, `ROADMAP.md`, or a centralized phase completion ledger) exists.
- Therefore, in strict compliance with project directives, **no arbitrary percentage completion or invented phase denominator is claimed**.
- A centralized progress baseline document remains a future administrative prerequisite.

### 20.2 Separation of Implementation vs. Deployment Progress
- **Specification & Design Progress:** Phase 3.4 (RLS & Access-Control Security Design) is **100% complete** across its specification passes (3.4.0 through 3.4.8), producing an authoritative, schema-accurate design specification.
- **Production Deployment Progress:** **0% deployed.** All work in Phase 3.4 has been strictly documentation-only. Zero SQL statements have been executed, zero database connections have been made, zero tables or storage buckets have been created in production, and zero frontend/backend application code has been altered.
