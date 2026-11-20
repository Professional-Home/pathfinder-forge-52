# PathFinder Course Application Management System — Database Migration Runbook (V1.7.0)

**Phase:** Phase 3 Implementation (Consolidated Release)  
**Target Repository:** `F:/Project/pathfinder-forge-52`  
**Target Branch:** `feature/course-application-management`  
**Consolidated Migration File:** [`supabase_course_applications_v1_migration.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_v1_migration.sql)  
**Storage Migration File:** [`supabase_course_applications_storage_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_storage_v1.sql)  
**Execution Status:** **READY FOR MANUAL EXECUTION [MANUAL — YOU MUST DO THIS]**  
**Security Specification:** [`docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md`](file:///F:/Project/pathfinder-forge-52/docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md) (Version 1.7.0)  
**Upstream Branching Base Commit:** `0a9d79a95f28942e115bacf10d5166c6441e9267` (`origin/main`, PR #23 merge baseline)  
**Consolidation Feature Commit:** `43a0e0de277a9eac749bd9c53921ee0db52ea9a3` (`origin/feature/course-application-management`)  

---

## 1. Migration Location & Convention Rationale

### Repository Migration Convention
Inspection of the repository structure confirmed that PathFinder does not use the standard `supabase/migrations/` timestamped layout. Instead, the project organizes database schemas into modular, domain-specific SQL files located at the root of the repository:
- `supabase_schema.sql` (courses, blogs, reviews)
- `supabase_events_schema.sql` (events and registrations)
- `supabase_ielts_schema.sql` (IELTS coaching system)
- `supabase_opportunities_schema.sql` (opportunity CMS)
- `supabase_webinars_schema.sql` (webinar scheduling)
- `supabase_auth_profile_schema.sql` (user profiles and roles)
- `supabase_spin_wheel_schema.sql` (Spin & Win rewards)

### File Placement Decision
To maintain strict architectural consistency with the existing repository conventions while establishing version tracking, the corrected migration draft is placed at:
[`F:/Project/pathfinder-forge-52/supabase_course_applications_schema_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_schema_v1.sql)

---

## 2. Core Relational Schema Specification

The migration draft establishes 5 core tables, 1 sequence, 5 functions, 5 triggers, and 14 explicit secondary indexes designed for maximum performance, non-destructive isolation, and compliance.

### 2.1 Entity Summary

| Table / Object Name | Domain & Ownership | Primary Key | Key Relationships | Key Constraints & Protections |
| :--- | :--- | :--- | :--- | :--- |
| **`public.course_applications`** | Student application dossier | `id UUID` | `user_id` $\to$ `auth.users(id)`<br/>`course_id` $\to$ `public.courses` (via trigger)<br/>`enrollment_id` $\to$ `public.enrollments_users(id)` | `application_number` UNIQUE<br/>`guest_claim_token_hash` & `expires_at` (DEC-02)<br/>`status` CHECK (11 states)<br/>`payment_status` CHECK (7 states)<br/>`chk_course_applications_enrolled_payment` (DEC-03)<br/>`payment_reference` conditional UNIQUE |
| **`public.course_application_documents`** | Uploaded document metadata | `id UUID` | `application_id` $\to$ `course_applications(id)` (CASCADE) | `document_type` CHECK<br/>`file_size_bytes` $\le$ 10485760 (DEC-04)<br/>`mime_type` CHECK (PDF/JPEG/PNG)<br/>`storage_path` UNIQUE |
| **`public.course_application_events`** | User-facing lifecycle history | `id BIGSERIAL` | `application_id` $\to$ `course_applications(id)` (CASCADE)<br/>`actor_id` $\to$ `auth.users(id)` | `event_type` CHECK (12 events)<br/>`actor_type` CHECK ('student', 'admin', 'system') |
| **`public.course_application_audit_logs`** | Security & compliance audit trail | `id BIGSERIAL` | `application_id` $\to$ `course_applications(id)` (ON DELETE SET NULL)<br/>`actor_id` $\to$ `auth.users(id)` (ON DELETE SET NULL) | `actor_role` CHECK<br/>Immutable (triggers block UPDATE, DELETE, TRUNCATE; REVOKE applied) (DEC-05) |
| **`public.notification_outbox`** | Transactional email queue | `id BIGSERIAL` | `application_id` $\to$ `course_applications(id)` (ON DELETE SET NULL) | `idempotency_key` UNIQUE<br/>`status` CHECK<br/>`template_name` CHECK<br/>Lease recovery index on `(next_attempt_at, locked_until)` |

### 2.2 Schema Object Count, Verified Line Count & Additions Explanation

#### Verified Line Count and Counting Methodology
The current migration draft file [`supabase_course_applications_schema_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_schema_v1.sql) contains **499 lines** under standard non-empty/newline counting conventions (measured via `[System.IO.File]::ReadAllLines` and standard POSIX line counting `wc -l` when accounting for the terminating newline; splitting raw text by `\n` without trimming yields 500 due to the trailing EOF newline).

**Evolution of Line Counts:**
- **Initial Draft (Phase 3.3):** 354 lines (base relational structure).
- **Hardened Draft (Phase 3.3.4 - 3.3.7):** 392 lines (incorporating `course_application_events`, worker lease index, active document index, and conditional payment uniqueness).
- **Security Prerequisite Draft (Phase 3.3.8):** 456 lines (incorporating Section 9 RLS deployment blocker and access tier specifications).
- **Corrected Privilege Scope Draft (Phase 3.3.9):** 481 lines (qualifying default privileges, SECURITY DEFINER FORCE RLS caveats, and query planner realities).
- **Final Security Caveat Draft (Phase 3.3.10):** 492 lines (explicitly detailing precise PostgreSQL RLS bypass criteria: BYPASSRLS / superuser / non-FORCE RLS table owner).
- **Final RLS Semantics Clarification (Phase 3.3.11):** 499 lines (clarified exact FORCE ROW LEVEL SECURITY behavior and non-override of BYPASSRLS / superuser bypass).

#### Architectural Justification for Schema Additions
1. **`public.course_application_events` (Table & Index):**
   - Added to support a user-facing and operational timeline of candidate milestone transitions (`DRAFT_CREATED`, `SUBMITTED`, `UNDER_REVIEW`, `RESUBMISSION_REQUESTED`, `RESUBMITTED`, `APPROVED`, `PAYMENT_VERIFIED`, `ENROLLED`, `REJECTED`, `CANCELLED`, `CLAIMED_BY_USER`, `REVOKED`).
   - Accompanied by index `idx_app_events_app_id` on `(application_id, created_at DESC)`.
2. **Additional Dossier Performance Indexes:**
   - `idx_course_applications_created_at`: Supports index-ordered chronological review queues (`created_at DESC`).
   - `idx_unique_payment_ref`: Conditional unique index on `(lower(trim(payment_reference))) WHERE payment_reference IS NOT NULL AND payment_status NOT IN ('unpaid', 'refunded')` preventing duplicate transaction ID submissions.
3. **Active Document Lookup Index:**
   - `idx_app_documents_type`: Composite partial index on `(application_id, document_type) WHERE is_archived = false` enabling fast retrieval of active candidate documents when superseded drafts exist.
4. **Worker Lease Recovery Index:**
   - `idx_notification_outbox_locked`: Partial index on `(locked_until) WHERE status = 'processing'` enabling background workers to discover and reclaim stalled leases.

> [!NOTE]
> **Query Planner & Performance Reality:**
> These 14 indexes are designed to support targeted index access paths for specific workload queries. However, in PostgreSQL, the cost-based query planner determines whether an index scan, bitmap index scan, or sequential scan is most efficient based on table cardinality, statistics, and selectivity. Indexes do not categorically eliminate sequential scans across all execution scenarios (e.g. small table volumes or low-selectivity queries).

---

## 3. Application-Number Generation Specification

The synchronized application-number format across schema and documentation is:
```text
APP-YYYY-00001
```
- **Generator Function:** `public.generate_course_application_number()`
- **Sequence Object:** `public.course_application_number_seq START 1`
- **Formatting Rule:** Concatenates `'APP-'`, four-digit UTC year string `TO_CHAR(timezone('utc'::text, now()), 'YYYY')`, hyphen `'-'`, and sequence number zero-padded to 5 digits via `LPAD(NEXTVAL(...)::TEXT, 5, '0')`.
- **Timezone Note:** `timezone('utc'::text, now())` is used here strictly to extract the UTC year string for display formatting; all database timestamp columns natively use `now()` (`TIMESTAMPTZ`).

---

## 4. Course ID Compatibility & Deletion Protection (DEC-01)

### The Relational Bridge
- `public.courses.id` is `TEXT`, while `public.course_applications.course_id` is `UUID`.
- Direct foreign keys between incompatible types are prohibited by PostgreSQL.
- Altering `public.courses.id` to `UUID` would introduce catastrophic regressions across existing course queries.

### Two-Way Trigger Referential Protection
1. **Child Application Validation (`trg_validate_course_application_course_id`):**
   - Validates that `NEW.course_id::text` matches an existing row in `public.courses`.
   - **Concurrency Guard:** Executes `SELECT 1 FROM public.courses WHERE id = NEW.course_id::text FOR KEY SHARE`. Taking a shared row lock blocks any concurrent transaction attempting to delete or alter the course until the application creation transaction completes.
   - **SECURITY DEFINER & Precise RLS Boundary Semantics:** Declared with `SECURITY DEFINER` and `SET search_path = pg_catalog, public, pg_temp` to allow guest applicants (DEC-02) to validate course existence even when caller permissions limit direct SELECT access.
     - A `SECURITY DEFINER` function executes with the privileges of its owning role rather than the calling role.
     - `SECURITY DEFINER` does **not** automatically bypass Row Level Security (RLS).
     - RLS on `public.courses` is bypassed only if:
       1. The owning role possesses the PostgreSQL `BYPASSRLS` role attribute, OR
       2. The owning role is a PostgreSQL superuser, OR
       3. The owning role is the table owner of `public.courses` AND `FORCE ROW LEVEL SECURITY` is **not** enabled on `public.courses`.
     - **FORCE ROW LEVEL SECURITY Behavior & Boundaries:**
       - When `FORCE ROW LEVEL SECURITY` is enabled on `public.courses`, a table owner that does not otherwise bypass RLS becomes subject to RLS.
       - `FORCE ROW LEVEL SECURITY` does **not** override the `BYPASSRLS` attribute or superuser bypass (superusers and roles with `BYPASSRLS` remain exempt from RLS regardless of `FORCE RLS`).
     - A role without `BYPASSRLS` that is neither a superuser nor an exempt table owner remains subject to applicable RLS policies on `public.courses`, which evaluate and govern row visibility.
     - In all cases, required underlying table privileges (`SELECT` on `public.courses` for the referential query) must strictly exist.
     - Production function ownership, role attributes (`BYPASSRLS`), table-level grants, and live `FORCE ROW LEVEL SECURITY` configuration on `public.courses` have **not** been inspected or verified and remain mandatory implementation prerequisites to be confirmed during Phase 3.4.
   - **Least Privilege:** `REVOKE EXECUTE ON FUNCTION public.validate_course_application_course_id() FROM PUBLIC;`.
2. **Parent Course Deletion Protection (`trg_prevent_course_deletion_or_id_change`):**
   - Defined `BEFORE UPDATE OF id OR DELETE ON public.courses`.
   - Checks if any record in `public.course_applications` references `OLD.id`.
   - Raises an explicit `foreign_key_violation` exception (SQLSTATE `23503`) if an administrator attempts to delete the course or alter its ID.
   - Enforces the rule that live courses must be unpublished or retired rather than deleted.
   - **Least Privilege:** `REVOKE EXECUTE ON FUNCTION public.prevent_referenced_course_deletion_or_id_change() FROM PUBLIC;`.

---

## 5. Application vs. Payment vs. Enrollment Separation (DEC-03)

The schema enforces strict domain decoupling:
- **Academic Evaluation:** Tracked via `course_applications.status`.
- **Payment Verification:** Tracked via `course_applications.payment_status`.
- **Database Lifecycle Constraint:**
  ```sql
  CONSTRAINT chk_course_applications_enrolled_payment CHECK (
      status != 'enrolled' OR payment_status IN ('verified', 'waived', 'not_required')
  )
  ```
  Guarantees that an application can never transition to `enrolled` without verified payment or explicit waiver, even if application-layer code has a flaw.

---

## 6. Guest Account Linking Security Architecture (DEC-02)

### Claim Token Cryptographic Security
1. **Column Additions:**
   - `guest_claim_token_hash TEXT NULL`
   - `guest_claim_token_expires_at TIMESTAMPTZ NULL`
2. **Hash-Only Storage:** Plaintext tokens are never stored in the database. When a guest submits an application, a high-entropy random token (CSPRNG, $\ge 32$ bytes) is generated in server memory, emailed to the student, and hashed using SHA-256 before persisting into `guest_claim_token_hash`.
3. **Consistent Default TTL:** **7 days (168 hours)** across all documentation and implementations.
4. **Mandatory Authorization Invariants:**
   The future claiming RPC must enforce ALL of the following:
   - `user_id IS NULL` on the target application.
   - `guest_claim_token_hash IS NOT NULL`.
   - Supplied token hash matches stored hash.
   - `guest_claim_token_expires_at IS NOT NULL` and `guest_claim_token_expires_at > now()`.
   - Authenticated user session exists (`auth.uid() IS NOT NULL`).
   - Account email is confirmed (`auth.users.email_confirmed_at IS NOT NULL`).
   - Verified account identity is retrieved directly from `auth.users` using `auth.uid()` (never trusting caller-supplied email inputs).
   - Normalized account email matches application email (`lower(trim(auth.users.email)) = lower(trim(student_email))`).
   - Single-use consumption: atomically resets **both** `guest_claim_token_hash = NULL` and `guest_claim_token_expires_at = NULL`.
   - **Anti-Hijacking:** Already-linked applications (`user_id IS NOT NULL`) cannot be claimed or reassigned under any circumstances.
   - **Anti-Enumeration:** Generic failure responses prevent malicious callers from verifying whether an application exists for an arbitrary email address.
   - **Never permit claiming if `guest_claim_token_hash IS NULL`.**
5. **Least-Privilege Execution Policy (Future RPC):**
   - Execution revoked from `PUBLIC` and `anon`.
   - Granted strictly to `authenticated`.
   - `SECURITY DEFINER` required to read `auth.users` securely; owner assumed to be `postgres` / `supabase_admin` (unverified in production).
   - `digest()` extension schema location (e.g. `extensions.digest` vs `public.digest`) is **unverified** and requires confirmation before implementation.

---

## 7. Audit Log Immutability & Retention (DEC-05)

### Immutability Mechanisms
1. **Row-Level Mutation Block:**
   Trigger `trg_course_application_audit_logs_immutable` executes `BEFORE UPDATE OR DELETE` on `public.course_application_audit_logs` and raises an exception with SQLSTATE `42501` (`insufficient_privilege`).
2. **Statement-Level Truncate Block:**
   Trigger `trg_course_application_audit_logs_prevent_truncate` executes `BEFORE TRUNCATE` on `public.course_application_audit_logs` and aborts the statement.
3. **Privilege Revocation:**
   `REVOKE UPDATE, DELETE, TRUNCATE ON public.course_application_audit_logs FROM PUBLIC, anon, authenticated;`
4. **Permanent Survival:**
   Foreign key `application_id REFERENCES public.course_applications(id) ON DELETE SET NULL` ensures audit records survive the 5-year application retention purge.

### Security Boundary & Operational Limitations
- These mechanisms prevent tampering from frontend users, compromised application roles, and standard database users.
- They do **not** provide absolute immutability against PostgreSQL superusers (`postgres` or `supabase_admin`), who can disable triggers or drop tables. This boundary reflects the reality of database security.

---

## 8. Notification Outbox Architecture

1. **Transactional Insertion:** Outbox notifications are inserted in the same transaction as application state changes.
2. **Idempotency Guarantee:** `idempotency_key TEXT UNIQUE NOT NULL` prevents duplicate notification dispatches.
3. **Optimized Polling & Lease Recovery Index:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_notification_outbox_queue 
       ON public.notification_outbox (next_attempt_at, locked_until)
       WHERE status IN ('pending', 'failed');
   ```
   Directly serves worker queries:
   `WHERE status IN ('pending', 'failed') AND next_attempt_at <= now() AND (locked_until IS NULL OR locked_until < now()) ORDER BY next_attempt_at ASC`.

---

## 9. Function Security & Search Path Hardening

Every procedural function in the migration is hardened against search-path injection:
- `public.generate_course_application_number()`: `SET search_path = pg_catalog, public, pg_temp;`
- `public.validate_course_application_course_id()`: `SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;` (REVOKE from PUBLIC)
- `public.prevent_referenced_course_deletion_or_id_change()`: `SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;` (REVOKE from PUBLIC)
- `public.prevent_course_application_audit_log_mutation()`: `SET search_path = pg_catalog, public, pg_temp;`
- `public.set_course_application_updated_at()`: `SET search_path = pg_catalog, public, pg_temp;`

---

## 10. Enrollment Concurrency Considerations

### Architectural Invariants
1. Production table `public.enrollments_users` does **not** have a unique constraint on `(student_email, course_id)`. Using `ON CONFLICT` clauses in PostgreSQL fails at runtime without a matching unique constraint.
2. Production table `public.enrollments_users` does **not** have an enrollment status column.
3. Arbitrary record selection via `LIMIT 1` or aggregate operations on UUIDs (e.g. `MIN(id)`) is prohibited.
4. Two-query patterns (count followed by select) risk snapshot skew under default `READ COMMITTED` isolation if concurrent writers insert between queries.

### Concurrency Protection & Snapshot-Consistent Deduplication Protocol
The upcoming approval RPC must use:
1. **Advisory Lock Scoping:** Dual-parameter transaction advisory lock:
   `PERFORM pg_advisory_xact_lock(hashtext(lower(trim(v_app.student_email))), hashtext(v_app.course_id::text));`
2. **Row Lock on Application:**
   `SELECT * FROM public.course_applications WHERE id = p_application_id FOR UPDATE;`
3. **Single Snapshot-Consistent Deduplication Query (Within Lock):**
   ```sql
   -- 1. Single snapshot query: obtain match count and candidate UUID from identical statement snapshot
   SELECT count(*), (array_agg(id))[1]
   INTO v_match_count, v_candidate_id
   FROM public.enrollments_users
   WHERE lower(trim(student_email)) = lower(trim(v_app.student_email))
     AND course_id = v_app.course_id;

   IF v_match_count = 1 THEN
       -- 2. Exactly one record exists in this snapshot: reuse its UUID safely
       v_enrollment_id := v_candidate_id;

   ELSIF v_match_count > 1 THEN
       -- 3. Multiple conflicting records detected in this snapshot: fail safely and require manual reconciliation
       RAISE EXCEPTION 'Multiple conflicting enrollment records (%) found for student % and course %. Manual administrative reconciliation required.',
           v_match_count, v_app.student_email, v_app.course_id
           USING ERRCODE = 'data_exception';

   ELSE
       -- 4. Exactly zero existing enrollments: insert new record safely under transaction advisory lock
       INSERT INTO public.enrollments_users (
           student_name,
           student_email,
           course_id,
           enrollment_date
       ) VALUES (
           v_app.student_name,
           lower(trim(v_app.student_email)),
           v_app.course_id,
           now()
       )
       RETURNING id INTO v_enrollment_id;
   END IF;
   ```

### Advisory Lock Protocol Limitation
> [!IMPORTANT]
> **Advisory Lock Boundary Limitation:**
> The transaction-scoped advisory lock (`pg_advisory_xact_lock`) coordinates **only** cooperative writers that execute within this approved application approval workflow using the identical `(hashtext(email), hashtext(course_id))` key protocol.
> It does **not** block or serialize uncoordinated legacy processes, manual administrative database inserts, or external integrations that write directly to `public.enrollments_users` without acquiring this advisory lock.
> Therefore, this mechanism does **not** provide an absolute database-level mathematical uniqueness guarantee. True relational uniqueness requires an explicit database unique constraint or unique index on `(lower(trim(student_email)), course_id)`. Such a constraint cannot be safely introduced until an authorized read-only deduplication audit of existing production `enrollments_users` data is conducted in Phase 3.4.

---

## 11. Row Level Security (RLS) & Access Policy Prerequisite (Deployment Blocker)

> [!CAUTION]
> **CRITICAL PRE-DEPLOYMENT SECURITY REQUIREMENT:**
> The migration script `supabase_course_applications_schema_v1.sql` currently establishes the core relational tables, foreign key relationships, sequences, triggers, and secondary indexes.
> **It does NOT enable Row Level Security (RLS) or establish access policies.**
> **PRODUCTION DEPLOYMENT IS BLOCKED** until RLS policies and table grant/revoke permissions are formally designed, audited, and approved for all five tables:
> 1. `public.course_applications`
> 2. `public.course_application_documents`
> 3. `public.course_application_events`
> 4. `public.course_application_audit_logs`
> 5. `public.notification_outbox`

### Privilege Architecture, Default Grants & RLS Deny-By-Default
1. **PostgreSQL Table-Level Privileges:**
   In vanilla PostgreSQL, newly created tables grant permissions (`ALL`) exclusively to the creating table owner. Third-party roles have zero access unless granted explicitly or via default privileges.
2. **Supabase Default Privileges (`ALTER DEFAULT PRIVILEGES`):**
   In standard Supabase environments, initial setup routines often configure default privileges in the `public` schema (`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated, service_role`), allowing newly created tables to be queried by PostgREST API roles unless customized or restricted.
3. **RLS Policy Enforcement Layer:**
   Table privileges operate as the initial gate. If table privileges exist, enabling Row Level Security activates row-by-row filtering. Executing `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` without defining permissive policies enforces a strict **deny-by-default** rule for non-superusers (`anon`, `authenticated`), causing direct client PostgREST queries to fail with HTTP 401/403.
4. **Unverified Live Project ACL Configuration:**
   Because Phase 3.3.x is strictly local and read-only, the production Supabase instance's live default privileges, role grants, schema-level ACLs, and table-level ownership have **not** been freshly inspected.
   - The five Course Application tables have **not been deployed** to production, and production does not currently expose them.
   - Production deployment is strictly **BLOCKED** until live default privileges and ACLs are audited, and explicit least-privilege table grants/revocations and RLS policies are designed and approved.

### Three Operational Access Tiers
Any future RLS implementation must differentiate between:
1. **Authenticated Client Access (`authenticated` role):**
   - Students: May read only their owned applications (`user_id = auth.uid()`), upload and view documents for owned applications, and view timeline events. Direct client updates or status alterations are forbidden.
   - Administrators: May read all or assigned dossiers, update review statuses, and append timeline events, authenticated via verified role check in `public.profile` (`role = 'admin'`).
2. **Anonymous Guest Submission (`anon` role):**
   - DEC-02 permits prospective candidates to apply without an account (`user_id IS NULL`).
   - However, direct table access by `anon` creates severe security risks (data harvesting, spam, and dossier poisoning).
   - Guest submissions and document uploads must be routed through a validated, rate-limited server-side API or trusted RPC, while direct `anon` table access via PostgREST remains forbidden.
3. **Trusted Server-Side Operations (`service_role` / Background Workers):**
   - Notification worker polling `public.notification_outbox` requires exclusive access. `anon` and `authenticated` roles must have ZERO access to `notification_outbox`.
   - Guest claim processing and enrollment materialization execute via trusted `SECURITY DEFINER` RPCs.

### Audit Log Mutation Security Boundary
- The triggers and REVOKE statement on `public.course_application_audit_logs` enforce row-level immutability (`BEFORE UPDATE OR DELETE`) and statement-level truncate protection (`BEFORE TRUNCATE`).
- These mechanisms prevent tampering with audit records once written.
- However, they do **not** restrict `SELECT` access to audit logs, and they provide **zero security** for `course_applications`, `course_application_documents`, `course_application_events`, or `notification_outbox`.

---

## 12. Migration Quality & Rerun Safety

### Idempotent Statements
- `CREATE SEQUENCE IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION ...`
- `DROP TRIGGER IF EXISTS ... CREATE TRIGGER ...`
- `CREATE INDEX IF NOT EXISTS ...`
- `REVOKE ... FROM ...`

### Inspection-Required Statements
- `CREATE TABLE IF NOT EXISTS`: Will not add missing columns (e.g., `guest_claim_token_hash`, `guest_claim_token_expires_at`) or alter existing columns if a table with the same name already exists in the database.
- `CREATE UNIQUE INDEX IF NOT EXISTS`: Will fail if duplicate data exists when the index is built.

### Failure Detection & Atomicity
PostgreSQL executes DDL transactions atomically. When applied via Supabase CLI or SQL editor, wrapping the script in:
```sql
BEGIN;
-- migration statements
COMMIT;
```
ensures that any syntax error, permission error, or constraint violation triggers an immediate, clean rollback with zero partial schema pollution.

---

## 13. Bioinformatics Course Discrepancy Status

- **Previously Observed Identifier:** In earlier production inspection, `public.courses` contained `Bioinformatics & Computational Biology` with UUID `619be200-832d-41e8-97b8-d0515031ae76`.
- **Current Audit Stance:** Neither Phase 3.3.1 nor Phase 3.3.2/3.3.4/3.3.5/3.3.6/3.3.7/3.3.8 accessed production. Therefore, `619be200-832d-41e8-97b8-d0515031ae76` is treated as a previously observed production value, not a freshly verified current database fact.
- **Strict Prohibition:** **No seed migration is included** in this schema draft. No course records are inserted or modified. Authorized live verification will take place prior to frontend fallback updates.

---

## 14. Explicit Safety & Read-Only Confirmation

- **Original Project Repository (`pathfinder-forge-52`):** Exclusive permanent development location.
- **Active Feature Branch:** `feature/course-application-management`.
- **Pre-existing SQL Files Preserved:** All 4 uncommitted SQL files remain untouched (SHA-256 verified byte-for-byte).
- **Production Database Modifications:** **NONE.**
- **Supabase Objects Created / Altered:** **NONE.**
- **Deployment Operations:** **NONE.**

---

## 15. Historical Progression & Phase Evolution

| Phase | Milestone & Focus | Scope & Changes |
| :--- | :--- | :--- |
| **Phase 3.3** | Initial Core Schema Migration Draft | Established foundational 5-table relational schema draft in root. |
| **Phase 3.3.1** | Read-Only Technical Audit | Audited schema draft against approved decisions; identified constraint and trigger gaps. |
| **Phase 3.3.2** | Migration Draft Corrections | Resolved naming collisions, added trigger search-path hardening, and aligned DEC constraints. |
| **Phase 3.3.3** | Artifact Inspection & SQL Handoff | Read-only inspection and packaging of complete artifacts for review. |
| **Phase 3.3.4** | Guest Claim Security & Database Consistency | Replaced plaintext tokens with SHA-256 hash storage, 7-day TTL, and email-confirmed verification. |
| **Phase 3.3.5** | Final Guest Claim SQL & UUID Deduplication | Corrected anti-hijacking invariants and UUID deduplication logic in documentation. |
| **Phase 3.3.6** | Concurrency & Privilege Hardening | Implemented snapshot-consistent single-statement deduplication and revoked trigger execute privileges. |
| **Phase 3.3.7** | Project Consolidation & Publication | Migrated all work into permanent repository `F:/Project/pathfinder-forge-52`, published to GitHub, and removed separate worktree. |
| **Phase 3.3.8** | Security Scope & RLS Prerequisites | Identified RLS deployment blocker, defined 3 access tiers, corrected advisory-lock boundary wording, and reconciled schema additions. |
| **Phase 3.3.9** | Documentation Accuracy & Security Assumption Corrections | Reconciled SQL line counts (481 lines via standard newline counting), labeled dual base commits (0a9d79a upstream vs 43a0e0d consolidation), qualified default privileges, added SECURITY DEFINER FORCE RLS caveats, and aligned query planner reality. |
| **Phase 3.3.10** | Final Security Caveats & Protected-File Audit | Explicitly codified precise PostgreSQL RLS bypass criteria (BYPASSRLS / superuser / non-FORCE RLS owner) across all artifacts and completed comprehensive baseline-aware protected-file SHA-256 audit. |
| **Phase 3.3.11** | Final RLS Semantics Clarification | Clarified that FORCE ROW LEVEL SECURITY does not override BYPASSRLS or superuser bypass, and eliminated ambiguous phrasing regarding roles subject to RLS. |

---

> **Phase 3.3.11 Status:** **FINAL RLS SEMANTICS CLARIFICATION COMPLETE.**  
> Schema draft [`supabase_course_applications_schema_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_schema_v1.sql), architecture specification [`docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md`](file:///F:/Project/pathfinder-forge-52/docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md), and migration runbook [`docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md`](file:///F:/Project/pathfinder-forge-52/docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md) are fully synchronized and preserved in [`F:/Project/pathfinder-forge-52`](file:///F:/Project/pathfinder-forge-52).
