/**
 * ====================================================================
 * COURSE APPLICATION GOOGLE FORMS SECURE WEBHOOK INGESTION ENGINE
 * ====================================================================
 * Authoritative backend handler for ingesting student applications
 * synchronized from Google Forms / Google Sheets into PathFinder.
 *
 * Core Business Model (Simplified Synchronization):
 * - Google Forms and linked Google Sheets handle the complete student
 *   submission, including payment proof and detailed questionnaire answers.
 * - PathFinder receives and displays ONLY:
 *     1. Student Name (studentName)
 *     2. Student Email (studentEmail)
 *     3. Selected Course (courseId / canonical slug)
 * - Payment proof and additional form answers remain in Google Sheets.
 * - Admin opens the linked Google Sheet to inspect payment proof and
 *   makes admission/enrollment decisions in PathFinder.
 * - No file conversion, Base64 decoding, Drive file retrieval, or
 *   storage bucket ingestion occurs through this webhook.
 *
 * Security & Integrity Guarantees:
 * 1. HMAC-SHA256 signature verification over exact raw request body.
 * 2. Dedicated secret COURSE_APPLICATION_WEBHOOK_SECRET (fails closed).
 * 3. Constant-time timingSafeEqual comparison preventing timing attacks.
 * 4. 5-minute timestamp tolerance window preventing replay attacks.
 * 5. Stable responseId idempotency avoiding duplicate student applications.
 * 6. Canonical course validation (bioplastic-innovation, ai-in-drug-discovery, bioinformatics).
 * 7. Initial queue status displays as "Pending Verification".
 * 8. Zero automatic approval or enrollment (preserves admin review workflow).
 * 9. Absolute exclusion of secret logging and PII leakage.
 * ====================================================================
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

// Server-side database handle supporting dynamic course application tables & RPCs
const db = supabaseAdmin as any;
import {
  normalizeCourseId,
  resolveCourseTitle,
  CANONICAL_COURSES,
  CourseIdentifierConfig,
} from "@/lib/courses/course-identifiers";
import { normalizeEmail, isValidEmail } from "@/lib/server/otp";
import { maskEmail } from "@/lib/server/spin-wheel-security";

// ─── Environment Secret Resolution ──────────────────────────────────────────

/**
 * Resolves the dedicated webhook HMAC secret.
 * STRICT: Fails closed if missing, empty, or placeholder.
 * FORBIDDEN: Falling back to SUPABASE_SERVICE_ROLE_KEY or anonymous keys.
 */
export function getCourseApplicationWebhookSecret(): string {
  const secret = (
    process.env.COURSE_APPLICATION_WEBHOOK_SECRET ||
    process.env.GOOGLE_FORMS_WEBHOOK_SECRET ||
    ""
  ).trim();
  if (!secret || secret === "your_webhook_secret_here" || secret.length < 16) {
    throw new Error(
      "COURSE_APPLICATION_WEBHOOK_SECRET (or GOOGLE_FORMS_WEBHOOK_SECRET) is not configured or is too short. " +
        "Set a strong 32+ character secret in your environment (e.g. .env.local)."
    );
  }
  return secret;
}

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Simplified payload contract: PathFinder receives ONLY student name,
 * student email, selected course, and responseId for idempotency.
 */
export interface CourseApplicationWebhookPayload {
  responseId?: string;
  timestamp?: string | number;
  courseId?: string;
  studentName?: string;
  studentEmail?: string;
  respondentEmail?: string | null;
  enteredEmail?: string | null;
  diagnostic?: boolean;
  action?: string;
  [key: string]: any;
}

export interface WebhookProcessingResult {
  success: boolean;
  code?: string;
  message: string;
  applicationId?: string;
  applicationNumber?: string;
  isDuplicate?: boolean;
  isDiagnostic?: boolean;
  isIdentityConflict?: boolean;
  courseId?: string | null;
  courseTitle?: string | null;
  timestamp?: number;
  httpStatus?: number;
}

