# Course Application Google Forms Cutover Plan & Runbook

**Document Version:** 1.0.0  
**Date:** November 15, 2026  
**Status:** Approved for Controlled Production Deployment  
**System:** PathFinder Course Application Management System  

---

## 1. Executive Summary

This runbook defines the operational procedure for transitioning course admissions from external Google Forms to the internal PathFinder Course Application Management System (`/apply/$courseSlug`).

Prior to this transition, prospective students submitted course applications through external Google Forms, requiring manual data collation, fragmented file storage in Google Drive, uncoordinated email communication, and untracked admissions state. 

The internal Course Application Management System replaces this with:
- Schema-governed relational storage in PostgreSQL (`course_applications`).
- Antivirus-scanned, magic-byte validated document storage in Supabase Storage (`course-application-documents`).
- Role-based access control (RLS) and security-invoker candidate views.
- Fully audited admissions state transitions (`rpc_admin_transition_application_status`).
- Decoupled academic evaluation and tuition payment verification (DEC-03).
- Automated transactional email notification outbox with exponential backoff (`notification_outbox`).

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
1. **Database Migration Execution:** Ensure `supabase_course_applications_v1_migration.sql` and `supabase_course_applications_storage_v1.sql` have been executed in the Supabase SQL Editor.
2. **Storage Bucket Verification:** Confirm private bucket `course-application-documents` exists with `public = false`.
3. **Admin Access Verification:** Log into `/admin/applications` and verify that the queue table renders without errors.
4. **End-to-End Test Submission:**
   - Submit a test application via `/apply/bioplastic-innovation`.
   - Verify generation of application number (`APP-YYYY-XXXXX`).
   - If guest mode, verify generation of claim token and test claim flow at `/claim-application`.
   - Verify upload of test PDF transcript.
   - Confirm application appears in `/admin/applications`.
   - Transition test application through: `submitted` -> `under_review` -> `approved` -> payment verified -> `enrolled`.

### Phase 2: Google Forms Deactivation `[MANUAL — YOU MUST DO THIS]`
For each of the 3 Google Forms:
1. Open the form in Google Forms Editor.
2. Click on the **Responses** tab.
3. Toggle off **Accepting responses**.
4. Set the "Message for respondents" to:
   > *"Thank you for your interest! Applications for PathFinder courses have moved to our new student portal. Please submit your application directly at: https://micrylis.com/courses"*
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
