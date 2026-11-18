# PathFinder Course Applications — Google Forms Webhook Ingestion Specification

**Document Version:** 1.3.0 (Simplified Google Forms Application Synchronization & Identity Conflict Remediation)  
**Phase:** Phase 1 (Task 1.2) & Phase 3 Preparation  
**Status:** Implemented & Verified (100% Vitest & TypeScript Passed)  
**System:** PathFinder Course Application Management System  
**Target Endpoint:** `POST /api/course-applications/webhook`  
**Apps Script Reference:** `scripts/google-apps-script/CourseApplicationsSheetsWebhook.gs`

---

## 1. Architectural Overview & Business Model

PathFinder utilizes official Google Forms for prospective student intake across all three canonical research tracks. Responses submitted to these forms are recorded in Google Sheets and synchronized in real time to PathFinder via a centralized, secure HTTP POST webhook.

### Core Business Requirement (Simplified Synchronization)
- **Google Forms and linked Google Sheets handle the complete student submission**, including payment proof uploads, academic questionnaires, and candidate details.
- **PathFinder receives and displays ONLY:**
  1. **Student Name** (`studentName`)
  2. **Student Email** (`studentEmail` / `enteredEmail`)
  3. **Google Respondent Email** (`respondentEmail`, authenticated Google account)
  4. **Selected Course** (`courseId` / canonical slug)
- **Payment proof and all other form answers remain in Google Sheets.** The administrator opens the relevant Google Sheet separately to inspect payment proof and make admission decisions in PathFinder.
- **No file conversion, Base64 decoding, Drive file retrieval, or Supabase Storage bucket uploads** occur through this webhook. (The existing storage bucket and infrastructure remain intact for other direct platform functions).
- **Newly synchronized applications appear in the admin panel with initial status `Pending Verification`.**
- **Identity Conflict Detection & Quarantine:** If the authenticated Google account (`respondentEmail`) differs from the candidate contact email entered in the form (`enteredEmail`), the application is placed in an explicit **Quarantined** state (`is_identity_conflict = TRUE`) and automatic account linking is suppressed (`user_id = NULL`). Approvals and enrollments are strictly blocked until an administrator performs identity reconciliation.

```mermaid
flowchart LR
    subgraph GoogleWorkspace["Google Workspace (Student Submissions)"]
        F1["Form 1: Bioplastics"] --> S1["Google Sheet 1 (Payment Proof & Data)"]
        F2["Form 2: Drug Discovery"] --> S2["Google Sheet 2 (Payment Proof & Data)"]
        F3["Form 3: Bioinformatics"] --> S3["Google Sheet 3 (Payment Proof & Data)"]
        S1 & S2 & S3 -->|onFormSubmit Trigger| GAS["Google Apps Script"]
    end

    subgraph PathFinderBackend["PathFinder Backend"]
        GAS -->|HTTPS POST + HMAC-SHA256| WH["/api/course-applications/webhook"]
        WH -->|Diagnostic Flag?| DIAG{"diagnostic: true?"}
        DIAG -->|Yes| PONG["Return DIAGNOSTIC_PONG (0 DB writes)"]
        DIAG -->|No| SEC["Constant-Time HMAC & Freshness Guard"]
        SEC -->|Idempotency Filter (responseId)| IDEM["Idempotency Filter"]
        IDEM -->|Identity Conflict Check| CONFLICT{"respondent != entered?"}
        CONFLICT -->|Yes| QUARANTINE["Insert Quarantined (user_id: NULL, is_identity_conflict: TRUE)"]
        CONFLICT -->|No| INSERT["Insert Normal Application (Pending Verification)"]
    end

    subgraph AdminConsole["Admin Review Workflow"]
        QUARANTINE --> RECON["Admin Dossier: Quarantined Badge & Reconciliation Modal"]
        INSERT --> ADMIN["Admin Applications Queue (/admin/applications)"]
        ADMIN -.->|Admin opens separate sheet| S1 & S2 & S3
        RECON -->|rpc_admin_reconcile_identity_conflict| ADMIN
        ADMIN -->|Approve / Reject / Enroll| DEC["Admissions Decision (DEC-03)"]
    end
```

---

## 2. Webhook Request & Authentication Contract