// ─── Request Authentication & Timing Verification ───────────────────────────

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return false;
  }

  const cleanSig = signatureHeader.trim().toLowerCase().replace(/^sha256=/i, "");
  if (!cleanSig || cleanSig.length !== 64) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    const sigBuffer = Buffer.from(cleanSig, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function verifyWebhookTimestamp(
  timestampHeader: string | null | undefined,
  maxToleranceMs: number = 5 * 60 * 1000 // 5 minutes
): { valid: boolean; code?: string; error?: string; parsedTimestamp?: number } {
  if (!timestampHeader || typeof timestampHeader !== "string") {
    return {
      valid: false,
      code: "MISSING_TIMESTAMP",
      error: "Missing required timestamp header (x-webhook-timestamp).",
    };
  }

  const reqTime = parseInt(timestampHeader.trim(), 10);
  if (isNaN(reqTime) || reqTime <= 0) {
    return {
      valid: false,
      code: "INVALID_TIMESTAMP",
      error: "x-webhook-timestamp header must be a valid epoch millisecond integer.",
    };
  }

  const now = Date.now();
  const timeDifference = Math.abs(now - reqTime);

  if (timeDifference > maxToleranceMs) {
    return {
      valid: false,
      code: "EXPIRED_TIMESTAMP",
      error: `Webhook timestamp expired or out of bounds (difference: ${timeDifference}ms, max: ${maxToleranceMs}ms).`,
    };
  }

  return { valid: true, parsedTimestamp: reqTime };
}

// ─── Course Resolution & Validation ─────────────────────────────────────────

/**
 * Verified one-to-one legacy course aliases mapping to canonical course slugs.
 * Used for dynamic database resolution: aliases resolve to their canonical slug,
 * which is then queried against public.courses in the currently active database.
 * NEVER maps directly to static UUIDs.
 */
export const DOCUMENTED_COURSE_ALIASES: Readonly<Record<string, string>> = {
  "course-bioplastic-innovation": "bioplastic-innovation",
  "bioplastic-innovation": "bioplastic-innovation",
  "course-ai-drug-discovery": "ai-in-drug-discovery",
  "course-ai-in-drug-discovery": "ai-in-drug-discovery",
  "ai-in-drug-discovery": "ai-in-drug-discovery",
  "course-bioinformatics": "bioinformatics",
  "bioinformatics": "bioinformatics",
  "bioinformatics-frontend-seed": "bioinformatics",
};

// UUID syntax: RFC 4122 (8-4-4-4-12 hex digits)
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Detects attempts to supply a UUID structure (e.g. 8-4-4-4-xx or chunks with hyphens)
export const UUID_STRUCTURE_REGEX = /^[0-9a-z]{8}-[0-9a-z]{4}-/i;

// Course slug format: lowercase alphanumeric words separated by single hyphens
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CANDIDATE_COURSE_KEYS = ["courseId", "course_id", "courseSlug", "course"] as const;

export interface ExtractedCourseCandidatesResult {
  valid: boolean;
  candidates: string[];
  code?: string;
  error?: string;
}

/**
 * Extracts and validates all supplied course candidates from webhook payload.
 * Collects courseId, course_id, courseSlug, course.
 * Rejects non-string and whitespace-only populated fields (fails closed).
 * Deduplicates distinct candidates case-insensitively.
 */
export function extractCourseCandidates(
  payload: CourseApplicationWebhookPayload
): ExtractedCourseCandidatesResult {
  const candidates: string[] = [];

  for (const key of CANDIDATE_COURSE_KEYS) {
    const rawVal = payload[key];
    if (rawVal === undefined || rawVal === null) {
      continue;
    }

    if (typeof rawVal !== "string") {
      return {
        valid: false,
        candidates: [],
        code: "MALFORMED_COURSE_IDENTIFIER",
        error: `Course identifier field '${key}' must be a string, received ${typeof rawVal}.`,
      };
    }

    const trimmed = rawVal.trim();
    if (trimmed.length === 0) {
      return {
        valid: false,
        candidates: [],
        code: "MALFORMED_COURSE_IDENTIFIER",
        error: `Course identifier field '${key}' cannot be empty or whitespace only.`,
      };
    }

    candidates.push(trimmed);
  }

  if (candidates.length === 0) {
    return {
      valid: false,
      candidates: [],
      code: "MISSING_COURSE_IDENTIFIER",
      error: "Course identifier is required (courseId, course_id, courseSlug, or course).",
    };
  }

  // Deduplicate candidates preserving unique trimmed strings (case-insensitive deduplication)
  const seen = new Set<string>();
  const deduplicated: string[] = [];
  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduplicated.push(c);
    }
  }

  return {
    valid: true,
    candidates: deduplicated,
  };
}

