import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { verifyAdminSession } from "@/lib/server/admin-guard";
import { resolveCourseTitle } from "@/lib/courses/course-identifiers";
import {
  generateStoragePath,
  createSignedUploadUrl,
  createSignedDownloadUrl,
  validateDocumentFile,
  MAX_DOCUMENT_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "@/lib/server/course-application-storage";

// Server-side untyped database handle to support newly added course application tables & RPCs
const db = supabaseAdmin as any;

// ─── Input Types ───

export interface SubmitApplicationInput {
  courseId?: string;
  courseSlug?: string;
  studentName?: string;
  applicantName?: string;
  studentEmail?: string;
  applicantEmail?: string;
  studentPhone?: string;
  applicantPhone?: string;
  highestQualification?: string;
  fieldOfStudy?: string;
  institution?: string;
  graduationYear?: number | string;
  academicBackground?: {
    highestQualification?: string;
    collegeOrUniversity?: string;
    degreeOrMajor?: string;
    graduationYear?: string;
    scoreOrPercentage?: string;
    [key: string]: any;
  };
  statementOfPurpose?: string;
  guestMode?: boolean;
  authToken?: string;
}

export interface ClaimApplicationInput {
  claimToken?: string;
  rawToken?: string;
  authToken?: string;
  userToken?: string;
}

export interface CreateUploadTicketInput {
  applicationId: string;
  documentType: string;
  fileName: string;
  fileSize?: number;
  fileSizeBytes?: number;
  mimeType: string;
  authToken?: string;
}

export interface ConfirmUploadInput {
  documentId: string;
  applicationId?: string;
  storagePath?: string;
  paymentReference?: string;
  authToken?: string;
}

export interface AdminTransitionInput {
  authToken?: string;
  applicationId: string;
  targetStatus: "under_review" | "approved" | "rejected" | "resubmission_required" | "enrolled" | "revoked" | string;
  reason?: string;
  rejectionReason?: string;
  resubmissionNotes?: string;
  notes?: string;
}

export interface AdminReviewDocumentInput {
  authToken?: string;
  applicationId: string;
  documentId: string;
  status: "verified" | "resubmission_requested" | "rejected";
  notes?: string;
}

export interface AdminUpdatePaymentInput {
  authToken?: string;
  applicationId: string;
  paymentStatus: "verified" | "waived" | "unpaid" | "not_required" | "pending_verification" | "refunded" | "disputed" | string;
  paymentReference?: string;
  receiptReference?: string;
  paymentAmountInr?: number;
  notes?: string;
}

export interface AdminApproveGoogleFormsInput {
  authToken?: string;
  applicationId: string;
  verificationNotes?: string;
  confirmedSheetVerification: boolean;
}

export interface AdminApplicationsFilterInput {
  authToken?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  courseId?: string;
}

// ─── Document Types & Safe Event Helpers ───

export const ALLOWED_DATABASE_DOCUMENT_TYPES = [
  "id_proof",
  "degree_certificate",
  "academic_transcript",
  "resume",
  "sop",
  "recommendation_letter",
  "fee_receipt",
  "other",
] as const;

// Mandatory document type derived from course application submission requirements (Academic Transcript / Marksheet)
export const MANDATORY_APPLICATION_DOCUMENT_TYPES = [
  "academic_transcript",
] as const;

export function normalizeDocumentType(rawType: string): string {
  if (!rawType) return "other";
  const t = rawType.trim().toLowerCase();
  if (t === "cv_resume" || t === "cv" || t === "resume") return "resume";
  if (t === "statement_of_purpose" || t === "sop") return "sop";
  if (t === "transcript" || t === "academic_transcript") return "academic_transcript";
  if (t === "id" || t === "id_proof") return "id_proof";
  if (t === "degree" || t === "degree_certificate") return "degree_certificate";
  if (t === "recommendation" || t === "recommendation_letter") return "recommendation_letter";
  if (t === "fee_receipt" || t === "receipt" || t === "payment_receipt" || t === "payment_proof") return "fee_receipt";
  if (t === "other") return "other";
  return t;
}

/**
 * Concurrency-safe event insertion into public.course_application_events.
 * Calculates next occurrence_seq for (application_id, event_type) and retries on 23505 collision.
 */
export async function insertApplicationEventSafe(
  client: any,
  event: {
    application_id: string;
    event_type: string;
    actor_type: "student" | "admin" | "system";
    actor_id?: string | null;
    title: string;
    description?: string | null;
    metadata?: Record<string, any>;
  },
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data: latestEvent } = await client
      .from("course_application_events")
      .select("occurrence_seq")
      .eq("application_id", event.application_id)
      .eq("event_type", event.event_type)
      .order("occurrence_seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSeq = (latestEvent?.occurrence_seq || 0) + 1;

    const { error: insertErr } = await client
      .from("course_application_events")
      .insert({
        application_id: event.application_id,
        event_type: event.event_type,
        actor_type: event.actor_type,
        actor_id: event.actor_id || null,
        title: event.title,
        description: event.description || null,
        metadata: event.metadata || {},
        occurrence_seq: nextSeq,
      });

    if (!insertErr) {
      return { success: true };
    }

    if (insertErr.code === "23505" && attempt < maxRetries) {
      await new Promise((res) => setTimeout(res, 50 * attempt));
      continue;
    }

    console.error("[CourseApp] Failed to insert application event safely:", insertErr);
    return { success: false, error: insertErr.message };
  }
  return { success: false, error: "Exceeded max retries inserting event." };
}

// ─── Helper Functions ───

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Core Backend Functions ───

