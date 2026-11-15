import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { verifyAdminSession } from "@/lib/server/admin-guard";
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

export interface AdminUpdatePaymentInput {
  authToken?: string;
  applicationId: string;
  paymentStatus: "verified" | "waived" | "unpaid" | "not_required" | "pending" | string;
  paymentReference?: string;
  receiptReference?: string;
  paymentAmountInr?: number;
  notes?: string;
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

// ─── Helper Functions ───

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
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
        payment_status: "pending",
        documents_status: "pending",
        guest_claim_token_hash: claimTokenHash,
        guest_claim_expires_at: claimExpiresAt,
      })
      .select("id, application_number, status, created_at")
      .single();

    if (appErr || !appRow) {
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
      .select("id, status")
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

    // 3. Generate unique storage path
    const storagePath = generateStoragePath(data.applicationId, data.documentType, data.fileName);

    // 4. Insert pending document record in database
    const { data: docRow, error: docErr } = await db
      .from("course_application_documents")
      .insert({
        application_id: data.applicationId,
        document_type: data.documentType,
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
    const uploadTicket = await createSignedUploadUrl(data.applicationId, data.documentType, data.fileName);
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

    // 2. Mark document as uploaded
    await db
      .from("course_application_documents")
      .update({
        status: "uploaded",
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.documentId);

    // 3. Update application documents_status if currently resubmission_requested
    const { data: appRow } = await db
      .from("course_applications")
      .select("id, status, documents_status")
      .eq("id", docRow.application_id)
      .single();

    if (appRow?.status === "resubmission_required") {
      await db
        .from("course_applications")
        .update({
          status: "under_review",
          documents_status: "resubmitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", docRow.application_id);

      await db.from("course_application_events").insert({
        application_id: docRow.application_id,
        event_type: "RESUBMISSION_COMPLETED",
        actor_type: "student",
        title: "Documents Resubmitted",
        description: `Student uploaded replacement ${docRow.document_type}: ${docRow.file_name}.`,
        metadata: {
          document_id: docRow.id,
          document_type: docRow.document_type,
        },
      });
    }

    await db.from("course_application_events").insert({
      application_id: docRow.application_id,
      event_type: "DOCUMENT_UPLOADED",
      actor_type: "student",
      title: "Document Uploaded",
      description: `Uploaded ${docRow.document_type}: ${docRow.file_name}.`,
      metadata: {
        document_id: docRow.id,
        document_type: docRow.document_type,
      },
    });

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

    const { data: updatedApp, error: updateErr } = await db
      .from("course_applications")
      .update({
        payment_status: data.paymentStatus,
        payment_reference: paymentRef,
        updated_at: new Date().toISOString(),
      })
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

    await db.from("course_application_events").insert({
      application_id: data.applicationId,
      event_type: "PAYMENT_RECORDED",
      actor_type: "admin",
      actor_id: adminCheck.userId,
      title: "Payment Status Updated",
      description: `Payment status marked as ${data.paymentStatus}. Ref: ${paymentRef || "N/A"}`,
      metadata: {
        previous_status: prevPayment,
        new_status: data.paymentStatus,
        reference: paymentRef,
      },
    });

    return { success: true, application: updatedApp };
  } catch (err: any) {
    console.error("[CourseApp Admin] Payment update error:", err);
    return { success: false, error: err.message || "Failed to update payment." };
  }
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
      .select("*, courses(title)", { count: "exact" });

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

    return {
      success: true,
      applications: rows || [],
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
      .select("*, courses(title)")
      .eq("id", data.applicationId)
      .single();

    if (appErr || !app) {
      return { success: false, error: "Application not found." };
    }

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
      .select("id, application_number, status, payment_status, documents_status, student_name, student_email, course_id, notes, created_at, courses(title)")
      .eq("application_number", appNum)
      .ilike("student_email", email)
      .maybeSingle();

    if (appErr || !app) {
      return { success: false, error: "No matching application found for this reference and email." };
    }

    const { data: events } = await db
      .from("course_application_events")
      .select("id, event_type, title, description, notes, created_at")
      .eq("application_id", app.id)
      .order("created_at", { ascending: true });

    return {
      success: true,
      application: {
        ...app,
        applicant_name: app.student_name,
        applicant_email: app.student_email,
        events: events || [],
      },
    };
  } catch (err: any) {
    console.error("[CourseApp] Student tracking fetch error:", err);
    return { success: false, error: err.message };
  }
}
