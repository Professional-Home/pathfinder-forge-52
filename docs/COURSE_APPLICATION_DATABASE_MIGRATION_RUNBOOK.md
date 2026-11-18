# Course Application Database Migration Runbook

**Document Phase:** Phase 3 Implementation (Consolidated Release)  
**Target Environment:** Supabase / PostgreSQL 15+  
**Target Branch:** `feature/course-application-management`  
**Security Specification:** `docs/COURSE_APPLICATION_RLS_SECURITY_DESIGN.md` (Version 1.7.0)  
**Architecture Specification:** `docs/COURSE_APPLICATION_SYSTEM_ARCHITECTURE.md`  

---

> [!IMPORTANT]
> **[MANUAL — YOU MUST DO THIS]**  
> Direct connections to the production Supabase database from automated tools are strictly prohibited.  
> An authorized human administrator must execute the following migration files manually using the Supabase Dashboard SQL Editor.

---

## 1. Target Supabase Project Identification & Pre-Migration Checklist

### Authorized Target Environments

| Environment | Supabase Project Reference | Status & Authorization Rules |
| :--- | :--- | :--- |
| **Staging** | `neexbpcvedcfwjxpgede` | **AUTHORIZED TARGET FOR STAGING MIGRATIONS.** All staging migration steps, verification scripts, and functional tests must target this project exclusively. |
| **Production** | `knrmfpgwcdtpwcgkjrnk` | **STRICTLY PROHIBITED DURING STAGING.** Zero automated connections, migrations, DDL, or data modifications are permitted against production until full release authorization is granted. |

> [!CAUTION]
> **Project Identity Verification Required:**  
> Before pasting or executing any SQL script in the Supabase Dashboard SQL Editor, operators must independently verify the active project reference in the browser URL (`https://supabase.com/dashboard/project/<ref>/sql`) to confirm that it matches `neexbpcvedcfwjxpgede`. Any execution against `knrmfpgwcdtpwcgkjrnk` during staging is strictly prohibited.

### Pre-Migration Checklist

Before applying these migrations:

- [ ] Confirm access to the Supabase Project Dashboard (`neexbpcvedcfwjxpgede`) with administrative permissions.
- [ ] Confirm database backup or snapshot availability in the Supabase Dashboard.
- [ ] Verify that the 4 protected legacy SQL files remain static byte-for-byte:
  - `supabase_auth_profile_schema.sql`
  - `supabase_auth_admin_rpc_lockdown_v1.sql`
  - `supabase_auth_profile_role_security_v1.sql`
  - `supabase_spin_wheel_rls_lockdown_v1.sql`
- [ ] Confirm no concurrent DDL operations are taking place on `public.courses` or `public.enrollments_users`.

---

## 2. Complete Migration Execution Sequence & SHA-256 Inventory

Migrations must be executed in this exact sequential order:

| Step | Migration File | SHA-256 Checksum | Staging Execution Status | Destructive? | Safety Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Step 0** | `supabase_staging_enrollment_prerequisite_v1.sql` | `F77CF57738F2FC94DCDC7C9CC3EA7134C9C7C71918DCFEA3DA0119C5F883F9EC` | **Applied Manually** by Operator | No | **SAFE** (Prerequisite foundation) |
| **Step 1** | `supabase_course_applications_v1_migration.sql` | `65747A2909683EFF477AAF234BA90BB9B39AC2694E88E21DB0F6657FE84DB89E` | **Applied Manually** by Operator | No | **SAFE** (Core application schema) |
| **Step 2** | `supabase_course_applications_v1_storage_remediation_v1.2.sql` | `5F83281D97C1F868C85B6B7494F35E3F62DC9942706BDBB8ACB0F3A077E48AAD` | **Applied Manually** by Operator | No | **SAFE** (Storage bucket & RLS) |
| **Step 3** | `supabase_staging_prerequisite_verification_v1.sql` | *(Diagnostic query)* | **Executed** (Verification only) | No | **SAFE** (Read-only verification) |
| **Step 4** | `supabase_course_applications_v1.1_google_forms_webhook.sql` | `2AD3CA0E52D67617B97783E3DB7D343E34448F0EA93FCE77112ABAB86CBF35D7` | **Applied Manually** by Operator (Staging: Success) | No | **READY** (Adds `external_submission_id`, `source`) |
| **Step 5** | `supabase_course_applications_v1.2_google_forms_workflow.sql` | `C495F14D4211380CB4517B94ADB468A70B75C0628FD8936BA51304281F3FEF3A` | **Applied Manually** by Operator (Staging: Success) | No | **READY** (Honest document status, approval RPC, verified student account check) |
| **Step 6** | `scripts/verification/verify_google_forms_staging.sql` | `365333bb6efad2a326f3643fffc5d9c4d80f33d49f7448471f1ca89f228ab456` | **Passed in Staging** (18/18 checks passed) | No | **SAFE** (Read-only staging verification: 18 criteria) |
| **Step 7** | `supabase_course_applications_v1.3_identity_conflict_quarantine.sql` | `EB241F70B18C9174CD60B0778D5FB8FF97E481FA3395879F20C22B0D083EC9F1` | **Applied Manually** by Operator (Staging: Success) | No | **SAFE** (Adds `is_identity_conflict`, `respondent_email`, reconciliation RPC, view sequence preservation) |
| **Step 8** | `scripts/verification/verify_google_forms_staging_v1.3.sql` | `9DA25D99E429E7D0A8FE64DE0E9D37A4B0C9554F1ED8D87C1DBB2AF0864B3A70` | **Passed in Staging** (12/12 checks passed) | No | **SAFE** (Read-only staging verification: 12 criteria) |