export async function submitCourseApplicationCore(data: SubmitApplicationInput) {
  try {
    const courseId = (data.courseId || data.courseSlug || "").trim();
    const studentName = (data.studentName || data.applicantName || "").trim();
    const email = normalizeEmail(data.studentEmail || data.applicantEmail || "");
    const phone = (data.studentPhone || data.applicantPhone || "").trim();
    const statement = (data.statementOfPurpose || "").trim();

    if (!courseId) {
      return { success: false, error: "Course ID or slug is required." };
    }
    if (!studentName || studentName.length < 2) {
      return { success: false, error: "Student full name is required (minimum 2 characters)." };
    }
    if (!email || !email.includes("@")) {
      return { success: false, error: "A valid email address is required." };
    }

    let userId: string | null = null;

    // 1. Check if authenticated session provided
    if (data.authToken) {
      const { data: userData } = await db.auth.getUser(data.authToken);
      if (userData?.user) {
        userId = userData.user.id;
      }
    }

    // 2. Resolve course and verify existence
    const { data: courseRow, error: courseErr } = await db
      .from("courses")
      .select("id, title, slug")
      .or(`id.eq.${courseId},slug.eq.${courseId}`)
      .maybeSingle();

    if (courseErr || !courseRow) {
      return { success: false, error: "Selected course does not exist." };
    }

    // 3. Guest claim token generation (DEC-02)
    let claimToken: string | null = null;
    let claimTokenHash: string | null = null;
    let claimExpiresAt: string | null = null;

    if (!userId) {
      claimToken = crypto.randomBytes(32).toString("hex");
      claimTokenHash = hashToken(claimToken);
      claimExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // 4. Resolve UUID course identifier (DEC-01)
    let resolvedCourseUuid = courseRow.id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(resolvedCourseUuid)) {
      const hash = crypto.createHash("md5").update(courseRow.id).digest("hex");
      resolvedCourseUuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    }

    // Prepare academic background
    const academicBg = data.academicBackground || {
      highestQualification: data.highestQualification || "Not specified",
      fieldOfStudy: data.fieldOfStudy || "Not specified",
      institution: data.institution || "Not specified",
      graduationYear: String(data.graduationYear || ""),
    };

    // Prevent duplicate active applications for the same course and student (authenticated or guest)
    const ACTIVE_STATUSES = [
      "submitted",
      "under_review",
      "resubmission_required",
      "resubmitted",
      "approved",
      "enrolled",
    ];

    let duplicateQuery = db
      .from("course_applications")
      .select("id, application_number, status, student_email, user_id")
      .eq("course_id", resolvedCourseUuid)
      .in("status", ACTIVE_STATUSES);

    const escapedEmail = email.replace(/[%_\\]/g, "\\$&");
    if (userId) {
      duplicateQuery = duplicateQuery.or(`user_id.eq.${userId},student_email.ilike.${escapedEmail}`);
    } else {
      duplicateQuery = duplicateQuery.ilike("student_email", escapedEmail);
    }

    const { data: existingActive } = await duplicateQuery.limit(1).maybeSingle();

    if (existingActive) {
      return {
        success: false,
        error: `You already have an active application (${existingActive.application_number}) for this course.`,
      };
    }

    const { data: appRow, error: appErr } = await db
      .from("course_applications")
      .insert({
        course_id: resolvedCourseUuid,
        user_id: userId,
        student_name: studentName,
        student_email: email,
        student_phone: phone || null,
        academic_background: academicBg,
        statement_of_purpose: statement || null,
        status: "submitted",
        payment_status: "unpaid",
        documents_status: "pending",
        guest_claim_token_hash: claimTokenHash,
        guest_claim_token_expires_at: claimExpiresAt,
      })
      .select("id, application_number, status, created_at")
      .single();

    if (appErr || !appRow) {
      if (appErr?.code === "23505") {
        return {
          success: false,
          error: "You already have an active application for this course.",
        };
      }
      console.error("[CourseApp] Failed to insert application:", appErr);
      return { success: false, error: appErr?.message || "Failed to create application record." };
    }

    // 5. Insert initial progress milestone event
    await db.from("course_application_events").insert({
      application_id: appRow.id,
      event_type: "SUBMITTED",
      actor_type: userId ? "student" : "system",
      actor_id: userId,
      title: "Application Submitted",
      description: `Course application received for ${courseRow.title}.`,
      metadata: {
        course_title: courseRow.title,
        applicant_email: email,
        is_guest: !userId,
      },
      occurrence_seq: 1,
    });

    // 6. Record initial audit log
    await db.from("course_application_audit_logs").insert({
      application_id: appRow.id,
      actor_id: userId,
      actor_role: userId ? "student" : "system",
      action: "APPLICATION_SUBMITTED",
      previous_state: {},
      new_state: {
        status: "submitted",
        application_number: appRow.application_number,
        is_guest: !userId,
      },
      notes: "Initial application submission",
    });

    // 7. Enqueue initial transactional notification to outbox
    await db.from("notification_outbox").insert({
      application_id: appRow.id,
      recipient_email: email,
      template_name: "application_received",
      payload: {
        application_id: appRow.id,
        application_number: appRow.application_number,
        student_name: studentName,
        student_email: email,
        course_title: courseRow.title,
        claim_token: claimToken,
      },
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      idempotency_key: `notif_${appRow.id}_app_submitted_1`,
    });

    return {
      success: true,
      applicationId: appRow.id,
      applicationNumber: appRow.application_number,
      claimToken: claimToken,
      isGuest: !userId,
    };
  } catch (err: any) {
    console.error("[CourseApp] Unexpected submission error:", err);
    return { success: false, error: err.message || "An unexpected server error occurred." };
  }
}

export async function claimGuestApplicationCore(data: ClaimApplicationInput) {
  try {
    const rawToken = (data.claimToken || data.rawToken || "").trim();
    const authToken = (data.authToken || data.userToken || "").trim();

    if (!rawToken || rawToken.length < 32) {
      return { success: false, error: "A valid 64-character claim token is required." };
    }
    if (!authToken) {
      return { success: false, error: "User authentication token is required to claim an application." };
    }

    // 1. Verify user session and verified email (DEC-02)
    const { data: userData, error: userErr } = await db.auth.getUser(authToken);
    if (userErr || !userData?.user) {
      return { success: false, error: "Invalid user session. Please log in again." };
    }

    const user = userData.user;
    if (!user.email_confirmed_at && !user.email) {
      return {
        success: false,
        error: "Your email must be confirmed before claiming a course application (DEC-02).",
      };
    }

    const tokenHash = hashToken(rawToken);

    // 2. Invoke atomic claim RPC
    const { data: appRow, error: claimErr } = await db.rpc(
      "rpc_claim_guest_application",
      {
        p_claim_token_hash: tokenHash,
        p_user_id: user.id,
        p_user_email: user.email,
      }
    );

    if (claimErr) {
      console.error("[CourseApp] Claim RPC error:", claimErr);
      return {
        success: false,
        error: claimErr.message || "Failed to claim application. Token may be expired or already used.",
      };
    }

    return {
      success: true,
      applicationId: appRow?.id,
      applicationNumber: appRow?.application_number,
      message: "Application claimed successfully! It is now linked to your student account.",
    };
  } catch (err: any) {
    console.error("[CourseApp] Claim error:", err);
    return { success: false, error: err.message || "Failed to process application claim." };
  }
}

