# Course Application Google Forms Ingestion & Workflow Architecture

**Document Version:** 1.3.0  
**Date:** November 17, 2026  
**Status:** Implemented & Active Webhook Ingestion Architecture (Phase 1, Task 1.2 & Phase 3 Preparation)  
**System:** PathFinder Course Application Management System  

> [!NOTE]
> **Active Workflow Architecture:**  
> External Google Forms are **retained as the primary student intake point**. Rather than cutting over to an internal web form, Google Form submissions are synchronized securely into PathFinder via a Form-bound Google Apps Script and the dedicated webhook `POST /api/course-applications/webhook`.  
> For the authoritative webhook ingestion specification, refer to:  
> [`docs/COURSE_APPLICATION_GOOGLE_FORMS_WEBHOOK_SPECIFICATION.md`](COURSE_APPLICATION_GOOGLE_FORMS_WEBHOOK_SPECIFICATION.md)

---

## 1. Executive Summary & Core Business Rules

1. **Intake via 3 Google Forms:**
   - **Bioplastic Innovation & Sustainability:** `https://forms.gle/8GiUvQuT6wU8iZbU6` (slug: `bioplastic-innovation`)
   - **AI in Drug Discovery & Molecular Design:** `https://forms.gle/KZHJbuiKSpDsBqzp7` (slug: `ai-in-drug-discovery`)
   - **Advanced Bioinformatics & Genomic Data Analysis:** `https://forms.gle/ZN1HcXnv5g2Z9YXd9` (slug: `bioinformatics`)
2. **Linked Google Sheets & Storage:** Each form writes responses and payment proofs natively to its own linked Google Sheet and Google Drive.
3. **Minimal Webhook Ingestion:** The Form-bound script extracts ONLY `studentName`, `studentEmail`, `courseId`, and `responseId`. Payment proof files, Base64 buffers, Drive links, phone numbers, and transaction IDs are **never transmitted or stored in PathFinder**.
4. **Initial Lifecycle State:** Newly synchronized applications enter the system with `status = 'submitted'`, `payment_status = 'pending_verification'`, and `documents_status = 'not_required'`. In the admin UI, they render under **Pending Verification**.
5. **Manual Sheet Verification:** The administrator opens the linked Google Sheet independently, inspects candidate answers and payment proof, and verifies their legitimacy.
6. **Strict Dual-Layer Approval:**
   - Admin clicks "Approve Application (Google Sheets Verified)" and checks the explicit confirmation box.
   - The server validates `confirmedSheetVerification: true` and calls `rpc_admin_approve_google_forms_application`.
   - The database stored procedure verifies `p_confirmed_sheet_verification IS TRUE` and atomically transitions `status = 'approved'`, `payment_status = 'verified'`.
7. **Approval Never Automatically Enrolls:**
   - Approval records the admissions decision and payment verification.
   - **Zero rows are inserted into `public.enrollments_users`.**
8. **Separate Authorized Enrollment:**
   - Activating enrollment is a separate action available only for approved applications with verified payment.
   - The student must possess a genuine registered account in `public.profile` (`auth.users`), establishing immutable identity.
   - Enrollment provisions course access in `public.enrollments_users`.

---

## 2. Inventory of Existing Google Forms & Internal Route Mapping

| Course Identifier | Course Title | Legacy Google Form URL | New Internal Application Route |
| :--- | :--- | :--- | :--- |
| `bioplastic-innovation` | Bioplastic Innovation & Sustainability | `https://forms.gle/8GiUvQuT6wU8iZbU6` | `/apply/bioplastic-innovation` |
| `ai-in-drug-discovery` | AI in Drug Discovery & Molecular Design | `https://forms.gle/KZHJbuiKSpDsBqzp7` | `/apply/ai-in-drug-discovery` |
| `bioinformatics` | Advanced Bioinformatics & Genomic Data Analysis | `https://forms.gle/ZN1HcXnv5g2Z9YXd9` | `/apply/bioinformatics` |

---

## 3. Detailed Field Mapping Specification

The following mapping defines the translation between Google Forms fields and the PostgreSQL schema:

| Google Form Question | Schema Column / Relation | Data Type | Constraint / Validation |
| :--- | :--- | :--- | :--- |
| **Full Legal Name** | `course_applications.applicant_name` | `TEXT` | `NOT NULL`, trimmed |
| **Email Address** | `course_applications.applicant_email` | `TEXT` | `NOT NULL`, RFC 5322 regex validated, lowercase |
| **Phone / WhatsApp Number** | `course_applications.applicant_phone` | `TEXT` | Optional, E.164 or national format |
| **Highest Educational Qualification** | `course_applications.highest_qualification` | `TEXT` | `NOT NULL` (High School, Undergraduate, Postgraduate, Doctorate, Professional) |
| **Field of Study / Major** | `course_applications.field_of_study` | `TEXT` | `NOT NULL` |
| **College / University / Institution** | `course_applications.institution` | `TEXT` | `NOT NULL` |
| **Graduation Year** | `course_applications.graduation_year` | `INTEGER` | Range: `1980` to `2035` |
| **Statement of Purpose / Motivation** | `course_applications.statement_of_purpose` | `TEXT` | `NOT NULL`, minimum 50 characters |
| **Academic Transcript / Marksheet (Upload)** | `course_application_documents` | Relation | `document_type = 'academic_transcript'`, max 10 MB, PDF/PNG/JPEG only |
| **CV / Resume (Upload)** | `course_application_documents` | Relation | `document_type = 'cv_resume'`, max 10 MB, PDF/PNG/JPEG only |
| **Government / Student ID Proof (Upload)** | `course_application_documents` | Relation | `document_type = 'id_proof'`, max 10 MB, PDF/PNG/JPEG only (180-day retention per DEC-05) |