### HTTP Endpoint
- **Canonical Endpoint:** `POST https://<domain>/api/course-applications/webhook`
- **Supported Alias:** `POST https://<domain>/api/webhooks/course-applications` (routed identically in `src/server.ts`)
- **Strict Method Security:** Returns `405 Method Not Allowed` for any non-`POST` requests (including `GET`). Health checks and diagnostic validation are performed exclusively via authenticated in-band diagnostic pings.

### Environment Variable Secret
- **Canonical Secret Variable:** `COURSE_APPLICATION_WEBHOOK_SECRET` (configured in Vercel and local `.env.local`)
- **Supported Alias:** `GOOGLE_FORMS_WEBHOOK_SECRET` (supported as fallback in `getCourseApplicationWebhookSecret()`)
- **Secret Length Specification:**
  - Recommended Operational Standard: **32-byte cryptographic hex string (64 hexadecimal characters)** generated via `crypto.randomBytes(32).toString('hex')`.
  - Fail-Closed Runtime Minimum: **>= 16 characters**. If unconfigured or shorter than 16 characters, the endpoint immediately fails closed with HTTP 503 (`CONFIGURATION_ERROR`).

### Headers

| Header | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `x-webhook-signature` | `string` | **Yes** | Hexadecimal HMAC-SHA256 digest of the exact raw UTF-8 request body computed using `COURSE_APPLICATION_WEBHOOK_SECRET`. |
| `x-webhook-timestamp` | `string` | **Yes** | Epoch millisecond timestamp when the request was initiated (e.g. `1794762000000`). |
| `Content-Type` | `string` | **Yes** | Must be `application/json`. |
| `x-vercel-protection-bypass` | `string` | **Optional** | Dedicated Vercel Automation Bypass Secret. Required only when dispatching requests to a Vercel Preview Deployment protected by Vercel Authentication / Deployment Protection. |

*(Note: The server also accepts `x-course-app-signature` and `x-course-app-timestamp` aliases for backward compatibility).*

### Defense-in-Depth: Vercel Edge Protection & Application-Level HMAC

When targeting protected Vercel Preview environments, two independent security layers operate concurrently:
1. **Edge Infrastructure Layer (Vercel):** The `x-vercel-protection-bypass` header is evaluated at the Vercel edge. It permits non-interactive HTTP requests from automation (e.g. Google Apps Script) to bypass the interactive SSO login screen without making the deployment publicly accessible.
2. **Application Authentication Layer (PathFinder):** Once the request clears the Vercel edge, the PathFinder serverless handler enforces mandatory HMAC-SHA256 signature verification over the UTF-8 payload body and checks the 5-minute freshness timestamp. The Vercel bypass secret **never** replaces or weakens application-level authentication.
3. **Secret Isolation & Zero-Logging:** The bypass secret is stored exclusively in Google Apps Script `Script Properties` (key: `VERCEL_PROTECTION_BYPASS`). It is never hardcoded, never committed, and strictly excluded from diagnostic execution logs.

### Signature Computation (Google Apps Script)
```javascript
var rawJson = JSON.stringify(payload);
var rawBytes = Utilities.computeHmacSha256Signature(rawJson, webhookSecret);
var hexSignature = rawBytes.map(function(byte) {
  var hex = (byte < 0 ? byte + 256 : byte).toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}).join('');
```

### Security Guard Rules
1. **Constant-Time Verification:** Signatures are evaluated using `crypto.timingSafeEqual` to eliminate side-channel timing attacks.
2. **Freshness Window:** The request timestamp must be within **5 minutes** (`Math.abs(now - reqTime) <= 300,000ms`). Requests outside this window are rejected with `EXPIRED_TIMESTAMP`.
3. **Fail-Closed Secret Check:** If `COURSE_APPLICATION_WEBHOOK_SECRET` is unset or shorter than 16 characters, the endpoint immediately returns HTTP 503 (`CONFIGURATION_ERROR`). It never falls back to the Supabase service-role key or anonymous keys.
4. **Zero Secret Logging:** Secret keys, raw signatures, and PII are strictly excluded from server logs.

---

## 3. Safe In-Band Diagnostic Ping Specification

To verify Apps Script connectivity, DNS resolution, SSL handshakes, and HMAC shared secret alignment without mutating database state or creating dummy applicant records, the endpoint supports a zero-mutation diagnostic ping:

### Diagnostic Request Payload
```json
{
  "diagnostic": true,
  "action": "ping",
  "timestamp": 1794762000000,
  "courseId": "bioplastic-innovation"
}
```

### In-Band Interception Rules
1. The diagnostic request **must be authenticated** with valid `x-webhook-signature` and `x-webhook-timestamp` headers matching the shared secret and 5-minute freshness window.
2. The server intercepts the request immediately following authentication and payload JSON parsing.
3. **Zero Database Mutation:** It makes zero calls to `supabaseAdmin.from(...)`, creates no applications, inserts no audit logs, and queues no notifications.
4. Returns HTTP 200 with `DIAGNOSTIC_PONG`:
   ```json
   {
     "success": true,
     "code": "DIAGNOSTIC_PONG",
     "message": "PathFinder webhook diagnostic ping successful. Endpoint is operational and HMAC authentication verified.",
     "isDiagnostic": true,
     "courseId": "d2756643-0b82-4ebe-a123-9fa3be97bd13",
     "courseTitle": "Bioplastic Innovation & Sustainability",
     "timestamp": 1794762000100
   }
   ```

---

## 4. Payload Contract & Identity Conflict Quarantine

### Normal Ingestion Payload
```json
{
  "responseId": "2_ABaOnucSAMPLE_GOOGLE_FORM_RESPONSE_ID_987",
  "timestamp": 1794762000000,
  "courseId": "bioplastic-innovation",
  "studentName": "Aarav Sharma",
  "studentEmail": "aarav.sharma@example.com",
  "respondentEmail": "aarav.sharma@example.com"
}
```

### Field Definitions

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `responseId` | `string` | **Yes** | Immutable Google Forms response ID (from `formResponse.getId()`). Used for idempotency. (Alias `formResponseId` is also supported). |
| `timestamp` | `number \| string` | Optional | Submission timestamp from the Google Form response (in milliseconds). |
| `courseId` | `string` | **Yes** | Canonical course identifier or slug (see Canonical Course Mapping below). |
| `studentName` | `string` | **Yes** | Student's full legal name (minimum 2 characters, trimmed). |
| `studentEmail` | `string` | **Yes** | Contact email entered by the applicant. Normalized to lowercase. (Aliases: `enteredEmail`, `entered_email`). |
| `respondentEmail` | `string` | Optional | Authenticated Google account email retrieved via `formResponse.getRespondentEmail()`. Normalized to lowercase. |

### Identity Conflict Detection Contract
1. **Normalization:** Both `respondentEmail` and `studentEmail` are trimmed, validated via RFC 5322 regex, and lowercased.
2. **Comparison:** If `respondentEmail` is provided and `respondentEmailNorm !== enteredEmailNorm`:
   - `is_identity_conflict` is set to `TRUE`.
   - `respondent_email` column stores `respondentEmailNorm`.
   - `academic_background.google_forms.identity_conflict` is set to `true`.
   - `academic_background.google_forms.respondent_email` and `entered_email` are persisted.
   - **Suppression of Account Auto-Linking:** `user_id` is strictly set to `NULL` (even if an existing user matches `studentEmail`).
   - Lifecycle milestone event is created with `title = "Application Received (Quarantined: Identity Conflict)"`.
   - Audit log entry is recorded with action `INGEST_GOOGLE_FORMS_SUBMISSION_QUARANTINED`.
3. **If Respondent Email is Omitted:** If Google Forms is configured not to collect respondent emails, `respondent_email` is set to `NULL` and `is_identity_conflict` is `FALSE`.

### Strict Privacy Guarantee
- **Prohibited & Discarded Data:** Payment-proof files, Base64 strings, Google Drive URLs, phone numbers, WhatsApp numbers, transaction IDs, bank details, or academic questionnaire responses are **never transmitted to or persisted in PathFinder**.
- Even if extra fields are inadvertently included in the webhook body, the backend handler discards them and stores `student_phone: null`, `payment_reference: null`, and `payment_amount_inr: null`.
- Full responses, transaction numbers, and payment receipts remain strictly in the linked Google Sheet and Google Drive for administrator review.

---

## 5. Canonical Course Mapping

The webhook engine strictly validates `courseId` against the single source of truth in `src/lib/courses/course-identifiers.ts`. Unrecognized courses are rejected with `INVALID_COURSE_IDENTIFIER`.