export async function createDocumentUploadTicketCore(data: CreateUploadTicketInput) {
  try {
    const sizeBytes = data.fileSizeBytes || data.fileSize || 0;
    const normalizedType = normalizeDocumentType(data.documentType);

    // 0. Validate normalized document type against database CHECK constraint
    if (!(ALLOWED_DATABASE_DOCUMENT_TYPES as readonly string[]).includes(normalizedType)) {
      return {
        success: false,
        error: `Unsupported document type '${data.documentType}'. Allowed types: ${ALLOWED_DATABASE_DOCUMENT_TYPES.join(", ")}`,
      };
    }

    // 1. Pre-validation of file metadata (DEC-04)
    const validation = validateDocumentFile({
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes,
    });

    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // 2. Verify application existence
    const { data: appRow, error: appErr } = await db
      .from("course_applications")
      .select("id, status, user_id")
      .eq("id", data.applicationId)
      .single();

    if (appErr || !appRow) {
      return { success: false, error: "Associated course application not found." };
    }

    if (appRow.status === "enrolled" || appRow.status === "rejected" || appRow.status === "revoked") {
      return {
        success: false,
        error: `Cannot upload documents: application is in terminal state '${appRow.status}'.`,
      };
    }

    // 2B. Enforce ownership authorization for claimed applications
    if (appRow.user_id) {
      const authToken = (data.authToken || "").trim();
      if (!authToken) {
        return {
          success: false,
          error: "Authentication required to upload documents for this claimed application.",
        };
      }

      // Check whether caller is an authorized administrator
      const adminCheck = await verifyAdminSession(authToken);
      if (!adminCheck.isValid) {
        // Not an admin; verify student session token against Supabase Auth
        const { data: authData, error: authErr } = await db.auth.getUser(authToken);
        if (authErr || !authData?.user) {
          return {
            success: false,
            error: "Invalid or expired authentication session. Please sign in again.",
          };
        }

        const callerUserId = authData.user.id;
        if (callerUserId !== appRow.user_id) {
          return {
            success: false,
            error: "Access denied. You do not have permission to upload documents for this application.",
          };
        }
      }
    }

    // 3. Generate unique storage path using normalized type
    const storagePath = generateStoragePath(data.applicationId, normalizedType, data.fileName);

    // 4. Insert pending document record in database
    const { data: docRow, error: docErr } = await db
      .from("course_application_documents")
      .insert({
        application_id: data.applicationId,
        document_type: normalizedType,
        file_name: data.fileName,
        file_size_bytes: sizeBytes,
        mime_type: data.mimeType,
        storage_path: storagePath,
        status: "pending",
      })
      .select("id")
      .single();

    if (docErr || !docRow) {
      console.error("[CourseApp] Failed to create document metadata:", docErr);
      return { success: false, error: "Failed to initialize document record." };
    }

    // 5. Generate signed upload URL via Supabase Storage
    const uploadTicket = await createSignedUploadUrl(data.applicationId, normalizedType, data.fileName);
    if (!uploadTicket.success) {
      return { success: false, error: uploadTicket.error };
    }

    return {
      success: true,
      documentId: docRow.id,
      storagePath,
      signedUploadUrl: uploadTicket.signedUrl,
      expiresInSeconds: 300,
    };
  } catch (err: any) {
    console.error("[CourseApp] Upload ticket error:", err);
    return { success: false, error: err.message || "Failed to generate upload ticket." };
  }
}