export interface SingleCandidateResolutionResult {
  success: boolean;
  course?: { id: string; slug: string; title: string };
  code?: string;
  error?: string;
  isDbError?: boolean;
}

/**
 * Resolves a single candidate string against public.courses in the active database.
 * Accepts:
 *  1. Valid UUID -> exact .eq("id", uuid)
 *  2. Documented legacy alias -> maps to canonical slug -> exact .eq("slug", slug)
 *  3. Valid slug format -> exact .eq("slug", slug)
 * Rejects malformed UUIDs, invalid slug syntax, unknown aliases, or unknown courses.
 * Fails closed on database exceptions or query errors.
 */
export async function resolveSingleCandidateAgainstDatabase(
  candidate: string,
  client: any = db
): Promise<SingleCandidateResolutionResult> {
  const trimmed = candidate.trim();
  const lower = trimmed.toLowerCase();

  // 1. UUID Candidate
  if (UUID_REGEX.test(trimmed)) {
    try {
      const { data, error } = await client
        .from("courses")
        .select("id, slug, title")
        .eq("id", lower)
        .maybeSingle();

      if (error) {
        console.error(
          "[COURSE_APP_WEBHOOK] Database error querying course by ID:",
          error.code || "DB_QUERY_ERROR"
        );
        return {
          success: false,
          code: "DATABASE_LOOKUP_ERROR",
          error: "An internal database error occurred while resolving course identity. Please retry shortly.",
          isDbError: true,
        };
      }

      if (!data) {
        return {
          success: false,
          code: "UNKNOWN_COURSE",
          error: `Course not found for identifier '${trimmed}'.`,
        };
      }

      if (!data.id || !data.slug || !data.title) {
        console.error(
          "[COURSE_APP_WEBHOOK] Incomplete course record returned from database by ID"
        );
        return {
          success: false,
          code: "DATABASE_LOOKUP_ERROR",
          error: "An internal database error occurred while resolving course identity. Please retry shortly.",
          isDbError: true,
        };
      }

      return {
        success: true,
        course: { id: data.id, slug: data.slug, title: data.title },
      };
    } catch (err: any) {
      console.error(
        "[COURSE_APP_WEBHOOK] Exception during course ID database lookup:",
        err?.name || "NetworkError"
      );
      return {
        success: false,
        code: "DATABASE_LOOKUP_ERROR",
        error: "An internal database error occurred while resolving course identity. Please retry shortly.",
        isDbError: true,
      };
    }
  }

  // 2. Detect Malformed UUID (looks like a UUID attempt but fails valid hex/length check)
  if (
    UUID_STRUCTURE_REGEX.test(trimmed) ||
    (trimmed.includes("-") && trimmed.length >= 25 && /^[0-9a-z-]+$/i.test(trimmed) && trimmed.split("-").length === 5)
  ) {
    return {
      success: false,
      code: "MALFORMED_COURSE_IDENTIFIER",
      error: `Malformed UUID course identifier '${trimmed}'.`,
    };
  }

  // 3. Documented Legacy Alias or Slug
  let targetSlug: string | null = null;
  if (DOCUMENTED_COURSE_ALIASES[lower]) {
    targetSlug = DOCUMENTED_COURSE_ALIASES[lower];
  } else if (lower.startsWith("course-")) {
    // Unknown legacy alias with course- prefix
    return {
      success: false,
      code: "UNKNOWN_COURSE",
      error: `Unknown course legacy alias '${trimmed}'.`,
    };
  } else if (SLUG_REGEX.test(lower)) {
    targetSlug = lower;
  } else {
    // Invalid slug syntax (e.g. spaces, special chars, double hyphens)
    return {
      success: false,
      code: "MALFORMED_COURSE_IDENTIFIER",
      error: `Invalid course slug format '${trimmed}'. Slugs must contain only lowercase alphanumeric characters and single hyphens.`,
    };
  }

  // Query database by resolved slug
  try {
    const { data, error } = await client
      .from("courses")
      .select("id, slug, title")
      .eq("slug", targetSlug)
      .maybeSingle();

    if (error) {
      console.error(
        "[COURSE_APP_WEBHOOK] Database error querying course by slug:",
        error.code || "DB_QUERY_ERROR"
      );
      return {
        success: false,
        code: "DATABASE_LOOKUP_ERROR",
        error: "An internal database error occurred while resolving course identity. Please retry shortly.",
        isDbError: true,
      };
    }

    if (!data) {
      return {
        success: false,
        code: "UNKNOWN_COURSE",
        error: `Course not found for slug '${targetSlug}'.`,
      };
    }

    if (!data.id || !data.slug || !data.title) {
      console.error(
        "[COURSE_APP_WEBHOOK] Incomplete course record returned from database by slug"
      );
      return {
        success: false,
        code: "DATABASE_LOOKUP_ERROR",
        error: "An internal database error occurred while resolving course identity. Please retry shortly.",
        isDbError: true,
      };
    }

    return {
      success: true,
      course: { id: data.id, slug: data.slug, title: data.title },
    };
  } catch (err: any) {
    console.error(
      "[COURSE_APP_WEBHOOK] Exception during course slug database lookup:",
      err?.name || "NetworkError"
    );
    return {
      success: false,
      code: "DATABASE_LOOKUP_ERROR",
      error: "An internal database error occurred while resolving course identity. Please retry shortly.",
      isDbError: true,
    };
  }
}