> [!IMPORTANT]
> **Strict Separation of Approval & Enrollment:**  
> - **Approval is purely admissions & payment verification:** Admin verifies candidate details and payment proof in Google Sheets, then executes `rpc_admin_approve_google_forms_application` with `p_confirmed_sheet_verification = true`. This updates `status = 'approved'`, `payment_status = 'verified'`, `documents_status = 'not_required'`. **It NEVER touches `enrollments_users`.**  
> - **Enrollment is a separate authorized action:** Only after an application is approved and payment verified can an authorized admin click "Activate Student Enrollment". The student must have an existing authenticated account (`public.profile`), linking their immutable `auth.users(id)`. This provisions course access in `public.enrollments_users`.

---

## 3. Execution Step 0: Prerequisite Foundation Migration

**File to execute:** `supabase_staging_enrollment_prerequisite_v1.sql`

### Purpose & Prerequisites:
The Course Application Management system integrates directly with `public.courses` and `public.enrollments_users` to track academic programs and link approved applications to student enrollments. This prerequisite migration establishes foundational tables, canonical course seeds, and resolution functions (`normalize_course_id()` and `resolve_course_title()`) required before applying the core application schema.

### Instructions:
1. In the **Supabase Dashboard** -> **SQL Editor**, click **+ New Query**.
2. Name the query: `20261115_course_applications_prerequisite_v1`.
3. Open `supabase_staging_enrollment_prerequisite_v1.sql`, copy the contents, and paste into the editor.
4. Click **Run** (or `Ctrl+Enter` / `Cmd+Enter`).
5. Verify success (`Success. No rows returned.`).

---

## 4. Execution Step 1: Relational Schema & Stored Procedures

**File to execute:** `supabase_course_applications_v1_migration.sql`

### Instructions:
1. Open your browser and navigate to your **Supabase Dashboard** -> **SQL Editor**.
2. Click **+ New Query**.
3. Name the query: `20261115_course_applications_v1_migration`.
4. Open the local file `supabase_course_applications_v1_migration.sql` in your editor, copy the entire file contents, and paste them into the SQL Editor.
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
6. Verify that the query execution completes with:
   ```text
   Success. No rows returned.
   ```
   (Transactions are committed automatically by the `COMMIT;` statement at the end of the script).

### Key Components Created:
1. `public.course_application_number_seq` & `generate_course_application_number()`
2. `validate_course_application_course_id()` trigger function (DEC-01 TEXT to UUID validation)
3. `prevent_audit_log_tampering()` trigger function (Append-only immutability)
4. `set_course_application_updated_at()` trigger function
5. `public.course_applications` (Core table with RLS)
6. `public.course_application_documents` (Document metadata with RLS)
7. `public.course_application_events` (Milestone progress log with `occurrence_seq` & unique constraint)
8. `public.course_application_audit_logs` (Compliance audit log with immutability trigger)
9. `public.notification_outbox` (Transactional email queue with `FOR UPDATE SKIP LOCKED` indexes)
10. `public.candidate_course_applications` (Security-invoker candidate view excluding sensitive hashes)
11. Column-level `SELECT` grants for `authenticated` and `anon`
12. Stored Procedures (`SECURITY DEFINER`, search_path locked down, execution granted only to `service_role`):
    - `public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT)` (V1.7.0 typed snapshot & DEC-03 separation)
    - `public.rpc_claim_guest_application(TEXT, UUID, TEXT)` (DEC-02 atomic claiming)
    - `public.rpc_dequeue_notification_batch(INT, INT)` (Atomic worker dequeue)