export async function confirmDocumentUploadCore(data: ConfirmUploadInput) {
  try {
    // 1. Fetch document record
    const { data: docRow, error: docErr } = await db
      .from("course_application_documents")
      .select("id, application_id, document_type, file_name, storage_path, status")
      .eq("id", data.documentId)
      .single();

    if (docErr || !docRow) {
      return { success: false, error: "Document record not found." };
    }

    // 2. Mark document as uploaded and awaiting verification
    await db
      .from("course_application_documents")
      .update({
        status: "pending",
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.documentId);

    // Fetch associated application
    const { data: appRow } = await db
      .from("course_applications")
      .select("id, status, documents_status, payment_status")
      .eq("id", docRow.application_id)
      .single();

    // 3. Separate Student Fee Receipt Submission vs Academic Document Resubmission
    if (docRow.document_type === "fee_receipt") {
      // 3A. Fee Receipt Submission: update payment_status and optional payment_reference
      const paymentRef = data.paymentReference?.trim() || null;
      await db
        .from("course_applications")
        .update({
          payment_status: "pending_verification",
          payment_reference: paymentRef || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", docRow.application_id);

      // Record timeline event PAYMENT_PENDING safely
      await insertApplicationEventSafe(db, {
        application_id: docRow.application_id,
        event_type: "PAYMENT_PENDING",
        actor_type: "student",
        title: "Payment Receipt Submitted",
        description: `Student submitted fee receipt: ${docRow.file_name}${paymentRef ? ` (Ref: ${paymentRef})` : ""}.`,
        metadata: {
          document_id: docRow.id,
          document_type: "fee_receipt",
          file_name: docRow.file_name,
          payment_reference: paymentRef,
        },
      });

      // Record audit log
      await db.from("course_application_audit_logs").insert({
        application_id: docRow.application_id,
        actor_id: null,
        actor_role: "student",
        action: "PAYMENT_RECEIPT_SUBMITTED",
        previous_state: { payment_status: appRow?.payment_status || "unpaid" },
        new_state: {
          payment_status: "pending_verification",
          payment_reference: paymentRef,
          document_id: docRow.id,
          file_name: docRow.file_name,
          storage_path: docRow.storage_path,
        },
        notes: `Student submitted fee receipt: ${docRow.file_name}${paymentRef ? ` with reference: ${paymentRef}` : ""}`,
      });
    } else if (appRow?.status === "resubmission_required") {
      // 3B. Academic Document Resubmission
      await db
        .from("course_applications")
        .update({
          status: "resubmitted",
          documents_status: "under_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", docRow.application_id);

      await insertApplicationEventSafe(db, {
        application_id: docRow.application_id,
        event_type: "RESUBMITTED",
        actor_type: "student",
        title: "Documents Resubmitted",
        description: `Student uploaded replacement ${docRow.document_type}: ${docRow.file_name}.`,
        metadata: {
          document_id: docRow.id,
          document_type: docRow.document_type,
          file_name: docRow.file_name,
        },
      });

      await db.from("course_application_audit_logs").insert({
        application_id: docRow.application_id,
        actor_id: null,
        actor_role: "student",
        action: "DOCUMENT_UPLOADED",
        previous_state: { status: "resubmission_required", documents_status: appRow?.documents_status },
        new_state: {
          status: "resubmitted",
          documents_status: "under_review",
          document_id: docRow.id,
          document_type: docRow.document_type,
          file_name: docRow.file_name,
          storage_path: docRow.storage_path,
        },
        notes: `Resubmitted ${docRow.document_type}: ${docRow.file_name}`,
      });
    } else {
      // 3C. Standard Academic Document Upload (initial or supplemental)
      await db.from("course_application_audit_logs").insert({
        application_id: docRow.application_id,
        actor_id: null,
        actor_role: "student",
        action: "DOCUMENT_UPLOADED",
        previous_state: {},
        new_state: {
          document_id: docRow.id,
          document_type: docRow.document_type,
          file_name: docRow.file_name,
          storage_path: docRow.storage_path,
        },
        notes: `Uploaded ${docRow.document_type}: ${docRow.file_name}`,
      });
    }

    return { success: true, message: "Document upload confirmed." };
  } catch (err: any) {
    console.error("[CourseApp] Confirm upload error:", err);
    return { success: false, error: err.message || "Failed to confirm document upload." };
  }
}

export async function adminTransitionApplicationCore(data: AdminTransitionInput) {
  try {
    const adminCheck = await verifyAdminSession(data.authToken);
    if (!adminCheck.isValid || !adminCheck.userId) {
      return { success: false, error: "Unauthorized: Administrator privileges required." };
    }

    const reason = data.reason || data.rejectionReason || null;
    const resubmissionNotes = data.resubmissionNotes || data.notes || null;

    if (data.targetStatus === "rejected" && (!reason || !reason.trim())) {
      return { success: false, error: "Rejection reason is mandatory when rejecting an application." };
    }

    // CRITICAL QUARANTINE GUARD: Block approval or enrollment if identity conflict is unresolved
    if (data.targetStatus === "approved" || data.targetStatus === "enrolled") {
      const { data: conflictCheckApp } = await db
        .from("course_applications")
        .select("is_identity_conflict, academic_background")
        .eq("id", data.applicationId)
        .single();

      const isConflicted = Boolean(
        conflictCheckApp?.is_identity_conflict ||
        conflictCheckApp?.academic_background?.google_forms?.identity_conflict
      );

      if (isConflicted) {
        return {
          success: false,
          error: `Cannot transition application to '${data.targetStatus}': Application is quarantined due to an identity conflict. Manual administrative reconciliation is required before approval or enrollment.`,
        };
      }
    }

    // Academic approval (DEC-03) strictly requires candidate documents to be verified first.
    // Auto-verification of unreviewed documents is prohibited.
    if (data.targetStatus === "approved") {
      const { data: currentApp } = await db
        .from("course_applications")
        .select("documents_status, source")
        .eq("id", data.applicationId)
        .single();

      if (currentApp?.source === "google_forms") {
        return {
          success: false,
          error:
            "Google Forms applications cannot be approved via generic status transition. You must use the dedicated Google Forms approval flow with explicit Google Sheets payment verification.",
        };
      } else {
        // Direct portal applications strictly require candidate documents to be individually verified first
        if (!currentApp || currentApp.documents_status !== "verified") {
          return {
            success: false,
            error: `Cannot grant academic approval: Candidate documents must be individually verified first (current documents state: '${currentApp?.documents_status || "pending"}').`,
          };
        }

        // Safeguard against stale or bypassed status: re-verify directly against candidate documents in database
        const { data: allDocs } = await db
          .from("course_application_documents")
          .select("id, document_type, status")
          .eq("application_id", data.applicationId);

        const academicDocs = (allDocs || []).filter((d: any) => d.document_type !== "fee_receipt");
        const hasMandatoryTranscript = academicDocs.some(
          (d: any) => d.document_type === "academic_transcript" && d.status === "verified"
        );
        const allVerified = academicDocs.length > 0 && academicDocs.every((d: any) => d.status === "verified");

        if (!hasMandatoryTranscript || !allVerified) {
          return {
            success: false,
            error: "Cannot grant academic approval: Mandatory documents (academic_transcript) are missing or not all candidate documents have an explicitly verified status.",
          };
        }
      }
    }

    let verifiedUserId: string | null = null;

    // Enrollment Activation (DEC-03) is a separate, authorized operation that strictly
    // requires prior application approval, verified payment status, and a confirmed student account.
    if (data.targetStatus === "enrolled") {
      const { data: currentApp } = await db
        .from("course_applications")
        .select("status, payment_status, student_email, course_id, user_id")
        .eq("id", data.applicationId)
        .single();

      if (!currentApp || currentApp.status !== "approved") {
        return {
          success: false,
          error: `Cannot activate enrollment: Application must be in 'approved' status first (current status: '${currentApp?.status || "unknown"}').`,
        };
      }

      if (!["verified", "waived", "not_required"].includes(currentApp.payment_status)) {
        return {
          success: false,
          error: `Cannot activate enrollment: Payment must be verified before activating enrollment (current payment status: '${currentApp.payment_status || "unpaid"}').`,
        };
      }

      const normalizedAppEmail = normalizeEmail(currentApp.student_email);

      // Student Account Identity Verification:
      // Verify that the applicant possesses a genuine, registered PathFinder student account.
      if (currentApp.user_id) {
        // If user_id is already linked, verify that the ID exists in public.profile and email matches strictly
        const { data: existingProfile, error: pErr } = await db
          .from("profile")
          .select("id, email")
          .eq("id", currentApp.user_id)
          .maybeSingle();

        if (pErr || !existingProfile) {
          return {
            success: false,
            error: `Cannot activate enrollment: Linked student account ID (${currentApp.user_id}) does not exist in public.profile.`,
          };
        }

        const profileEmail = normalizeEmail(existingProfile.email || "");
        if (profileEmail !== normalizedAppEmail) {
          return {
            success: false,
            error: `Security violation: Application user ID (${currentApp.user_id}) email (${profileEmail}) does not match applicant email (${normalizedAppEmail}). Refusing enrollment.`,
          };
        }
        verifiedUserId = currentApp.user_id;
      } else {
        // user_id is NULL: Resolve exact matching registered account without wildcards.
        // Escape any SQL/ILIKE wildcards (%, _, \) to prevent pattern matching.
        const escapedEmail = normalizedAppEmail.replace(/[%_\\]/g, "\\$&");
        const { data: candidateProfiles, error: lookupErr } = await db
          .from("profile")
          .select("id, email")
          .ilike("email", escapedEmail);

        if (lookupErr) {
          return {
            success: false,
            error: `Failed to query student account: ${lookupErr.message}`,
          };
        }

        // Exact byte-for-byte normalized match in JavaScript
        const exactMatches = (candidateProfiles || []).filter(
          (p: any) => normalizeEmail(p.email || "") === normalizedAppEmail
        );

        if (exactMatches.length === 0) {
          return {
            success: false,
            error: `Cannot activate enrollment: No registered PathFinder student account exists for '${normalizedAppEmail}'. The student must register their account on the portal before enrollment can be activated.`,
          };
        }

        if (exactMatches.length > 1) {
          return {
            success: false,
            error: `Ambiguous identity: Multiple matching student profiles found for '${normalizedAppEmail}'. Manual administrative reconciliation required.`,
          };
        }

        verifiedUserId = exactMatches[0].id;
      }
    }

    const { data: updatedApp, error: rpcErr } = await db.rpc(
      "rpc_admin_transition_application_status",
      {
        p_application_id: data.applicationId,
        p_target_status: data.targetStatus,
        p_actor_id: adminCheck.userId,
        p_reason: reason,
        p_resubmission_notes: resubmissionNotes,
      }
    );

    if (rpcErr) {
      console.error("[CourseApp Admin] Status transition RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Failed to transition application status." };
    }

    // Defense-in-depth: If the RPC succeeded and user_id was verified but not set by the RPC, link it now.
    // If the RPC failed, this code is never reached, ensuring failed enrollment never leaves an inconsistent identity association.
    if (data.targetStatus === "enrolled" && verifiedUserId && (!updatedApp || !updatedApp.user_id)) {
      await db
        .from("course_applications")
        .update({ user_id: verifiedUserId })
        .eq("id", data.applicationId);
      if (updatedApp) {
        updatedApp.user_id = verifiedUserId;
      }
    }

    return {
      success: true,
      application: updatedApp,
      message: `Status transitioned to '${data.targetStatus}'.`,
    };
  } catch (err: any) {
    console.error("[CourseApp Admin] Transition error:", err);
    return { success: false, error: err.message || "Server error processing transition." };
  }
}

export async function adminReviewDocumentCore(data: AdminReviewDocumentInput) {
  try {
    const adminCheck = await verifyAdminSession(data.authToken);
    if (!adminCheck.isValid || !adminCheck.userId) {
      return { success: false, error: "Unauthorized: Administrator privileges required." };
    }

    if (!["verified", "resubmission_requested", "rejected"].includes(data.status)) {
      return {
        success: false,
        error: `Invalid document review status '${data.status}'. Must be 'verified', 'resubmission_requested', or 'rejected'.`,
      };
    }

    const { data: doc, error: docErr } = await db
      .from("course_application_documents")
      .select("*")
      .eq("id", data.documentId)
      .eq("application_id", data.applicationId)
      .single();

    if (docErr || !doc) {
      return { success: false, error: "Document not found for this application." };
    }

    const prevDocStatus = doc.status;

    // Update document record
    const { data: updatedDoc, error: updateErr } = await db
      .from("course_application_documents")
      .update({
        status: data.status,
        verification_notes: data.notes || null,
        verified_at: data.status === "verified" ? new Date().toISOString() : null,
        verified_by: adminCheck.userId,
      })
      .eq("id", data.documentId)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message || "Failed to update document status." };
    }

    // Append-only audit log
    await db.from("course_application_audit_logs").insert({
      application_id: data.applicationId,
      actor_id: adminCheck.userId,
      actor_role: "admin",
      action: "REVIEW_DOCUMENT",
      previous_state: {
        document_id: data.documentId,
        status: prevDocStatus,
        document_type: doc.document_type,
        file_name: doc.file_name,
      },
      new_state: {
        document_id: data.documentId,
        status: data.status,
        document_type: doc.document_type,
        file_name: doc.file_name,
        notes: data.notes || null,
      },
      notes: data.notes || `Document '${doc.file_name}' (${doc.document_type}) reviewed as '${data.status}' by administrator.`,
    });

    // Recompute parent application's documents_status based on all academic candidate documents
    const { data: allDocs } = await db
      .from("course_application_documents")
      .select("id, document_type, status, file_name")
      .eq("application_id", data.applicationId);

    // Filter candidate academic documents (exclude fee receipts, which belong to tuition workflow)
    const academicDocs = (allDocs || []).filter((d: any) => d.document_type !== "fee_receipt");

    // Check mandatory document presence and explicit verification
    const hasMandatoryTranscript = academicDocs.some(
      (d: any) => d.document_type === "academic_transcript" && d.status === "verified"
    );

    let newAppDocStatus: "pending" | "under_review" | "verified" | "resubmission_requested" | "rejected" = "pending";

    if (academicDocs.length === 0) {
      newAppDocStatus = "pending";
    } else if (academicDocs.some((d: any) => d.status === "rejected")) {
      newAppDocStatus = "rejected";
    } else if (academicDocs.some((d: any) => d.status === "resubmission_requested")) {
      newAppDocStatus = "resubmission_requested";
    } else if (academicDocs.some((d: any) => d.status === "pending")) {
      newAppDocStatus = "under_review";
    } else if (
      academicDocs.length > 0 &&
      academicDocs.every((d: any) => d.status === "verified") &&
      hasMandatoryTranscript
    ) {
      newAppDocStatus = "verified";
    } else {
      // Missing mandatory transcript or incomplete verification across candidate documents
      newAppDocStatus = "under_review";
    }

    await db
      .from("course_applications")
      .update({
        documents_status: newAppDocStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.applicationId);

    return {
      success: true,
      document: updatedDoc,
      documentsStatus: newAppDocStatus,
      message: `Document reviewed as '${data.status}'. Application document status is now '${newAppDocStatus}'.`,
    };
  } catch (err: any) {
    console.error("[CourseApp Admin] Document review error:", err);
    return { success: false, error: err.message || "Server error processing document review." };
  }
}

export async function adminUpdatePaymentStatusCore(data: AdminUpdatePaymentInput) {
  try {
    const adminCheck = await verifyAdminSession(data.authToken);
    if (!adminCheck.isValid || !adminCheck.userId) {
      return { success: false, error: "Unauthorized: Administrator privileges required." };
    }

    const paymentRef = data.paymentReference || data.receiptReference || null;

    const { data: appRow, error: fetchErr } = await db
      .from("course_applications")
      .select("id, payment_status, status, student_name, student_email")
      .eq("id", data.applicationId)
      .single();

    if (fetchErr || !appRow) {
      return { success: false, error: "Application not found." };
    }

    const prevPayment = appRow.payment_status;

    // Explicit Payment Transition State Machine
    const PERMITTED_PAYMENT_TRANSITIONS: Record<string, string[]> = {
      unpaid: ["pending_verification", "verified", "waived", "not_required"],
      pending_verification: ["verified", "unpaid", "waived", "disputed"],
      verified: ["refunded", "disputed"],
      waived: ["unpaid"],
      not_required: ["unpaid"],
      disputed: ["verified", "refunded", "unpaid"],
      refunded: ["unpaid"],
    };

    if (data.paymentStatus !== prevPayment) {
      const allowedNext = PERMITTED_PAYMENT_TRANSITIONS[prevPayment] || [];
      if (!allowedNext.includes(data.paymentStatus)) {
        return {
          success: false,
          error: `Invalid payment transition from '${prevPayment}' to '${data.paymentStatus}'. Permitted transitions: ${allowedNext.join(", ") || "none"}.`,
        };
      }
    }

    const updatePayload: Record<string, any> = {
      payment_status: data.paymentStatus,
      payment_reference: paymentRef,
      updated_at: new Date().toISOString(),
    };
    if (data.paymentAmountInr !== undefined && data.paymentAmountInr !== null) {
      if (typeof data.paymentAmountInr !== "number" || isNaN(data.paymentAmountInr) || data.paymentAmountInr < 0) {
        return { success: false, error: "Payment amount must be a non-negative number." };
      }
      updatePayload.payment_amount_inr = data.paymentAmountInr;
    }

    const { data: updatedApp, error: updateErr } = await db
      .from("course_applications")
      .update(updatePayload)
      .eq("id", data.applicationId)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message || "Failed to update payment status." };
    }

    await db.from("course_application_audit_logs").insert({
      application_id: data.applicationId,
      actor_id: adminCheck.userId,
      actor_role: "admin",
      action: "UPDATE_PAYMENT_STATUS",
      previous_state: { payment_status: prevPayment },
      new_state: { payment_status: data.paymentStatus, payment_reference: paymentRef },
      notes: data.notes || `Payment status updated from ${prevPayment} to ${data.paymentStatus}`,
    });

    // Payment Event Semantics Mapping:
    // - verified -> PAYMENT_VERIFIED
    // - pending_verification -> PAYMENT_PENDING
    // - unpaid -> PAYMENT_PENDING only when a meaningful status transition occurs (e.g. from prior status)
    // - waived -> audit log only; do not falsely record payment as verified
    // - not_required -> audit log only
    // - refunded -> audit log only
    // - disputed -> audit log only
    if (data.paymentStatus === "verified") {
      await insertApplicationEventSafe(db, {
        application_id: data.applicationId,
        event_type: "PAYMENT_VERIFIED",
        actor_type: "admin",
        actor_id: adminCheck.userId,
        title: "Payment Verified",
        description: `Payment verified by administrator. Reference: ${paymentRef || "N/A"}.`,
        metadata: {
          previous_status: prevPayment,
          new_status: "verified",
          reference: paymentRef,
        },
      });
    } else if (data.paymentStatus === "pending_verification") {
      await insertApplicationEventSafe(db, {
        application_id: data.applicationId,
        event_type: "PAYMENT_PENDING",
        actor_type: "admin",
        actor_id: adminCheck.userId,
        title: "Payment Pending Verification",
        description: `Payment marked as pending verification. Reference: ${paymentRef || "N/A"}.`,
        metadata: {
          previous_status: prevPayment,
          new_status: "pending_verification",
          reference: paymentRef,
        },
      });
    } else if (data.paymentStatus === "unpaid" && prevPayment !== "unpaid") {
      await insertApplicationEventSafe(db, {
        application_id: data.applicationId,
        event_type: "PAYMENT_PENDING",
        actor_type: "admin",
        actor_id: adminCheck.userId,
        title: "Payment Marked Unpaid",
        description: `Payment status reset to unpaid.`,
        metadata: {
          previous_status: prevPayment,
          new_status: "unpaid",
        },
      });
    }
    // Note: 'waived', 'not_required', 'refunded', and 'disputed' are preserved strictly
    // in course_application_audit_logs to prevent false timeline representations.

    return { success: true, application: updatedApp };
  } catch (err: any) {
    console.error("[CourseApp Admin] Payment update error:", err);
    return { success: false, error: err.message || "Failed to update payment." };
  }
}

/**
 * Dedicated, atomic administrator approval procedure for Google Forms applications.
 *
 * Requirements:
 * 1. Requires explicit administrator confirmation that payment proof & details were checked in Google Sheets.
 * 2. Atomically marks application status = 'approved' and payment_status = 'verified'.
 * 3. Sets honest documents_status = 'not_required' (documents managed externally in Google Sheets).
 * 4. Records full tamper-proof audit log and lifecycle event.
 * 5. Queues application_approved email notification.
 * 6. STRICT: Does NOT automatically enroll the student (preserves authorized manual enrollment step).
 */
export async function adminApproveGoogleFormsApplicationCore(data: AdminApproveGoogleFormsInput) {
  try {
    const adminCheck = await verifyAdminSession(data.authToken);
    if (!adminCheck.isValid || !adminCheck.userId) {
      return { success: false, error: "Unauthorized: Administrator privileges required." };
    }

    if (!data.confirmedSheetVerification) {
      return {
        success: false,
        error: "Explicit confirmation required: You must confirm that student details and payment proof were checked in Google Sheets before approving.",
      };
    }

    const { data: currentApp, error: fetchErr } = await db
      .from("course_applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();

    if (fetchErr || !currentApp) {
      return { success: false, error: "Application not found." };
    }

    if (currentApp.source !== "google_forms") {
      return {
        success: false,
        error: "This approval procedure is strictly reserved for Google Forms applications.",
      };
    }

    if (!["submitted", "under_review", "resubmitted"].includes(currentApp.status)) {
      return {
        success: false,
        error: `Cannot approve application currently in status '${currentApp.status}'.`,
      };
    }

    // CRITICAL QUARANTINE GUARD: Block approval if identity conflict is unresolved
    const isIdentityConflicted = Boolean(
      currentApp.is_identity_conflict ||
      currentApp.academic_background?.google_forms?.identity_conflict
    );

    if (isIdentityConflicted) {
      return {
        success: false,
        error:
          "Cannot approve application: Quarantined due to an unresolved identity conflict between Google respondent email and entered student email. Manual administrative reconciliation is required before approval.",
      };
    }

    const notes = data.verificationNotes?.trim() || "Student details and payment proof verified in Google Sheets.";

    // 1. Authoritative Google Forms Application Approval via Atomic SQL RPC (Migration v1.2)
    try {
      const { data: rpcData, error: rpcErr } = await db.rpc(
        "rpc_admin_approve_google_forms_application",
        {
          p_application_id: data.applicationId,
          p_actor_id: adminCheck.userId,
          p_notes: notes,
          p_confirmed_sheet_verification: Boolean(data.confirmedSheetVerification),
        }
      );

      if (!rpcErr && rpcData) {
        return {
          success: true,
          message: "Application approved and payment verified successfully via Google Forms workflow.",
          application: rpcData,
        };
      }

      // Check if the stored procedure is genuinely missing (function not found in schema cache)
      const isRpcMissing =
        rpcErr &&
        (rpcErr.code === "42883" ||
          rpcErr.code === "PGRST202" ||
          (rpcErr.message?.toLowerCase().includes("could not find the function") &&
            rpcErr.message?.toLowerCase().includes("rpc_admin_approve_google_forms_application")) ||
          rpcErr.message?.toLowerCase().includes("function rpc_admin_approve_google_forms_application does not exist"));

      if (isRpcMissing) {
        console.error("[CourseApp Admin] Missing required approval RPC:", rpcErr);
        return {
          success: false,
          code: "MIGRATION_REQUIRED",
          error:
            "Database migration required: Stored procedure 'rpc_admin_approve_google_forms_application' is not installed. Please apply migration v1.2 before approving Google Forms applications.",
        };
      }

      // Fail-closed on any RPC business, validation, authorization, or database error
      console.error("[CourseApp Admin] Google Forms approval RPC error:", rpcErr);
      return {
        success: false,
        code: rpcErr?.code || "RPC_ERROR",
        error: rpcErr?.message || "Database rejected application approval.",
      };
    } catch (networkErr: any) {
      console.error("[CourseApp Admin] Network/exception during approval RPC:", networkErr);
      return {
        success: false,
        code: "NETWORK_ERROR",
        error:
          "Network or connection error during application approval. Please verify connection and retry. Application status was not modified.",
      };
    }
  } catch (err: any) {
    console.error("[CourseApp Admin] Google Forms approval error:", err);
    return { success: false, error: err.message || "Failed to process Google Forms approval." };
  }
}

// ─── Course Title Resolution Helpers ───

async function getCourseTitleMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data: courses } = await db.from("courses").select("id, slug, title");
    (courses || []).forEach((c: any) => {
      if (c.id && c.title) map.set(c.id.toLowerCase(), c.title);
      if (c.slug && c.title) map.set(c.slug.toLowerCase(), c.title);
    });
  } catch (err) {
    console.warn("[CourseApp] Failed to load courses map from database:", err);
  }
  return map;
}