export interface CourseDatabaseResolutionResult {
  success: boolean;
  course?: { id: string; slug: string; title: string };
  code?: string;
  message?: string;
  httpStatus?: number;
}

/**
 * Authoritative environment-aware course resolution engine.
 * Inspects all supplied candidates in payload, resolves each against public.courses
 * in the active database, guarantees identical course ID across candidates,
 * and fails closed on conflicts, invalid identifiers, or database lookup errors.
 * NEVER falls back to static Staging UUIDs.
 */
export async function resolveCourseFromDatabase(
  payload: CourseApplicationWebhookPayload,
  client: any = db
): Promise<CourseDatabaseResolutionResult> {
  const extraction = extractCourseCandidates(payload);
  if (!extraction.valid || extraction.candidates.length === 0) {
    return {
      success: false,
      code: extraction.code || "MISSING_COURSE_IDENTIFIER",
      message: extraction.error || "A course identifier is required.",
      httpStatus: 400,
    };
  }

  const resolvedCourses: Array<{ id: string; slug: string; title: string }> = [];

  for (const candidate of extraction.candidates) {
    const res = await resolveSingleCandidateAgainstDatabase(candidate, client);

    if (!res.success) {
      return {
        success: false,
        code: res.code || "INVALID_COURSE_IDENTIFIER",
        message: res.error || "Course resolution failed.",
        httpStatus: res.isDbError ? 500 : 400,
      };
    }

    if (res.course) {
      resolvedCourses.push(res.course);
    }
  }

  if (resolvedCourses.length === 0) {
    return {
      success: false,
      code: "UNKNOWN_COURSE",
      message: "No matching course found.",
      httpStatus: 400,
    };
  }

  // Compare resolved course IDs
  const primaryCourse = resolvedCourses[0];
  const conflicting = resolvedCourses.find((c) => c.id !== primaryCourse.id);
  if (conflicting) {
    return {
      success: false,
      code: "CONFLICTING_COURSE_IDENTIFIERS",
      message: `Conflicting course identifiers supplied. Identifiers resolved to different courses: '${primaryCourse.slug}' (${primaryCourse.id}) vs '${conflicting.slug}' (${conflicting.id}).`,
      httpStatus: 400,
    };
  }

  return {
    success: true,
    course: primaryCourse,
    httpStatus: 200,
  };
}

/**
 * @deprecated Legacy course resolution helper. Kept for backward compatibility.
 * Webhook ingestion paths must use resolveCourseFromDatabase to ensure environment-aware resolution.
 */