| Track Name | Google Form URL | Accepted Aliases / Slugs | Canonical Database UUID |
| :--- | :--- | :--- | :--- |
| **Bioplastic Innovation & Sustainability** | `https://forms.gle/8GiUvQuT6wU8iZbU6` | `bioplastic-innovation`, `course-bioplastic-innovation` | `d2756643-0b82-4ebe-a123-9fa3be97bd13` |
| **AI in Drug Discovery & Molecular Design** | `https://forms.gle/KZHJbuiKSpDsBqzp7` | `ai-in-drug-discovery`, `course-ai-drug-discovery` | `d6a21b1f-2682-4cf2-a83d-2c030f476625` |
| **Advanced Bioinformatics & Genomic Data** | `https://forms.gle/ZN1HcXnv5g2Z9YXd9` | `bioinformatics`, `course-bioinformatics` | `840fed84-696d-458e-aeee-2df6b88d3428` |

---

## 6. Idempotency Strategy

Google Sheets or network proxies may retry webhook delivery due to transient HTTP errors. PathFinder ensures strict idempotency:

1. **Database-Level Unique Constraint:**
   `idx_course_applications_external_submission_id` enforces that no two rows in `public.course_applications` can possess the same non-null `external_submission_id`.
2. **Pre-Insert Lookup:**
   Before inserting, the handler checks `external_submission_id = responseId` (or within `academic_background.google_forms.response_id`).
3. **Graceful Duplicate Response:**
   If a matching application already exists, the endpoint returns HTTP 200:
   ```json
   {
     "success": true,
     "code": "DUPLICATE_SUBMISSION",
     "isDuplicate": true,
     "message": "Submission with response ID '...' was already processed as application APP-2026-01042.",
     "applicationId": "...",
     "applicationNumber": "APP-2026-01042",
     "courseId": "d2756643-0b82-4ebe-a123-9fa3be97bd13",
     "courseTitle": "Bioplastic Innovation & Sustainability"
   }
   ```
4. **Race-Condition Safety:**
   If concurrent identical requests hit simultaneously, PostgreSQL error `23505` is caught, the existing row is re-queried, and the duplicate response is safely returned without throwing an unhandled 500 error.

---

## 7. Status Machine, Quarantine & Admin Review Workflow

- **Initial State in Database:**
  - `status = 'submitted'` (displays as "Pending Verification" in Admin UI)
  - `payment_status = 'pending_verification'` (displays as "Pending Verification" in Admin UI)
  - `documents_status = 'not_required'` (honest state: candidate documents are managed in Google Sheets)
  - `user_id = NULL` (unclaimed until student account link/enrollment)
  - `source = 'google_forms'`
  - `external_submission_id = responseId`
  - `is_identity_conflict = TRUE / FALSE`
  - `respondent_email = respondentEmailNorm`
- **Quarantine Enforcement:**
  - While `is_identity_conflict = TRUE`, the application displays an amber **"Quarantined"** badge in the admin table and a prominent **Identity Conflict Warning Banner** in the dossier view.
  - The **"Approve Application (Google Sheets Verified)"** button is disabled with an explanatory tooltip: *"Application is quarantined due to an identity conflict. Reconcile identity before approval."*
  - The status transition engine (`adminTransitionApplicationCore`) blocks transition to `approved` or `enrolled`.
  - The database stored procedures `rpc_admin_approve_google_forms_application` and `rpc_admin_transition_application_status` fail closed if invoked on a quarantined application.

### 7.1 Administrative Reconciliation Workflow
When an administrator verifies the student's true identity (e.g. by cross-checking an institutional student ID or contacting the applicant):
1. Administrator clicks **"Reconcile Identity Conflict"** on the application detail page (`/admin/applications/$id`).
2. A dedicated reconciliation modal prompts the administrator to:
   - Select the authoritative email address (choose either the Google account, the entered email, or specify an updated email).
   - Enter mandatory verification notes (minimum 5 characters, e.g. *"Verified student identity by inspecting college ID card uploaded in Google Sheet row 14"*).
3. Executes atomic stored procedure `rpc_admin_reconcile_identity_conflict`:
   - Updates `student_email` to the authoritative address.
   - Sets `is_identity_conflict = FALSE`.
   - Records metadata in `academic_background.google_forms.identity_reconciled = true`.
   - Inserts audit log entry `RECONCILE_IDENTITY_CONFLICT`.
   - Inserts timeline event `IDENTITY_RECONCILED`.