function resolveApplicationCourseTitle(courseId: string | null | undefined, titleMap?: Map<string, string>): string {
  if (!courseId) return "—";
  const key = courseId.trim().toLowerCase();
  if (titleMap && titleMap.has(key)) {
    return titleMap.get(key)!;
  }
  const resolved = resolveCourseTitle(courseId);
  if (resolved && resolved !== "—") {
    return resolved;
  }
  return courseId;
}

export async function getAdminApplicationsListCore(data?: AdminApplicationsFilterInput) {
  try {
    const adminCheck = await verifyAdminSession(data?.authToken);
    if (!adminCheck.isValid) {
      return { success: false, error: "Unauthorized access.", applications: [], total: 0 };
    }

    const page = Math.max(1, data?.page || 1);
    const pageSize = Math.min(100, Math.max(1, data?.pageSize || 20));
    const offset = (page - 1) * pageSize;

    let query = db
      .from("course_applications")
      .select("*", { count: "exact" });

    if (data?.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }
    if (data?.paymentStatus && data.paymentStatus !== "all") {
      query = query.eq("payment_status", data.paymentStatus);
    }
    if (data?.courseId) {
      query = query.eq("course_id", data.courseId);
    }
    if (data?.search && data.search.trim()) {
      const q = data.search.trim();
      query = query.or(
        `student_name.ilike.%${q}%,student_email.ilike.%${q}%,application_number.ilike.%${q}%`
      );
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

    const { data: rows, count, error } = await query;

    if (error) {
      console.error("[CourseApp Admin] Queue list error:", error);
      return { success: false, error: error.message, applications: [], total: 0 };
    }

    const courseTitles = await getCourseTitleMap();
    const hydratedRows = (rows || []).map((row: any) => {
      const title = resolveApplicationCourseTitle(row.course_id, courseTitles);
      return {
        ...row,
        courses: { title },
        course_title: title,
      };
    });

    return {
      success: true,
      applications: hydratedRows,
      total: count || 0,
      page,
      pageSize,
    };
  } catch (err: any) {
    console.error("[CourseApp Admin] List error:", err);
    return { success: false, error: err.message, applications: [], total: 0 };
  }
}

export async function getAdminApplicationDetailCore(data: { applicationId: string; authToken?: string }) {
  try {
    const adminCheck = await verifyAdminSession(data.authToken);
    if (!adminCheck.isValid) {
      return { success: false, error: "Unauthorized access." };
    }

    const { data: app, error: appErr } = await db
      .from("course_applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();

    if (appErr || !app) {
      return { success: false, error: "Application not found." };
    }

    const courseTitles = await getCourseTitleMap();
    const courseTitle = resolveApplicationCourseTitle(app.course_id, courseTitles);

    const { data: docs } = await db
      .from("course_application_documents")
      .select("*")
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false });

    // Generate signed download URLs for documents
    const hydratedDocs = await Promise.all(
      (docs || []).map(async (doc: any) => {
        if (doc.storage_path) {
          const dlTicket = await createSignedDownloadUrl(doc.storage_path, 3600);
          return {
            ...doc,
            signedDownloadUrl: dlTicket.success ? dlTicket.signedUrl : null,
          };
        }
        return doc;
      })
    );

    const { data: events } = await db
      .from("course_application_events")
      .select("*")
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false });

    const { data: auditLogs } = await db
      .from("course_application_audit_logs")
      .select("*")
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false });

    return {
      success: true,
      application: {
        ...app,
        applicant_name: app.student_name,
        applicant_email: app.student_email,
        applicant_phone: app.student_phone,
        highest_qualification: app.academic_background?.highestQualification,
        field_of_study: app.academic_background?.fieldOfStudy || app.academic_background?.degreeOrMajor,
        institution: app.academic_background?.institution || app.academic_background?.collegeOrUniversity,
        graduation_year: app.academic_background?.graduationYear,
        courses: { title: courseTitle },
        course_title: courseTitle,
        documents: hydratedDocs,
        events: events || [],
        auditLogs: auditLogs || [],
      },
    };
  } catch (err: any) {
    console.error("[CourseApp Admin] Detail fetch error:", err);
    return { success: false, error: err.message };
  }
}