export function resolveAndValidateCourse(courseIdentifier: string): {
  isValid: boolean;
  course?: CourseIdentifierConfig;
  canonicalId?: string;
  courseSlug?: string;
  courseTitle?: string;
  error?: string;
} {
  if (!courseIdentifier || typeof courseIdentifier !== "string" || !courseIdentifier.trim()) {
    return {
      isValid: false,
      error: "Course identifier is required.",
    };
  }

  const normalized = normalizeCourseId(courseIdentifier.trim());
  const matched = CANONICAL_COURSES.find(
    (c) =>
      c.canonicalId.toLowerCase() === normalized.toLowerCase() ||
      c.slug.toLowerCase() === courseIdentifier.trim().toLowerCase() ||
      c.legacyIds.some((id) => id.toLowerCase() === courseIdentifier.trim().toLowerCase())
  );

  if (!matched) {
    const allowed = CANONICAL_COURSES.map((c) => c.slug).join(", ");
    return {
      isValid: false,
      error: `Unsupported course identifier '${courseIdentifier}'. Allowed courses: ${allowed}.`,
    };
  }

  return {
    isValid: true,
    course: matched,
    canonicalId: matched.canonicalId,
    courseSlug: matched.slug,
    courseTitle: matched.title,
  };
}

// ─── Core Ingestion Handler ─────────────────────────────────────────────────