4. The application is released from quarantine, enabling standard approval and subsequent enrollment activation.

---

## 8. Database Migration Requirements

### 1. Migration v1.1: Webhook Ingestion Columns
File: `supabase_course_applications_v1.1_google_forms_webhook.sql`
- Adds `external_submission_id TEXT` to `public.course_applications`.
- Adds partial unique index `idx_course_applications_external_submission_id`.
- Adds `source TEXT NOT NULL DEFAULT 'web'` with check constraint.
- Updates view `public.candidate_course_applications`.

### 2. Migration v1.2: Google Forms Workflow & Honest Document Status
File: `supabase_course_applications_v1.2_google_forms_workflow.sql`
- Updates `documents_status` check constraint to include `'not_required'` and `'waived'`.
- Adds atomic stored procedure `public.rpc_admin_approve_google_forms_application` for atomic approval and payment verification.

### 3. Migration v1.3: Identity Conflict Quarantine & Reconciliation Stored Procedure
File: `supabase_course_applications_v1.3_identity_conflict_quarantine.sql`
- Adds `is_identity_conflict BOOLEAN NOT NULL DEFAULT FALSE`.
- Adds `respondent_email TEXT NULL`.
- Adds partial index `idx_course_applications_identity_conflict ON public.course_applications(is_identity_conflict) WHERE is_identity_conflict = TRUE`.
- Updates `candidate_course_applications` view with `is_identity_conflict` and `respondent_email` via `CREATE OR REPLACE VIEW` without dropping the view (preserving dependent objects, grants, and `security_invoker = true`).
- Preserves the DEC-03 security rule: Google Forms applications cannot be approved via generic status transition.
- Updates `rpc_admin_approve_google_forms_application` and `rpc_admin_transition_application_status` with database-level quarantine guards.
- Adds atomic stored procedure `rpc_admin_reconcile_identity_conflict(p_application_id UUID, p_actor_id UUID, p_chosen_email TEXT, p_notes TEXT)` strictly restricted to `google_forms` applications with an active unresolved conflict, granted exclusively to `service_role`.

---

## 9. Required Environment Variables

Configure the following variable in Vercel Project Settings (Preview & Production) and local `.env.local`:

```env
# Shared HMAC-SHA256 Secret for Google Forms Webhook
# 32-byte hexadecimal string (64 characters)
COURSE_APPLICATION_WEBHOOK_SECRET="[32_BYTE_HEX_SECRET]"
```
*(Do not share or commit this secret to Git).*

---

## 10. Google Apps Script Configuration Guide (Form-Bound Trigger)

The ready-to-deploy script is located at:
`scripts/google-apps-script/CourseApplicationsSheetsWebhook.gs`

### Setup Instructions for Each Google Form:
1. Open the Google Form in Google Forms Editor (e.g. "Bioplastic Innovation").
2. Click the three dots (More) -> **Script editor**.
3. Paste the contents of `scripts/google-apps-script/CourseApplicationsSheetsWebhook.gs`.
4. Open **Project Settings** (gear icon) > **Script Properties** and add:
   - `WEBHOOK_URL`: `https://<domain>/api/course-applications/webhook`
   - `WEBHOOK_SECRET`: The shared HMAC secret (minimum 16 chars, 64-char hex recommended).
   - `COURSE_SLUG`: One of `bioplastic-innovation`, `ai-in-drug-discovery`, or `bioinformatics`.
5. Open **Triggers** (clock icon) > **+ Add Trigger**:
   - Function: `onFormSubmit`
   - Deployment: `Head`
   - Event Source: **`From form`** *(Do not choose "From spreadsheet")*
   - Event Type: **`On form submit`**
   - Failure notification: `Notify me immediately`
6. Verify Google Sheets Link:
   - Confirm the Form's "Responses" tab has a linked Google Sheet.
   - Google Forms natively appends responses to the Sheet while the Form-bound trigger dispatches the webhook.
7. Run `testWebhookDiagnosticPing()` in Apps Script Editor:
   - Verifies network connectivity, secret configuration, and HMAC signature verification with PathFinder.
   - Receives `DIAGNOSTIC_PONG` with **zero database writes or dummy student entity creation**.