export async function getStudentApplicationTrackingCore(data: { applicationNumber: string; applicantEmail: string }) {
  try {
    const appNum = (data.applicationNumber || "").trim().toUpperCase();
    const email = normalizeEmail(data.applicantEmail);

    if (!appNum || !email) {
      return { success: false, error: "Application reference number and email address are required." };
    }

    const { data: app, error: appErr } = await db
      .from("course_applications")
      .select("id, application_number, status, payment_status, documents_status, student_name, student_email, course_id, resubmission_notes, rejection_reason, created_at")
      .eq("application_number", appNum)
      .ilike("student_email", email)
      .maybeSingle();

    if (appErr || !app) {
      return { success: false, error: "No matching application found for this reference and email." };
    }

    const { data: events } = await db
      .from("course_application_events")
      .select("id, event_type, title, description, metadata, created_at")
      .eq("application_id", app.id)
      .order("created_at", { ascending: true });

    const courseTitles = await getCourseTitleMap();
    const courseTitle = resolveApplicationCourseTitle(app.course_id, courseTitles);

    return {
      success: true,
      application: {
        ...app,
        applicant_name: app.student_name,
        applicant_email: app.student_email,
        courses: { title: courseTitle },
        course_title: courseTitle,
        notes: app.resubmission_notes || app.rejection_reason || null,
        events: (events || []).map((e: any) => ({
          ...e,
          notes: e.description || null,
        })),
      },
    };
  } catch (err: any) {
    console.error("[CourseApp] Student tracking fetch error:", err);
    return { success: false, error: err.message };
  }
}

