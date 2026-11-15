# PathFinder Course Application Management System — Database Migration Runbook (Draft V1.4)

**Phase:** 3.3.6 — Snapshot-Consistent Enrollment Concurrency & Privilege Hardening  
**Target Repository:** `F:/Project/pathfinder-forge-52`  
**Target Branch:** `feature/course-application-management`  
**Migration Draft File:** [`supabase_course_applications_schema_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_schema_v1.sql)  
**Execution Status:** **DRAFT ONLY — NOT EXECUTED AGAINST ANY DATABASE**  
**Base Commit:** `0a9d79a95f28942e115bacf10d5166c6441e9267` (`origin/main`)  

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
   - **Race-Condition Protection:** Executes `SELECT 1 FROM public.courses WHERE id = NEW.course_id::text FOR KEY SHARE`. Taking a shared row lock blocks any concurrent transaction attempting to delete or alter the course until the application creation transaction completes.
   - **Security Definer:** Declared with `SECURITY DEFINER` and `SET search_path = pg_catalog, public, pg_temp`. This allows unauthenticated guest applicants (DEC-02) to validate course existence even when RLS on `public.courses` restricts direct SELECT queries.
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

## 11. Migration Quality & Rerun Safety

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

## 12. Bioinformatics Course Discrepancy Status

- **Previously Observed Identifier:** In earlier production inspection, `public.courses` contained `Bioinformatics & Computational Biology` with UUID `619be200-832d-41e8-97b8-d0515031ae76`.
- **Current Audit Stance:** Neither Phase 3.3.1 nor Phase 3.3.2/3.3.4/3.3.5/3.3.6 accessed production. Therefore, `619be200-832d-41e8-97b8-d0515031ae76` is treated as a previously observed production value, not a freshly verified current database fact.
- **Strict Prohibition:** **No seed migration is included** in this schema draft. No course records are inserted or modified. Authorized live verification will take place prior to frontend fallback updates.

---

## 13. Explicit Safety & Read-Only Confirmation

- **Repository Files Modified in Original Worktree (`pathfinder-forge-52`):** **ZERO.**
- **Pre-existing SQL Files Preserved:** All 4 uncommitted SQL files remain untouched.
- **Production Database Modifications:** **NONE.**
- **Supabase Objects Created / Altered:** **NONE.**
- **Deployment Operations:** **NONE.**

---

> **Phase 3.3.6 Status:** **SNAPSHOT-CONSISTENT ENROLLMENT CONCURRENCY & PRIVILEGE HARDENING APPLIED.**  
> Schema draft [`supabase_course_applications_schema_v1.sql`](file:///F:/Project/pathfinder-forge-52/supabase_course_applications_schema_v1.sql), architecture specification [`docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md`](file:///F:/Project/pathfinder-forge-52/docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md), and migration runbook [`docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md`](file:///F:/Project/pathfinder-forge-52/docs/COURSE_APPLICATION_DATABASE_MIGRATIONS.md) have been synchronized.