export async function processCourseApplicationWebhookCore(data: {
  rawBody: string;
  signature?: string | null;
  timestamp?: string | null;
}): Promise<WebhookProcessingResult> {
  const { rawBody, signature, timestamp } = data;

  // 1. Resolve Secret (Fails closed)
  let secret: string;
  try {
    secret = getCourseApplicationWebhookSecret();
  } catch (err: any) {
    console.error("[COURSE_APP_WEBHOOK] Configuration error:", err.message);
    return {
      success: false,
      code: "CONFIGURATION_ERROR",
      message: err.message || "Webhook secret is not configured on this server.",
    };
  }

  // 2. Validate Headers Presence
  if (!signature) {
    return {
      success: false,
      code: "MISSING_SIGNATURE",
      message: "Missing required signature header (x-webhook-signature).",
    };
  }

  // 3. Verify Timestamp Freshness (5-minute tolerance window)
  const timeCheck = verifyWebhookTimestamp(timestamp);
  if (!timeCheck.valid) {
    return {
      success: false,
      code: timeCheck.code || "INVALID_TIMESTAMP",
      message: timeCheck.error || "Timestamp verification failed.",
    };
  }

  // 4. Verify HMAC-SHA256 Signature (Constant-Time)
  const isSignatureValid = verifyWebhookSignature(rawBody, signature, secret);
  if (!isSignatureValid) {
    return {
      success: false,
      code: "INVALID_SIGNATURE",
      message: "HMAC signature verification failed. Request is unauthorized.",
    };
  }

  // 5. Parse and Validate JSON Payload
  let payload: CourseApplicationWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload must be a JSON object.");
    }
  } catch (err: any) {
    return {
      success: false,
      code: "MALFORMED_PAYLOAD",
      message: "Malformed JSON payload: " + (err.message || "Parse failed"),
    };
  }

  // 5b. Safe Diagnostic Ping Interception (Zero Database Mutations)
  // Allows testing webhook reachability, secret configuration, and HMAC signing
  // without creating fake student entities, applications, audit logs, or notifications.
  if (
    payload &&
    (payload.diagnostic === true || payload.action === "ping" || payload.action === "diagnostic_ping")
  ) {
    let resolvedCourse: { id: string; title: string } | null = null;
    const hasAnyCourseField = CANDIDATE_COURSE_KEYS.some(
      (k) => payload[k] !== undefined && payload[k] !== null && String(payload[k]).trim() !== ""
    );
    if (hasAnyCourseField) {
      try {
        const courseRes = await resolveCourseFromDatabase(payload, db);
        if (courseRes.success && courseRes.course) {
          resolvedCourse = courseRes.course;
        }
      } catch {
        // Diagnostic ping remains safe and resilient even if database is unavailable
      }
    }

    return {
      success: true,
      code: "DIAGNOSTIC_PONG",
      message: "PathFinder webhook diagnostic ping successful. Endpoint is operational and HMAC authentication verified.",
      isDiagnostic: true,
      courseId: resolvedCourse?.id || null,
      courseTitle: resolvedCourse?.title || null,
      timestamp: Date.now(),
      httpStatus: 200,
    };
  }

  // 6. Extract and Normalize Submission Fields (Student Name, Email, Course, Response ID)
  const responseId = (
    payload.responseId ||
    payload.formResponseId ||
    payload.externalSubmissionId ||
    payload.response_id ||
    ""
  ).toString().trim();

  const studentName = (
    payload.studentName ||
    payload.student_name ||
    payload.applicantName ||
    payload.fullName ||
    payload.name ||
    ""
  ).toString().trim();

  // Extract both respondent email (authenticated Google account) and entered student contact email
  const rawRespondent = (
    payload.respondentEmail ||
    payload.respondent_email ||
    payload.googleEmail ||
    ""
  ).toString().trim();

  const rawEntered = (
    payload.enteredEmail ||
    payload.entered_email ||
    payload.studentEmail ||
    payload.student_email ||
    payload.applicantEmail ||
    payload.email ||
    ""
  ).toString().trim();

  const rawEmail = rawEntered || rawRespondent;

  // Strict Validation Rules
  if (!responseId || responseId.length < 3) {
    return {
      success: false,
      code: "MISSING_REQUIRED_FIELD",
      message: "External Google Form response ID (responseId) is required for idempotency.",
      httpStatus: 400,
    };
  }

  if (!studentName || studentName.length < 2) {
    return {
      success: false,
      code: "MISSING_REQUIRED_FIELD",
      message: "Student name is required (minimum 2 characters).",
      httpStatus: 400,
    };
  }

  if (!rawEmail || !isValidEmail(rawEmail)) {
    return {
      success: false,
      code: "INVALID_EMAIL",
      message: "A valid student email address is required.",
      httpStatus: 400,
    };
  }

  const normalizedEmail = normalizeEmail(rawEmail);
  const respondentEmailNorm = rawRespondent && isValidEmail(rawRespondent) ? normalizeEmail(rawRespondent) : null;
  const enteredEmailNorm = rawEntered && isValidEmail(rawEntered) ? normalizeEmail(rawEntered) : normalizedEmail;

  // Identity conflict check: compare normalized authenticated Google account against entered contact email
  const isIdentityConflict = Boolean(
    respondentEmailNorm && enteredEmailNorm && respondentEmailNorm !== enteredEmailNorm
  );

  if (isIdentityConflict) {
    console.warn(
      `[COURSE_APP_WEBHOOK] Identity conflict detected for responseId '${responseId}'. Respondent Google account (${maskEmail(respondentEmailNorm)}) does not match entered student email (${maskEmail(enteredEmailNorm)}). Quarantining application.`
    );
  }

  // 7. Validate Course Identity dynamically against Active Database
  const courseResolution = await resolveCourseFromDatabase(payload, db);
  if (!courseResolution.success || !courseResolution.course) {
    return {
      success: false,
      code: courseResolution.code || "INVALID_COURSE_IDENTIFIER",
      message: courseResolution.message || "Invalid course identifier.",
      httpStatus: courseResolution.httpStatus || 400,
    };
  }

  const resolvedCourseUuid = courseResolution.course.id;
  const courseSlug = courseResolution.course.slug;
  const courseTitle = courseResolution.course.title;

  // 8. Idempotency Check: Prevent duplicate processing for identical responseId
  try {
    // A. Check by dedicated external_submission_id column
    const { data: existingApp, error: queryErr } = await db
      .from("course_applications")
      .select("id, application_number, status, payment_status, created_at")
      .eq("external_submission_id", responseId)
      .maybeSingle();

    if (existingApp && !queryErr) {
      return {
        success: true,
        code: "DUPLICATE_SUBMISSION",
        isDuplicate: true,
        message: `Submission with response ID '${responseId}' was already processed as application ${existingApp.application_number}.`,
        applicationId: existingApp.id,
        applicationNumber: existingApp.application_number,
        courseId: resolvedCourseUuid,
        courseTitle,
      };
    }

    // B. Check within academic_background JSONB as fallback
    const { data: jsonbExisting } = await db
      .from("course_applications")
      .select("id, application_number, status, payment_status, created_at")
      .contains("academic_background", { google_forms: { response_id: responseId } })
      .maybeSingle();

    if (jsonbExisting) {
      return {
        success: true,
        code: "DUPLICATE_SUBMISSION",
        isDuplicate: true,
        message: `Submission with response ID '${responseId}' was already processed as application ${jsonbExisting.application_number}.`,
        applicationId: jsonbExisting.id,
        applicationNumber: jsonbExisting.application_number,
        courseId: resolvedCourseUuid,
        courseTitle,
      };
    }
  } catch (err: any) {
    console.warn("[COURSE_APP_WEBHOOK] Note during idempotency pre-check:", err?.message);
  }

  // 9. Prepare Minimal Technical Metadata (preserving Google Forms origin and identity conflict flags)
  const academicBackground = {
    google_forms: {
      response_id: responseId,
      submission_timestamp: payload.timestamp || timeCheck.parsedTimestamp || new Date().toISOString(),
      form_slug: courseSlug,
      source: "google_forms",
      respondent_email: respondentEmailNorm,
      entered_email: enteredEmailNorm,
      identity_conflict: isIdentityConflict,
      identity_conflict_reason: isIdentityConflict
        ? `Google respondent email (${respondentEmailNorm}) does not match entered student contact email (${enteredEmailNorm}). Application quarantined.`
        : null,
    },
  };

  // 10. Insert Application Record into public.course_applications
  // Initial Lifecycle State:
  // - status: 'submitted' (displays as "Pending Verification" in the Admin UI)
  // - payment_status: 'pending_verification' (admin opens Google Sheet to verify payment proof)
  // - documents_status: 'not_required' (honest state: documents are handled externally in Google Sheets)
  // - is_identity_conflict: true/false (quarantined if respondent Google email differs from entered email)
  const insertPayload: Record<string, any> = {
    course_id: resolvedCourseUuid,
    user_id: null, // Submissions from Google Forms are guest/unauthenticated until claimed/enrolled
    student_name: studentName,
    student_email: enteredEmailNorm,
    student_phone: null,
    academic_background: academicBackground,
    statement_of_purpose: null,
    status: "submitted",
    payment_status: "pending_verification",
    payment_reference: null,
    payment_amount_inr: null,
    documents_status: "not_required",
    external_submission_id: responseId,
    source: "google_forms",
    is_identity_conflict: isIdentityConflict,
    respondent_email: respondentEmailNorm,
  };

  // Attempt insert with external_submission_id, source, is_identity_conflict, and documents_status = 'not_required'
  let insertResult = await db
    .from("course_applications")
    .insert(insertPayload)
    .select("id, application_number, status, payment_status, documents_status, created_at")
    .single();

  // If documents_status = 'not_required' is rejected by pre-v1.2 check constraint (Postgres 23514), fallback to 'pending'
  if (insertResult.error && insertResult.error.code === "23514" && (insertResult.error.message?.includes("documents_status") || insertResult.error.message?.includes("check"))) {
    const fallbackPayload: Record<string, any> = { ...insertPayload, documents_status: "pending" };
    insertResult = await db
      .from("course_applications")
      .insert(fallbackPayload)
      .select("id, application_number, status, payment_status, documents_status, created_at")
      .single();
  }

  // Resilient column fallback: If columns do not exist prior to migrations v1.1 or v1.3, fallback gracefully
  if (insertResult.error && (insertResult.error.code === "42703" || insertResult.error.message?.includes("column"))) {
    const fallbackPayload: Record<string, any> = { ...insertPayload, documents_status: "pending" };
    delete fallbackPayload.external_submission_id;
    delete fallbackPayload.source;
    delete fallbackPayload.is_identity_conflict;
    delete fallbackPayload.respondent_email;

    insertResult = await db
      .from("course_applications")
      .insert(fallbackPayload)
      .select("id, application_number, status, payment_status, documents_status, created_at")
      .single();
  }

  // Handle concurrent duplicate submission race conditions (Postgres 23505)
  if (insertResult.error?.code === "23505") {
    const { data: duplicateApp } = await db
      .from("course_applications")
      .select("id, application_number, status, payment_status, created_at")
      .or(`external_submission_id.eq.${responseId}`)
      .maybeSingle();

    if (duplicateApp) {
      return {
        success: true,
        code: "DUPLICATE_SUBMISSION",
        isDuplicate: true,
        message: `Concurrent submission with response ID '${responseId}' was processed as application ${duplicateApp.application_number}.`,
        applicationId: duplicateApp.id,
        applicationNumber: duplicateApp.application_number,
        courseId: resolvedCourseUuid,
        courseTitle,
        isIdentityConflict,
      };
    }

    return {
      success: false,
      code: "CONCURRENT_SUBMISSION_CONFLICT",
      message: "A concurrent submission for this response was detected.",
    };
  }

  if (insertResult.error || !insertResult.data) {
    console.error("[COURSE_APP_WEBHOOK] Insert failed:", insertResult.error?.code || "DATABASE_ERROR");
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "An internal database error occurred while saving the application. Please retry shortly.",
      httpStatus: 500,
    };
  }

  const newApp = insertResult.data;

  // 11. Insert Milestone Lifecycle Event
  try {
    await db.from("course_application_events").insert({
      application_id: newApp.id,
      event_type: "SUBMITTED",
      actor_type: "system",
      actor_id: null,
      title: isIdentityConflict
        ? "Application Received (Quarantined: Identity Conflict)"
        : "Application Received from Google Forms",
      description: isIdentityConflict
        ? `Application synchronized from Google Forms (Response ID: ${responseId}). Quarantined due to mismatch between Google account (${respondentEmailNorm}) and entered contact email (${enteredEmailNorm}).`
        : `Course application for ${courseTitle} synchronized via secure webhook (Response ID: ${responseId}).`,
      metadata: {
        course_slug: courseSlug,
        course_title: courseTitle,
        google_form_response_id: responseId,
        source: "google_forms",
        is_identity_conflict: isIdentityConflict,
        respondent_email: respondentEmailNorm,
        entered_email: enteredEmailNorm,
      },
      occurrence_seq: 1,
    });
  } catch (eventErr: any) {
    console.warn("[COURSE_APP_WEBHOOK] Note recording lifecycle event:", eventErr.message);
  }

  // 12. Record Audit Log Entry (Tamper-proof trail)
  try {
    await db.from("course_application_audit_logs").insert({
      application_id: newApp.id,
      actor_id: null,
      actor_role: "system",
      action: isIdentityConflict
        ? "INGEST_GOOGLE_FORMS_SUBMISSION_QUARANTINED"
        : "INGEST_GOOGLE_FORMS_SUBMISSION",
      previous_state: null,
      new_state: {
        status: newApp.status,
        payment_status: newApp.payment_status,
        external_submission_id: responseId,
        course_id: resolvedCourseUuid,
        student_email: enteredEmailNorm,
        is_identity_conflict: isIdentityConflict,
        respondent_email: respondentEmailNorm,
      },
      notes: isIdentityConflict
        ? `Ingested and quarantined from Google Forms webhook due to identity conflict: Google account '${respondentEmailNorm}' vs entered email '${enteredEmailNorm}'. Administrative reconciliation required before approval or enrollment.`
        : `Ingested from Google Forms webhook for course '${courseTitle}' (Response ID: ${responseId}). Payment verification delegated to linked Google Sheet.`,
    });
  } catch (auditErr: any) {
    console.warn("[COURSE_APP_WEBHOOK] Note recording audit log:", auditErr.message);
  }

  // 13. Queue Transactional Outbox Email (application_received)
  try {
    await db.from("notification_outbox").insert({
      recipient_email: enteredEmailNorm,
      recipient_name: studentName,
      template_name: "application_received",
      payload: {
        student_name: studentName,
        course_title: courseTitle,
        application_number: newApp.application_number,
        submitted_at: new Date().toISOString(),
        is_identity_conflict: isIdentityConflict,
      },
      status: "pending",
    });
  } catch (outboxErr: any) {
    // Non-blocking for webhook response
    console.warn("[COURSE_APP_WEBHOOK] Note queuing notification:", outboxErr.message);
  }

  return {
    success: true,
    code: isIdentityConflict ? "APPLICATION_QUARANTINED" : "APPLICATION_CREATED",
    message: isIdentityConflict
      ? `Application ${newApp.application_number} successfully registered but quarantined due to identity conflict.`
      : `Application ${newApp.application_number} successfully registered for ${courseTitle}.`,
    applicationId: newApp.id,
    applicationNumber: newApp.application_number,
    isDuplicate: false,
    isIdentityConflict,
    courseId: resolvedCourseUuid,
    courseTitle,
    httpStatus: 200,
  };
}
