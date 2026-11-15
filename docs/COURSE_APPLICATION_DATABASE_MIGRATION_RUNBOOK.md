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

## 1. Pre-Migration Checklist

Before applying this migration:

- [ ] Confirm access to the Supabase Project Dashboard with administrative permissions.
- [ ] Confirm database backup or snapshot availability in the Supabase Dashboard.
- [ ] Verify that the 4 protected legacy SQL files remain static byte-for-byte:
  - `supabase_auth_profile_schema.sql`
  - `supabase_auth_admin_rpc_lockdown_v1.sql`
  - `supabase_auth_profile_role_security_v1.sql`
  - `supabase_spin_wheel_rls_lockdown_v1.sql`
- [ ] Confirm no concurrent DDL operations are taking place on `public.courses` or `public.enrollments_users`.

---

## 2. Execution Step 1: Relational Schema & Stored Procedures

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

## 3. Execution Step 2: Storage Bucket & Document Security

**File to execute:** `supabase_course_applications_storage_v1.sql`

### Instructions:
1. In the **Supabase Dashboard** -> **SQL Editor**, click **+ New Query**.
2. Name the query: `20261115_course_applications_storage_v1`.
3. Open `supabase_course_applications_storage_v1.sql`, copy the contents, and paste into the editor.
4. Click **Run**.
5. Verify success.

### Key Components Created:
1. Private Storage Bucket: `course-application-documents` (`public = false`, 10 MB file size limit, allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`).
2. Storage RLS Policies:
   - Direct anonymous and standard authenticated access denied.
   - Uploads and downloads mediated via server-generated signed URLs (`service_role`).

---

## 4. Execution Step 3: Post-Migration Verification Queries

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
      'rpc_claim_guest_application',
      'rpc_dequeue_notification_batch'
  )
ORDER BY p.proname;
```
**Expected Result:** 3 rows returned; `is_security_definer` is `true` for all 3 procedures.

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
**Expected Result:** Grants present for safe candidate columns; `claim_token_hash` must NOT be present in this list.

---

### Verification Query 4: Storage Bucket Configuration
```sql
SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'course-application-documents';
```
**Expected Result:** 1 row returned; `public` is `false`, `file_size_limit` is `10485760` (10 MB).

---

## 5. Rollback Script (Emergency Recovery)

If a migration error occurs or deployment must be aborted, execute this rollback script in the Supabase SQL Editor:

```sql
BEGIN;

-- 1. Drop Candidate View
DROP VIEW IF EXISTS public.candidate_course_applications;

-- 2. Drop Stored Procedures
DROP FUNCTION IF EXISTS public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT);
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
DELETE FROM storage.buckets WHERE id = 'course-application-documents';

COMMIT;
```