---

## 4. Step-by-Step Cutover Procedure

### Phase 1: Pre-Cutover Verification `[MANUAL — YOU MUST DO THIS]`
1. **Database Migration Execution & Verification:** Ensure `supabase_course_applications_v1_migration.sql`, `supabase_course_applications_v1_storage_remediation_v1.2.sql`, `supabase_course_applications_v1.1_google_forms_webhook.sql`, `supabase_course_applications_v1.2_google_forms_workflow.sql`, and `supabase_course_applications_v1.3_identity_conflict_quarantine.sql` have been executed in the Supabase SQL Editor. Execute `scripts/verification/verify_google_forms_staging.sql` and `scripts/verification/verify_google_forms_staging_v1.3.sql` to confirm all catalog checks pass (18/18 on V1.2, 12/12 on V1.3).
2. **Storage Bucket Verification:** Confirm private bucket `course-applications` exists with `public = false`.
3. **Admin Access Verification:** Log into `/admin/applications` and verify that the queue table renders without errors.
4. **End-to-End Test Submission:**
   - Submit a test application via `/apply/bioplastic-innovation`.
   - Verify generation of application number (`APP-YYYY-XXXXX`).
   - If guest mode, verify generation of claim token and test claim flow at `/claim-application`.
   - Verify upload of test PDF transcript.
   - Confirm application appears in `/admin/applications`.
   - Transition test application through: `submitted` -> `under_review` -> `approved` -> payment verified -> `enrolled`.
5. **Google Apps Script Staging Deployment & Automation Bypass:**
   - In Google Forms Script Editor, deploy `scripts/google-apps-script/CourseApplicationsSheetsWebhook.gs`.
   - Configure Script Properties: `WEBHOOK_URL`, `WEBHOOK_SECRET`, `COURSE_SLUG`, and `VERCEL_PROTECTION_BYPASS` (for protected Vercel Preview deployments).
   - Execute `testWebhookDiagnosticPing()` from the editor toolbar and verify that it returns `HTTP 200 DIAGNOSTIC_PONG` with zero database writes.
   - Install the `onFormSubmit` form-bound trigger.

### Phase 2: Google Forms Deactivation `[MANUAL — YOU MUST DO THIS]`
For each of the 3 Google Forms:
1. Open the form in Google Forms Editor.
2. Click on the **Responses** tab.
3. Toggle off **Accepting responses**.
4. Set the "Message for respondents" to:
   > *"Thank you for your interest! Applications for PathFinder courses have moved to our new student portal. Please submit your application directly at: https://project.micrylisbiotech.com/courses"*
5. Save settings.

### Phase 3: Frontend Route Redirection Cutover `[ANTIGRAVITY — AUTOMATED]`
1. In `src/lib/courses/data.ts`, update `getCourseApplyUrl(course)` to return internal route:
   ```ts
   export function getCourseApplyUrl(course?: { slug?: string; name?: string; title?: string }): string {
     const slug = course?.slug || deriveSlug(course?.title || course?.name || "");
     return `/apply/${slug}`;
   }
   ```
2. Verify all "Apply Now" buttons on `/courses` and `/projects/$slug` link to `/apply/$courseSlug`.

### Phase 4: Post-Cutover Monitoring & Live Verification
1. Monitor `/admin/applications` queue for initial incoming submissions.
2. Confirm email dispatch from `notification_outbox` for `application_received`.
3. Check Supabase Storage bucket for uploaded documents.

---

## 5. Emergency Rollback Plan

If an unexpected production defect prevents applicants from submitting via `/apply/$courseSlug`:

1. **Reopen Google Forms:**
   - Immediately navigate to the 3 Google Forms.
   - Toggle on **Accepting responses**.
2. **Revert Frontend Routing:**
   - Revert `src/lib/courses/data.ts` to return the legacy `BIOPLASTIC_APPLY_URL`, `DRUG_DISCOVERY_APPLY_URL`, and `BIOINFORMATICS_APPLY_URL`.
3. **Data Reconciliation:**
   - Any applications submitted via the internal portal remain safe in PostgreSQL and can continue to be reviewed via `/admin/applications`.
   - Any interim submissions from Google Forms can be manually transcribed or imported.