---

## 5. Execution Step 2: Storage Bucket & Document Security (Remediation V1.2)

**File to execute:** `supabase_course_applications_v1_storage_remediation_v1.2.sql`

> [!WARNING]
> **CRITICAL: DO NOT EXECUTE STORAGE REMEDIATION V1.1 (`supabase_course_applications_v1_storage_remediation_v1.1.sql`)**  
> The previous V1.1 script attempts an unauthorized ownership-level operation (`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`), which fails in Supabase managed environments with PostgreSQL error:  
> `ERROR: 42501: must be owner of table objects`  
> **Under no circumstances should V1.1 be executed.**  
> The approved remediation script is **V1.2** (`supabase_course_applications_v1_storage_remediation_v1.2.sql`), which eliminates the 42501 error by replacing table ownership alterations with non-privileged, fail-closed catalog assertions checking `pg_class.relrowsecurity`.

### Instructions:
1. In the **Supabase Dashboard** -> **SQL Editor**, click **+ New Query**.
2. Name the query: `20261116_course_applications_storage_remediation_v1.2`.
3. Open `supabase_course_applications_v1_storage_remediation_v1.2.sql`, copy the contents, and paste into the editor.
4. Click **Run**.
5. Verify success.

### Key Components Created:
1. Private Storage Bucket: `course-applications` (`public = false`, 10 MB file size limit, allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`).
2. Non-privileged, fail-closed catalog assertion checking `pg_class.relrowsecurity` on `storage.objects` (eliminating PostgreSQL 42501 ownership error).
3. Hardened Storage RLS Policies:
   - `course_docs_service_role_all`: Full access for `service_role`.
   - `course_docs_student_read_policy`: Authenticated student read access isolated to their own application folder with regex UUID pre-validation preventing PostgreSQL 22P02 errors.
   - `course_docs_admin_read_policy`: Administrator read access for `(auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')`.
   - Direct anonymous and standard unmediated student uploads are strictly denied.

---

## 6. Execution Step 4: Google Forms Ingestion Columns (Migration V1.1)

**File to execute:** `supabase_course_applications_v1.1_google_forms_webhook.sql`

### Instructions:
1. In the **Supabase Dashboard** -> **SQL Editor**, click **+ New Query**.
2. Name the query: `20261116_course_applications_webhook_v1.1`.
3. Open `supabase_course_applications_v1.1_google_forms_webhook.sql`, copy the contents, and paste into the editor.
4. Click **Run**.
5. Verify that the query execution completes with:
   ```text
   Success. No rows returned.
   ```

### Key Components Created:
1. `public.course_applications.external_submission_id` (Google Forms response ID for idempotency).
2. `public.course_applications.source` with check constraint `CHECK (source IN ('web', 'google_forms', 'manual_import'))`.
3. Partial unique index `idx_course_applications_external_submission_id` on non-null `external_submission_id`.
4. Updated security-invoker view `public.candidate_course_applications`.

---

## 7. Execution Step 5: Google Forms Workflow & Honest Document Status (Migration V1.2)

**File to execute:** `supabase_course_applications_v1.2_google_forms_workflow.sql`

### Instructions:
1. In the **Supabase Dashboard** -> **SQL Editor**, click **+ New Query**.
2. Name the query: `20261116_course_applications_google_forms_workflow_v1.2`.
3. Open `supabase_course_applications_v1.2_google_forms_workflow.sql`, copy the contents, and paste into the editor.
4. Click **Run**.
5. Verify that the query execution completes with:
   ```text
   Success. No rows returned.
   ```

### Key Components Created / Updated:
1. Updated check constraint `course_applications_documents_status_check` allowing `'not_required'` and `'waived'`.
2. Updated stored procedure `public.rpc_admin_transition_application_status` (v1.7.1) supporting honest `documents_status = 'not_required'` for Google Forms applications while strictly preserving transcript verification for direct portal submissions. Embedded `course_title`, `rejection_reason`, and `notes` automatically in outbox payload.
3. Dedicated atomic stored procedure `public.rpc_admin_approve_google_forms_application` for atomic approval and Google Sheets payment verification:
   - Sets status = 'approved', payment_status = 'verified', documents_status = 'not_required'.
   - Inserts progress milestone into `public.course_application_events` (storing notes in `metadata`).
   - Inserts compliance trail into `public.course_application_audit_logs` (using actual schema: `previous_state`, `new_state`, `notes`).
   - Enqueues notification into `public.notification_outbox` using physical schema: `template_name = 'application_approved'`, embedding `student_name`, `course_id`, `course_title`, `application_number` in `payload`.
4. Complete permission and role lockdown: `SECURITY DEFINER` with `SET search_path = ''`. Execution granted exclusively to `service_role`. Direct access from `PUBLIC`, `anon`, and `authenticated` is strictly revoked.
5. All non-atomic client fallbacks disabled: stored procedure execution is the authoritative atomic approval boundary with fail-closed error handling (`MIGRATION_REQUIRED` on missing RPC, `NETWORK_ERROR` on timeouts).

---

## 8. Execution Step 6: Identity Conflict Quarantine & Reconciliation Stored Procedure (Migration V1.3)

**File to execute:** `supabase_course_applications_v1.3_identity_conflict_quarantine.sql`

### Instructions:
1. In the **Supabase Dashboard** -> **SQL Editor**, click **+ New Query**.
2. Name the query: `20261117_course_applications_identity_conflict_v1.3`.
3. Open `supabase_course_applications_v1.3_identity_conflict_quarantine.sql`, copy the contents, and paste into the editor.
4. Click **Run**.
5. Verify that the query execution completes with:
   ```text
   Success. No rows returned.
   ```

### Key Components Created / Updated:
1. Added column `is_identity_conflict BOOLEAN NOT NULL DEFAULT FALSE` to `public.course_applications`.
2. Added column `respondent_email TEXT NULL` to `public.course_applications`.
3. Created partial index `idx_course_applications_identity_conflict ON public.course_applications(is_identity_conflict) WHERE is_identity_conflict = TRUE`.
4. Updated view `public.candidate_course_applications` with `is_identity_conflict` and `respondent_email` with `security_invoker = true`.
5. Updated `public.rpc_admin_approve_google_forms_application` with database-level quarantine guard (rejects approval if `is_identity_conflict = TRUE`).
6. Updated `public.rpc_admin_transition_application_status` (v1.7.2) with database-level quarantine guard (rejects transition to `approved` or `enrolled` if `is_identity_conflict = TRUE`).
7. Created atomic stored procedure `public.rpc_admin_reconcile_identity_conflict(UUID, UUID, TEXT, TEXT)`:
   - Updates `student_email` to the authoritative address.
   - Clears `is_identity_conflict = FALSE`.
   - Records metadata in `academic_background.google_forms.identity_reconciled = true`.
   - Inserts audit log `RECONCILE_IDENTITY_CONFLICT` and milestone event `IDENTITY_RECONCILED`.
   - Complete security lockdown: `SECURITY DEFINER SET search_path = ''`, execution restricted strictly to `service_role`.

---

## 9. Post-Migration Verification Queries & Operational Status

### Verification Scripts:
1. **Prerequisite Schema Verification:** Execute `supabase_staging_prerequisite_verification_v1.sql` to verify `courses` and `enrollments_users` tables, column definitions, course seeds, and normalization functions.
2. **Core Schema & Storage Verification:** Execute `supabase_course_applications_v1_verification.sql` to verify tables, RLS policies, column grants, triggers, RPC definitions, and storage bucket settings.
3. **Google Forms Webhook & Workflow Verification (V1.1 & V1.2):** `[MANUAL — STAGING-ONLY POST-MIGRATION VERIFICATION STEP]` Execute `scripts/verification/verify_google_forms_staging.sql` to perform an automated catalog audit of the 18 criteria introduced or changed by migrations V1.1 and V1.2.
4. **Google Forms Identity Conflict Verification (V1.3):** `[MANUAL — STAGING-ONLY POST-MIGRATION VERIFICATION STEP]` Execute `scripts/verification/verify_google_forms_staging_v1.3.sql` to perform an automated catalog audit of the 12 criteria introduced by migration V1.3.

### Verification Queries (Supabase SQL Editor):

In the SQL Editor, execute each of the following verification queries to confirm proper installation:

### Verification Query 1: Table & RLS Status
```sql
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
      'course_applications',
      'course_application_documents',
      'course_application_events',
      'course_application_audit_logs',
      'notification_outbox'
  )
ORDER BY c.relname;
```
**Expected Result:** 5 rows returned; `rls_enabled` is `true` for all 5 tables.

---

### Verification Query 2: Stored Procedure Lockdown & Privilege Verification
```sql
SELECT
    p.proname AS procedure_name,
    p.prosecdef AS is_security_definer,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
      'rpc_admin_transition_application_status',
      'rpc_admin_approve_google_forms_application',
      'rpc_claim_guest_application',
      'rpc_dequeue_notification_batch'
  )
ORDER BY p.proname;
```
**Expected Result:** 4 rows returned; `is_security_definer` is `true` for all 4 procedures.

---

### Verification Query 3: Candidate View Column Access Check
```sql
SELECT
    column_name,
    privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'candidate_course_applications'
  AND grantee = 'authenticated';
```
**Expected Result:** Grants present for safe candidate columns including `source` and `external_submission_id`; `claim_token_hash` must NOT be present in this list.

---

### Verification Query 4: Documents Status Check Constraint Verification
```sql
SELECT pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'course_applications'
  AND c.conname = 'course_applications_documents_status_check';
```
**Expected Result:** Constraint definition contains `'not_required'` and `'waived'`.

---

### Verification Query 5: Storage Bucket Configuration
```sql
SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'course-applications';
```
**Expected Result:** 1 row returned; `public` is `false`, `file_size_limit` is `10485760` (10 MB).

---

### Verification Query 6: Google Forms Workflow & RPC Verification Scorecard (V1.1 & V1.2)

> [!IMPORTANT]
> **[MANUAL — STAGING-ONLY POST-MIGRATION VERIFICATION STEP]**  
> Target Project: Staging Supabase (`neexbpcvedcfwjxpgede`) only. Do NOT run against production (`knrmfpgwcdtpwcgkjrnk`).

To verify the successful manual execution of migrations V1.1 and V1.2 on Staging:
1. Open the **Supabase Dashboard** -> **SQL Editor** for project `neexbpcvedcfwjxpgede`.
2. Click **+ New Query** and name it `20261117_verify_google_forms_staging`.
3. Open `scripts/verification/verify_google_forms_staging.sql`, copy the complete file contents, paste into the editor, and click **Run**.
4. The script contains strictly read-only `SELECT` queries across 10 sections:
   - **Section 1–8:** Detailed catalog inspection queries for columns, constraints, partial unique index, view with `security_invoker=true`, stored procedure signatures, `SECURITY DEFINER`, `search_path=''`, service_role execution privileges, and schema cleanliness.
   - **Section 9:** Unified 18-criteria automated scorecard matrix reporting `check_id`, `category`, `check_name`, `status` (`PASS`, `FAIL`, or `NOT FOUND`), and `details`.
   - **Section 10:** Aggregated scorecard totals.

**Expected Scorecard Outcome:**
```text
total_checks | passed_checks | failed_checks | not_found_checks | overall_status
-------------+---------------+---------------+------------------+-------------------------------------------------------------
          18 |            18 |             0 |                0 | ALL 18 CHECKS PASSED — STAGING GOOGLE FORMS WORKFLOW FULLY VERIFIED
```

> [!WARNING]
> **GATEWAY REQUIREMENT: VERIFICATION MUST PASS BEFORE CONFIGURATION**  
> Do **NOT** proceed to Google Forms Apps Script configuration, Google Sheets triggers, webhook URL setup, or live form synchronization until all 18 checks in `verify_google_forms_staging.sql` return `PASS` in Staging. If any check returns `FAIL` or `NOT FOUND`, review the specific check details in Section 9 and rectify the database state before proceeding.

---

### Verification Query 7: Identity Conflict Quarantine Scorecard (Migration V1.3)

> [!IMPORTANT]
> **[MANUAL — STAGING-ONLY POST-MIGRATION VERIFICATION STEP]**  
> Target Project: Staging Supabase (`neexbpcvedcfwjxpgede`) only. Do NOT run against production (`knrmfpgwcdtpwcgkjrnk`).

To verify the successful execution of migration V1.3 on Staging:
1. Open the **Supabase Dashboard** -> **SQL Editor** for project `neexbpcvedcfwjxpgede`.
2. Click **+ New Query** and name it `20261117_verify_google_forms_staging_v1.3`.
3. Open `scripts/verification/verify_google_forms_staging_v1.3.sql`, copy the complete file contents, paste into the editor, and click **Run**.
4. The script contains strictly read-only catalog queries auditing all 12 criteria across schema, permissions, and security guards:
   - Check 1: Column `is_identity_conflict` (BOOLEAN NOT NULL DEFAULT FALSE).
   - Check 2: Column `respondent_email` (TEXT NULL).
   - Check 3: Partial index `idx_course_applications_identity_conflict` active on quarantined rows.
   - Check 4: View `candidate_course_applications` exact 25-column sequence match (preserving V1.1 columns 1–23 byte-for-byte, appending `is_identity_conflict` at #24 and `respondent_email` at #25), strictly excludes `claim_token_hash`, preserves `security_invoker = true`, and grants `SELECT` to `authenticated`.
   - Check 5: Stored procedure `rpc_admin_reconcile_identity_conflict` (4 params) with `SECURITY DEFINER` and strictly empty `search_path`.
   - Check 6: `rpc_admin_reconcile_identity_conflict` permissions: `service_role` EXECUTE granted, `anon`/`authenticated` revoked, and `PUBLIC` EXECUTE explicitly revoked (audited via `aclexplode` grantee = 0).
   - Check 7: `rpc_admin_approve_google_forms_application` permissions: `service_role` EXECUTE granted, `anon`/`authenticated` revoked, and `PUBLIC` EXECUTE explicitly revoked (audited via `aclexplode` grantee = 0).
   - Check 8: `rpc_admin_transition_application_status` permissions: `service_role` EXECUTE granted, `anon`/`authenticated` revoked, and `PUBLIC` EXECUTE explicitly revoked (audited via `aclexplode` grantee = 0).
   - Check 9 (DEC-03 Guard): `rpc_admin_transition_application_status` strictly blocks generic approval for `google_forms` applications.
   - Check 10 (Quarantine Guard): `rpc_admin_transition_application_status` blocks `approved` and `enrolled` transitions on quarantined applications.
   - Check 11 (Quarantine Guard): `rpc_admin_approve_google_forms_application` blocks approval on quarantined applications.
   - Check 12 (Reconciliation Scope Guard): `rpc_admin_reconcile_identity_conflict` strictly restricts reconciliation to `google_forms` applications with an active unresolved conflict.

**Expected Scorecard Outcome:**
```text
total_checks | passed_checks | failed_checks | not_found_checks | overall_status
-------------+---------------+---------------+------------------+-------------------------------------------------------------
          12 |            12 |             0 |                0 | ALL 12 CHECKS PASSED — MIGRATION V1.3 IDENTITY CONFLICT FULLY VERIFIED
```

---

### Operational Note: Storage E2E Test Status (T1–T10)

> [!NOTE]
> **Storage E2E Test Execution Status: SKIPPED**  
> Storage E2E tests T1–T10 (defined in `scripts/staging_storage_auth_e2e_test.ts`) were previously **skipped by operator decision**.  
> - **They have NOT been executed and have NOT passed.**  
> - They must remain strictly classified as **SKIPPED** in all release tracking, reports, and deployment checklists.  
> - No deployment document or checklist may represent tests T1–T10 as passed without concrete CLI execution logs and evidence.  
> - Do not execute `scripts/staging_storage_auth_e2e_test.ts` during documentation or staging preparation without explicit operator authorization and approval flags (`--execute-staging-storage-e2e`).

---

## 10. Rollback Script (Emergency Recovery)

If a migration error occurs or deployment must be aborted, execute this rollback script in the Supabase SQL Editor:

```sql
BEGIN;

-- 1. Drop Candidate View
DROP VIEW IF EXISTS public.candidate_course_applications;

-- 2. Drop Stored Procedures
DROP FUNCTION IF EXISTS public.rpc_admin_reconcile_identity_conflict(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_admin_approve_google_forms_application(UUID, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.rpc_claim_guest_application(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT);

-- 3. Drop Triggers and Trigger Functions
DROP TRIGGER IF EXISTS trg_course_application_course_id_validation ON public.course_applications;
DROP FUNCTION IF EXISTS public.validate_course_application_course_id();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON public.course_application_audit_logs;
DROP FUNCTION IF EXISTS public.prevent_audit_log_tampering();

DROP TRIGGER IF EXISTS trg_course_applications_updated_at ON public.course_applications;
DROP TRIGGER IF EXISTS trg_course_application_documents_updated_at ON public.course_application_documents;
DROP TRIGGER IF EXISTS trg_notification_outbox_updated_at ON public.notification_outbox;
DROP FUNCTION IF EXISTS public.set_course_application_updated_at();

DROP FUNCTION IF EXISTS public.generate_course_application_number();
DROP SEQUENCE IF EXISTS public.course_application_number_seq;

-- 4. Drop Tables (in reverse dependency order)
DROP TABLE IF EXISTS public.notification_outbox CASCADE;
DROP TABLE IF EXISTS public.course_application_audit_logs CASCADE;
DROP TABLE IF EXISTS public.course_application_events CASCADE;
DROP TABLE IF EXISTS public.course_application_documents CASCADE;
DROP TABLE IF EXISTS public.course_applications CASCADE;

-- 5. Remove Storage Bucket (if empty)
DELETE FROM storage.buckets WHERE id = 'course-applications';

COMMIT;
```

---

## 11. Production Notification Worker & Environment Configuration

### Required Environment Variables

When deploying the course application system to production, configure the following environment variables in your hosting environment (e.g. Vercel Project Settings):

| Environment Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `APP_URL` | `https://project.micrylisbiotech.com` | Base application URL used in notification tracking, guest claim, and dashboard links. |
| `NOTIFICATION_WORKER_SECRET` | *(Random 32+ char secret)* | Dedicated shared secret required to authenticate invocations to `/api/worker/notifications`. |
| `CRON_SECRET` | *(Optional Vercel Cron secret)* | Alternate secret automatically provided by Vercel when executing scheduled cron requests. |
| `ENABLE_REAL_SMTP` | `"false"` *(Default)* | Keep disabled until real email delivery is deliberately approved. Operates worker in read-only simulation mode. |
| `GMAIL_USER` | *(Configured if SMTP enabled)* | Gmail sender address (e.g. `micrylisbiotech@gmail.com`). |
| `GMAIL_APP_PASSWORD` | *(Configured if SMTP enabled)* | 16-character Google Workspace App Password without spaces. |

### Operational Architecture & Security Guarantees

1. **On-Demand Worker Execution:**
   - The notification worker does **not** run an automatic polling loop or start background processes upon server boot.
   - It is triggered strictly on-demand via HTTP requests to `/api/worker/notifications` (`POST` or `GET`).

2. **Fail-Closed Authentication:**
   - The `/api/worker/notifications` endpoint requires an `Authorization: Bearer <secret>` or `x-worker-secret: <secret>` header matching `NOTIFICATION_WORKER_SECRET`, `CRON_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`.
   - **Fail-Closed Behavior:** If no worker authentication secret is configured on the server, the endpoint immediately rejects requests with **HTTP 503 Service Unavailable** (`{"success": false, "error": "Notification worker authentication is not configured on this server."}`) without touching the database or running any worker logic.
   - If a secret is configured but invalid or missing credentials are supplied, it returns **HTTP 401 Unauthorized**.

3. **Dry-Run Default:**
   - In its default state (`ENABLE_REAL_SMTP` not equal to `"true"`), the worker executes in safe dry-run mode: it simulates template rendering in memory and logs results, but never calls Nodemailer, never mutates outbox records to `"sent"`, and never increments attempt counters.

4. **Scheduled Execution:**
   - Automated periodic processing in production requires configuring a scheduler (such as Vercel Cron or an external monitor) to trigger `POST /api/worker/notifications` with `Bearer <NOTIFICATION_WORKER_SECRET>` at regular intervals (e.g. every 5 minutes).