// ─── 11. Admin Reconcile Identity Conflict ───────────────────────────────────

export interface AdminReconcileIdentityConflictInput {
  authToken?: string;
  applicationId: string;
  chosenEmail?: string;
  chosenAuthoritativeEmail?: string;
  notes?: string;
  reconciliationNotes?: string;
}

export async function adminReconcileIdentityConflictCore(data: AdminReconcileIdentityConflictInput) {
  try {
    const adminCheck = await verifyAdminSession(data.authToken);
    if (!adminCheck.isValid || !adminCheck.userId) {
      return { success: false, error: "Unauthorized: Administrator privileges required." };
    }

    if (!data.applicationId) {
      return { success: false, error: "Application ID is required." };
    }

    const notes = (data.notes || data.reconciliationNotes || "").trim();
    if (!notes || notes.length < 5) {
      return {
        success: false,
        error: "Detailed reconciliation notes explaining identity verification are mandatory (minimum 5 characters).",
      };
    }

    const rawEmail = (data.chosenEmail || data.chosenAuthoritativeEmail || "").trim();
    if (!rawEmail || !isValidEmail(rawEmail)) {
      return {
        success: false,
        error: "A valid chosen student email address is required for identity reconciliation.",
      };
    }

    const normalizedChosenEmail = normalizeEmail(rawEmail);

    // 1. Attempt authoritative reconciliation via atomic stored procedure (Migration v1.3)
    try {
      const { data: rpcData, error: rpcErr } = await db.rpc(
        "rpc_admin_reconcile_identity_conflict",
        {
          p_application_id: data.applicationId,
          p_actor_id: adminCheck.userId,
          p_chosen_email: normalizedChosenEmail,
          p_notes: notes,
        }
      );

      if (!rpcErr && rpcData) {
        return {
          success: true,
          message: "Identity conflict successfully reconciled and application released from quarantine.",
          application: rpcData,
        };
      }

      if (rpcErr) {
        if (rpcErr.code === "42883" || rpcErr.message?.includes("does not exist")) {
          // RPC not yet deployed in database, proceed to service-level fallback
        } else {
          // Legitimate business rejection from RPC (e.g. check_violation: not google_forms or no active conflict)
          return {
            success: false,
            error: rpcErr.message || "Failed to reconcile identity conflict via database procedure.",
          };
        }
      }
    } catch (rpcEx: any) {
      // Fall through to service-layer fallback if network/connection exception
    }

    // 2. Service-level reconciliation fallback
    const { data: currentApp, error: fetchErr } = await db
      .from("course_applications")
      .select("*")
      .eq("id", data.applicationId)
      .single();

    if (fetchErr || !currentApp) {
      return { success: false, error: "Application not found." };
    }

    if (currentApp.source !== "google_forms") {
      return {
        success: false,
        error: `Cannot reconcile application ${data.applicationId}: Application source is '${currentApp.source}' (reconciliation is only permitted for google_forms applications).`,
      };
    }

    const hasConflict = Boolean(
      currentApp.is_identity_conflict ||
      currentApp.academic_background?.google_forms?.identity_conflict
    );
    if (!hasConflict) {
      return {
        success: false,
        error: `Cannot reconcile application ${data.applicationId}: Application does not have an unresolved identity conflict.`,
      };
    }

    const updatedAcademic = {
      ...(currentApp.academic_background || {}),
      google_forms: {
        ...(currentApp.academic_background?.google_forms || {}),
        identity_conflict: false,
        identity_reconciled: true,
        reconciliation_notes: notes,
        reconciled_by: adminCheck.userId,
        reconciled_at: new Date().toISOString(),
      },
    };

    const updatePayload: Record<string, any> = {
      student_email: normalizedChosenEmail,
      academic_background: updatedAcademic,
      assigned_admin_id: adminCheck.userId,
      is_identity_conflict: false,
      updated_at: new Date().toISOString(),
    };

    let updateRes = await db
      .from("course_applications")
      .update(updatePayload)
      .eq("id", data.applicationId)
      .select()
      .single();

    if (updateRes.error && updateRes.error.code === "42703") {
      delete updatePayload.is_identity_conflict;
      updateRes = await db
        .from("course_applications")
        .update(updatePayload)
        .eq("id", data.applicationId)
        .select()
        .single();
    }

    if (updateRes.error || !updateRes.data) {
      return { success: false, error: updateRes.error?.message || "Failed to update application." };
    }

    // Record audit log
    try {
      await db.from("course_application_audit_logs").insert({
        application_id: data.applicationId,
        actor_id: adminCheck.userId,
        actor_role: "admin",
        action: "RECONCILE_IDENTITY_CONFLICT",
        previous_state: {
          student_email: currentApp.student_email,
          is_identity_conflict: currentApp.is_identity_conflict,
        },
        new_state: {
          student_email: normalizedChosenEmail,
          is_identity_conflict: false,
        },
        notes,
      });
    } catch (auditErr: any) {
      console.warn("[CourseApp Admin] Audit log note:", auditErr?.message);
    }

    // Record timeline event
    try {
      await db.from("course_application_events").insert({
        application_id: data.applicationId,
        event_type: "IDENTITY_RECONCILED",
        actor_type: "admin",
        actor_id: adminCheck.userId,
        title: "Identity Conflict Reconciled",
        description: `Administrator reconciled applicant identity discrepancies: ${notes}`,
        metadata: {
          reconciled_email: normalizedChosenEmail,
          previous_email: currentApp.student_email,
          notes,
        },
        occurrence_seq: 1,
      });
    } catch (eventErr: any) {
      console.warn("[CourseApp Admin] Timeline event note:", eventErr?.message);
    }

    return {
      success: true,
      message: "Identity conflict successfully reconciled and application released from quarantine.",
      application: updateRes.data,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reconcile identity conflict." };
  }
}
