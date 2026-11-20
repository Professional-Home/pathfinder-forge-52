import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import {
  processCourseApplicationWebhookCore,
  verifyWebhookSignature,
  verifyWebhookTimestamp,
  resolveAndValidateCourse,
  resolveCourseFromDatabase,
  resolveSingleCandidateAgainstDatabase,
  extractCourseCandidates,
  DOCUMENTED_COURSE_ALIASES,
  getCourseApplicationWebhookSecret,
  type CourseApplicationWebhookPayload,
} from "@/lib/server/course-applications-webhook";
import {
  adminApproveGoogleFormsApplicationCore,
  adminTransitionApplicationCore,
  adminReconcileIdentityConflictCore,
} from "@/lib/server/course-applications";
import * as adminGuard from "@/lib/server/admin-guard";
import { handleCourseApplicationWebhookRequest } from "@/server";
import { supabaseAdmin as db } from "@/lib/server/supabase-admin";
import { renderNotificationEmail } from "@/lib/server/notification-worker";

const TEST_SECRET = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

const DEFAULT_TEST_COURSES = [
  {
    id: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
    slug: "bioplastic-innovation",
    title: "BioPlastic Innovation",
  },
  {
    id: "d6a21b1f-2682-4cf2-a83d-2c030f476625",
    slug: "ai-in-drug-discovery",
    title: "AI in Drug Discovery",
  },
  {
    id: "840fed84-696d-458e-aeee-2df6b88d3428",
    slug: "bioinformatics",
    title: "Bioinformatics & Genomic Data Analysis",
  },
];

function createMockCoursesQueryBuilder(courses = DEFAULT_TEST_COURSES) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockImplementation((col: string, val: string) => ({
        maybeSingle: vi.fn().mockImplementation(async () => {
          const match = courses.find((c) =>
            col === "id"
              ? c.id.toLowerCase() === String(val).toLowerCase()
              : c.slug.toLowerCase() === String(val).toLowerCase()
          );
          return { data: match || null, error: null };
        }),
      })),
    }),
  };
}

function createSignedWebhookRequest(payload: any, options: {
  secret?: string;
  timestamp?: number;
  tamperSignature?: boolean;
} = {}) {
  const secret = options.secret ?? TEST_SECRET;
  const timestamp = options.timestamp ?? Date.now();
  const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);

  let signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (options.tamperSignature) {
    signature = signature.slice(0, -4) + "0000";
  }

  return {
    rawBody,
    signature,
    timestamp: String(timestamp),
  };
}

describe("Course Applications Google Forms Webhook — Phase 1 Task 1.2.2 Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.COURSE_APPLICATION_WEBHOOK_SECRET = TEST_SECRET;
    vi.spyOn(db, "from").mockImplementation((table: string) => {
      if (table === "courses") {
        return createMockCoursesQueryBuilder();
      }
      return {} as any;
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─── 1. Secret Configuration & Fail-Closed Behavior ─────────────────────────
  describe("Secret Configuration & Fail-Closed Behavior", () => {
    it("fails closed when COURSE_APPLICATION_WEBHOOK_SECRET is not configured", async () => {
      delete process.env.COURSE_APPLICATION_WEBHOOK_SECRET;

      expect(() => getCourseApplicationWebhookSecret()).toThrowError(/not configured/);

      const signed = createSignedWebhookRequest({ test: "data" }, { secret: "dummy_key" });
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(false);
      expect(result.code).toBe("CONFIGURATION_ERROR");
      expect(result.message).toContain("COURSE_APPLICATION_WEBHOOK_SECRET");
    });

    it("fails closed when COURSE_APPLICATION_WEBHOOK_SECRET is a short placeholder", async () => {
      process.env.COURSE_APPLICATION_WEBHOOK_SECRET = "short";

      expect(() => getCourseApplicationWebhookSecret()).toThrowError(/too short/);

      const signed = createSignedWebhookRequest({ test: "data" }, { secret: "short" });
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(false);
      expect(result.code).toBe("CONFIGURATION_ERROR");
    });
  });

  // ─── 2. Signature Verification (HMAC-SHA256 & Constant-Time) ─────────────────
  describe("HMAC-SHA256 Signature Verification", () => {
    it("accepts a perfectly signed payload matching raw body", () => {
      const rawBody = JSON.stringify({ message: "valid submission" });
      const expectedSig = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

      const isValid = verifyWebhookSignature(rawBody, expectedSig, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it("accepts signatures with sha256= prefix and case insensitivity", () => {
      const rawBody = JSON.stringify({ message: "valid submission" });
      const expectedSig = "sha256=" + crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex").toUpperCase();

      const isValid = verifyWebhookSignature(rawBody, expectedSig, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it("rejects missing signature", async () => {
      const result = await processCourseApplicationWebhookCore({
        rawBody: JSON.stringify({ responseId: "resp_123" }),
        signature: null,
        timestamp: String(Date.now()),
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("MISSING_SIGNATURE");
    });

    it("rejects tampered or forged signature", async () => {
      const signed = createSignedWebhookRequest(
        { responseId: "resp_123", studentName: "Aarav" },
        { tamperSignature: true }
      );

      const result = await processCourseApplicationWebhookCore(signed);
      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_SIGNATURE");
    });

    it("rejects when signature was generated with a different secret", async () => {
      const signed = createSignedWebhookRequest(
        { responseId: "resp_123" },
        { secret: "different_secret_key_01234567890123456789" }
      );

      const result = await processCourseApplicationWebhookCore(signed);
      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_SIGNATURE");
    });
  });

  // ─── 3. Timestamp Freshness & Replay Protection ──────────────────────────────
  describe("Timestamp Freshness & Replay Protection", () => {
    it("accepts timestamps within 5-minute window", () => {
      const now = Date.now();
      const freshTime = now - 2 * 60 * 1000; // 2 minutes ago
      const check = verifyWebhookTimestamp(String(freshTime));

      expect(check.valid).toBe(true);
      expect(check.parsedTimestamp).toBe(freshTime);
    });

    it("rejects expired timestamps (> 5 minutes ago)", async () => {
      const oldTime = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const signed = createSignedWebhookRequest({ responseId: "resp_123" }, { timestamp: oldTime });

      const result = await processCourseApplicationWebhookCore(signed);
      expect(result.success).toBe(false);
      expect(result.code).toBe("EXPIRED_TIMESTAMP");
      expect(result.message).toContain("expired or out of bounds");
    });

    it("rejects timestamps far in the future (> 5 minutes ahead)", async () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes ahead
      const signed = createSignedWebhookRequest({ responseId: "resp_123" }, { timestamp: futureTime });

      const result = await processCourseApplicationWebhookCore(signed);
      expect(result.success).toBe(false);
      expect(result.code).toBe("EXPIRED_TIMESTAMP");
    });

    it("rejects invalid non-integer timestamps", async () => {
      const signed = createSignedWebhookRequest({ responseId: "resp_123" });
      signed.timestamp = "not-a-timestamp";

      const result = await processCourseApplicationWebhookCore(signed);
      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_TIMESTAMP");
    });
  });

  // ─── 4. Payload Parsing & Canonical Course Validation ────────────────────────
  describe("Payload Parsing & Course Validation", () => {
    it("rejects malformed non-JSON raw body", async () => {
      const signed = createSignedWebhookRequest("this is not json");
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(false);
      expect(result.code).toBe("MALFORMED_PAYLOAD");
    });

    it("resolves all three canonical courses correctly", () => {
      const bioplastics = resolveAndValidateCourse("bioplastic-innovation");
      expect(bioplastics.isValid).toBe(true);
      expect(bioplastics.canonicalId).toBe("d2756643-0b82-4ebe-a123-9fa3be97bd13");
      expect(bioplastics.courseSlug).toBe("bioplastic-innovation");

      const drug = resolveAndValidateCourse("ai-in-drug-discovery");
      expect(drug.isValid).toBe(true);
      expect(drug.canonicalId).toBe("d6a21b1f-2682-4cf2-a83d-2c030f476625");

      const bio = resolveAndValidateCourse("bioinformatics");
      expect(bio.isValid).toBe(true);
      expect(bio.canonicalId).toBe("840fed84-696d-458e-aeee-2df6b88d3428");
    });

    it("rejects unsupported or arbitrary course identifiers", async () => {
      const payload: CourseApplicationWebhookPayload = {
        responseId: "2_ABaOnucSAMPLE_123",
        courseId: "unsupported-advanced-rocket-propulsion",
        studentName: "Dev Patel",
        studentEmail: "dev@example.com",
      };
      const signed = createSignedWebhookRequest(payload);
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNKNOWN_COURSE");
      expect(result.message).toContain("not found");
    });

    it("rejects when required student fields are missing", async () => {
      // Missing studentName
      const noName = createSignedWebhookRequest({
        responseId: "2_ABaOnuc_123",
        courseId: "bioplastic-innovation",
        studentEmail: "test@example.com",
      });
      const res1 = await processCourseApplicationWebhookCore(noName);
      expect(res1.success).toBe(false);
      expect(res1.code).toBe("MISSING_REQUIRED_FIELD");

      // Missing studentEmail
      const noEmail = createSignedWebhookRequest({
        responseId: "2_ABaOnuc_123",
        courseId: "bioplastic-innovation",
        studentName: "John Doe",
      });
      const res2 = await processCourseApplicationWebhookCore(noEmail);
      expect(res2.success).toBe(false);
      expect(res2.code).toBe("INVALID_EMAIL");

      // Missing responseId
      const noRespId = createSignedWebhookRequest({
        courseId: "bioplastic-innovation",
        studentName: "John Doe",
        studentEmail: "test@example.com",
      });
      const res3 = await processCourseApplicationWebhookCore(noRespId);
      expect(res3.success).toBe(false);
      expect(res3.code).toBe("MISSING_REQUIRED_FIELD");
    });
  });

  // ─── 5. Honest Document Status ('not_required') & Simplified Ingestion ──────
  describe("Honest Document Status & Simplified Ingestion", () => {
    it("successfully ingests application with honest documents_status = 'not_required' and NO storage calls", async () => {
      let insertedPayload: any = null;

      const mockApplication = {
        id: "app-uuid-simplified-001",
        application_number: "APP-2026-07777",
        status: "submitted",
        payment_status: "pending_verification",
        documents_status: "not_required",
        created_at: new Date().toISOString(),
      };

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation((payload: any) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockApplication, error: null }),
                }),
              };
            }),
          } as any;
        }
        if (
          table === "course_application_events" ||
          table === "course_application_audit_logs" ||
          table === "notification_outbox"
        ) {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        return {} as any;
      });

      const storageSpy = vi.spyOn(db.storage, "from");

      const payload: CourseApplicationWebhookPayload = {
        responseId: "2_ABaOnuc_GENUINE_FORM_RESPONSE_ID",
        timestamp: Date.now(),
        courseId: "bioplastic-innovation",
        studentName: "Aarav Sharma",
        studentEmail: "aarav.sharma@example.com",
      };

      const signed = createSignedWebhookRequest(payload);
      const result = await processCourseApplicationWebhookCore(signed);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.code).toBe("APPLICATION_CREATED");
      expect(result.applicationNumber).toBe("APP-2026-07777");
      expect(result.isDuplicate).toBe(false);
      expect(result.courseId).toBe("d2756643-0b82-4ebe-a123-9fa3be97bd13");
      expect(result.courseTitle?.toLowerCase()).toContain("bioplastic innovation");

      // Verify honest status representation
      expect(insertedPayload).not.toBeNull();
      expect(insertedPayload.student_name).toBe("Aarav Sharma");
      expect(insertedPayload.student_email).toBe("aarav.sharma@example.com");
      expect(insertedPayload.status).toBe("submitted");
      expect(insertedPayload.payment_status).toBe("pending_verification");
      // STRICT: documents_status must be 'not_required' (honest state)
      expect(insertedPayload.documents_status).toBe("not_required");
      expect(insertedPayload.external_submission_id).toBe("2_ABaOnuc_GENUINE_FORM_RESPONSE_ID");
      expect(insertedPayload.source).toBe("google_forms");

      // STRICT: Confirm Supabase Storage is NEVER invoked for payment proof
      expect(storageSpy).not.toHaveBeenCalled();

      // STRICT: Confirm no auto-approval or auto-enrollment
      expect(mockApplication.status).toBe("submitted");
      expect(mockApplication.status).not.toBe("approved");
      expect(mockApplication.status).not.toBe("enrolled");
    });

    it("falls back gracefully to documents_status = 'pending' if database check constraint rejects 'not_required' (pre-v1.2)", async () => {
      let firstAttemptPayload: any = null;
      let fallbackAttemptPayload: any = null;

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation((payload: any) => {
              if (payload.documents_status === "not_required") {
                firstAttemptPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: "23514", message: "check constraint course_applications_documents_status_check" },
                    }),
                  }),
                };
              }
              fallbackAttemptPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "app-fallback-1", application_number: "APP-2026-08888", status: "submitted" },
                    error: null,
                  }),
                }),
              };
            }),
          } as any;
        }
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } as any;
      });

      const payload = {
        responseId: "2_ABaOnuc_FALLBACK_TEST",
        courseId: "ai-in-drug-discovery",
        studentName: "Fallback Candidate",
        studentEmail: "fallback@example.com",
      };

      const signed = createSignedWebhookRequest(payload);
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(true);
      expect(firstAttemptPayload.documents_status).toBe("not_required");
      expect(fallbackAttemptPayload.documents_status).toBe("pending");
      expect(result.applicationNumber).toBe("APP-2026-08888");
    });
  });

  // ─── 6. Google Forms Admin Approval & Rejection Workflow ─────────────────────
  describe("Google Forms Dedicated Admin Approval & Rejection Workflow", () => {
    it("rejects approval when confirmedSheetVerification is missing or false", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      // Missing (undefined)
      const resMissing = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-1",
      } as any);
      expect(resMissing.success).toBe(false);
      expect(resMissing.error).toContain("Explicit confirmation required");

      // Explicitly false
      const resFalse = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-1",
        confirmedSheetVerification: false,
      });
      expect(resFalse.success).toBe(false);
      expect(resFalse.error).toContain("Explicit confirmation required");
    });

    it("rejects approval when caller is not an authenticated admin", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: false,
        error: "Session expired or invalid",
      });

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "invalid_token",
        applicationId: "app-uuid-gf-1",
        confirmedSheetVerification: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Administrator privileges required");
    });

    it("prevents generic status-transition from approving google_forms applications (cannot bypass payment check)", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-bypass",
                source: "google_forms",
                status: "submitted",
                payment_status: "pending_verification",
                documents_status: "not_required",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-bypass",
        targetStatus: "approved",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Google Forms applications cannot be approved via generic status transition");
    });

    it("rejects approval if application source is not google_forms (preserves direct portal workflow)", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-direct-1",
                source: "direct_portal",
                status: "submitted",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-direct-1",
        confirmedSheetVerification: true,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("strictly reserved for Google Forms");
    });

    it("fails closed with MIGRATION_REQUIRED when approval RPC is not installed (no non-atomic fallback)", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      let updateCalled = false;
      let auditLogInserted = false;

      // Mock RPC missing (42883)
      vi.spyOn(db, "rpc").mockResolvedValue({
        data: null,
        error: { code: "42883", message: "function rpc_admin_approve_google_forms_application does not exist" },
      } as any);

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-2",
                application_number: "APP-2026-03333",
                source: "google_forms",
                status: "submitted",
                payment_status: "pending_verification",
                documents_status: "not_required",
                student_name: "Sneha Patel",
                student_email: "sneha@example.com",
                course_id: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
              },
              error: null,
            }),
            update: vi.fn().mockImplementation(() => {
              updateCalled = true;
              return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          } as any;
        }
        if (table === "course_application_audit_logs") {
          return {
            insert: vi.fn().mockImplementation(() => {
              auditLogInserted = true;
              return Promise.resolve({ data: null, error: null });
            }),
          } as any;
        }
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-2",
        confirmedSheetVerification: true,
        verificationNotes: "UTR: 987654321 verified in Bioplastics Google Sheet. Payment of INR 1500 received.",
      });

      // Must fail closed: require migration v1.2, NEVER execute non-atomic fallback writes
      expect(res.success).toBe(false);
      expect(res.code).toBe("MIGRATION_REQUIRED");
      expect(res.error).toContain("Database migration required");
      expect(updateCalled).toBe(false);
      expect(auditLogInserted).toBe(false);
    });

    it("atomically approves via database stored procedure when migration v1.2 is installed", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-rpc-success",
                source: "google_forms",
                status: "submitted",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      let capturedRpcParams: any = null;
      vi.spyOn(db, "rpc").mockImplementation(((name: string, params: any) => {
        if (name === "rpc_admin_approve_google_forms_application") {
          capturedRpcParams = params;
          return Promise.resolve({
            data: {
              id: "app-uuid-gf-rpc-success",
              status: "approved",
              payment_status: "verified",
              documents_status: "not_required",
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-rpc-success",
        confirmedSheetVerification: true,
        verificationNotes: "Verified in Bioplastics Google Sheet.",
      });

      expect(res.success).toBe(true);
      expect(capturedRpcParams.p_confirmed_sheet_verification).toBe(true);
      expect(res.application.status).toBe("approved");
      expect(res.application.payment_status).toBe("verified");
    });

    it("fails fast when RPC returns a business rejection and does NOT silently fall through", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-reject",
                source: "google_forms",
                status: "submitted",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      // RPC exists but rejects due to business rule (e.g. check_violation)
      vi.spyOn(db, "rpc").mockResolvedValue({
        data: null,
        error: {
          code: "23514",
          message: "Cannot approve application currently in status rejected",
        },
      } as any);

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-reject",
        confirmedSheetVerification: true,
      });

      // Must fail fast with RPC error and NOT fall through to direct DB update
      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot approve application");
    });

    it("fails closed on internal SQL error (e.g. 42703 column missing) and does NOT fall through to fallback", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      let updateAttempted = false;

      // Mock internal SQL runtime error containing "does not exist" in column message
      vi.spyOn(db, "rpc").mockResolvedValue({
        data: null,
        error: { code: "42703", message: 'column "recipient_name" of relation "notification_outbox" does not exist' },
      } as any);

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-sqlerr",
                source: "google_forms",
                status: "submitted",
              },
              error: null,
            }),
            update: vi.fn().mockImplementation(() => {
              updateAttempted = true;
              return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-sqlerr",
        confirmedSheetVerification: true,
      });

      // Strict requirement: generic SQL error must fail closed and NOT trigger fallback approval
      expect(res.success).toBe(false);
      expect(res.code).toBe("42703");
      expect(updateAttempted).toBe(false);
    });

    it("fails closed on network exception or client timeout without partial approval writes", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      let updateAttempted = false;

      // Mock network exception during db.rpc
      vi.spyOn(db, "rpc").mockRejectedValue(new Error("fetch failed: connection timeout"));

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-neterr",
                source: "google_forms",
                status: "submitted",
              },
              error: null,
            }),
            update: vi.fn().mockImplementation(() => {
              updateAttempted = true;
              return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-neterr",
        confirmedSheetVerification: true,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("NETWORK_ERROR");
      expect(res.error).toContain("Network or connection error");
      expect(updateAttempted).toBe(false);
    });

    it("handles repeated approval safely via RPC idempotency (no duplicate events or logs)", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-repeat",
                source: "google_forms",
                status: "submitted",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      // RPC handles idempotency internally and returns the application cleanly
      vi.spyOn(db, "rpc").mockResolvedValue({
        data: {
          id: "app-uuid-gf-repeat",
          status: "approved",
          payment_status: "verified",
          documents_status: "not_required",
        },
        error: null,
      } as any);

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-repeat",
        confirmedSheetVerification: true,
      });

      expect(res.success).toBe(true);
      expect(res.application.status).toBe("approved");
      expect(res.application.payment_status).toBe("verified");
    });

    it("ensures rejection requires a reason and does NOT mark payment as verified", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      // Missing rejection reason must fail
      const resNoReason = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-3",
        targetStatus: "rejected",
      });
      expect(resNoReason.success).toBe(false);
      expect(resNoReason.error).toContain("Rejection reason is mandatory");

      let rpcTargetStatus: string = "";

      vi.spyOn(db, "rpc").mockImplementation(((func: string, params: any) => {
        if (func === "rpc_admin_transition_application_status") {
          rpcTargetStatus = params.p_target_status;
          return Promise.resolve({
            data: {
              id: "app-uuid-gf-3",
              status: params.p_target_status,
              payment_status: "pending_verification", // STRICT: Payment remains pending/unverified
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }) as any);

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-3",
        targetStatus: "rejected",
        rejectionReason: "Prerequisites not met based on Google Sheet academic answers.",
      });

      expect(res.success).toBe(true);
      expect(rpcTargetStatus).toBe("rejected");
    });

    it("preserves strict document verification requirement for direct portal applications", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-direct-fail",
                source: "direct_portal",
                status: "under_review",
                documents_status: "pending", // Unverified documents
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-direct-fail",
        targetStatus: "approved",
      });

      // Must be rejected under DEC-03
      expect(res.success).toBe(false);
      expect(res.error).toContain("Candidate documents must be individually verified first");
    });
  });

  // ─── 7. Idempotency & Duplicate Handling ─────────────────────────────────────
  describe("Idempotency & Concurrent Duplicate Protection", () => {
    it("returns idempotent duplicate response when responseId was already processed", async () => {
      const existingApp = {
        id: "app-uuid-already-there",
        application_number: "APP-2026-01042",
        status: "under_review",
        payment_status: "verified",
        created_at: new Date().toISOString(),
      };

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === "external_submission_id" && val === "2_ABaOnuc_ALREADY_DONE") {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingApp, error: null }),
                };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
            }),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        return {} as any;
      });

      const payload = {
        responseId: "2_ABaOnuc_ALREADY_DONE",
        courseId: "bioplastic-innovation",
        studentName: "Existing Student",
        studentEmail: "student@example.com",
      };

      const signed = createSignedWebhookRequest(payload);
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(true);
      expect(result.code).toBe("DUPLICATE_SUBMISSION");
      expect(result.isDuplicate).toBe(true);
      expect(result.applicationNumber).toBe("APP-2026-01042");
    });

    it("handles concurrent duplicate submission race conditions via Postgres 23505 error", async () => {
      const duplicateApp = {
        id: "app-uuid-concurrent",
        application_number: "APP-2026-02088",
        status: "submitted",
        payment_status: "unpaid",
      };

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "23505", message: "duplicate key value violates unique constraint" },
                }),
              }),
            }),
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: duplicateApp, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const payload = {
        responseId: "2_ABaOnuc_CONCURRENT_RACE",
        courseId: "bioinformatics",
        studentName: "Concurrent Applicant",
        studentEmail: "concurrent@example.com",
      };

      const signed = createSignedWebhookRequest(payload);
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(true);
      expect(result.code).toBe("DUPLICATE_SUBMISSION");
      expect(result.isDuplicate).toBe(true);
      expect(result.applicationNumber).toBe("APP-2026-02088");
    });
  });

  // ─── 8. HTTP Endpoint Integration (/api/course-applications/webhook) ────
  describe("HTTP Endpoint Integration (/api/course-applications/webhook)", () => {
    it("returns HTTP 405 Method Not Allowed for GET requests", async () => {
      const request = new Request("http://localhost:3000/api/course-applications/webhook", {
        method: "GET",
      });

      const response = await handleCourseApplicationWebhookRequest(request);
      expect(response.status).toBe(405);
      const body = await response.json();
      expect(body.error).toContain("Method not allowed");
    });

    it("returns HTTP 401 when signature header is invalid", async () => {
      const request = new Request("http://localhost:3000/api/course-applications/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-signature": "0000000000000000000000000000000000000000000000000000000000000000",
          "x-webhook-timestamp": String(Date.now()),
        },
        body: JSON.stringify({ responseId: "2_ABaOnuc_1" }),
      });

      const response = await handleCourseApplicationWebhookRequest(request);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.code).toBe("INVALID_SIGNATURE");
    });

    it("returns HTTP 503 when secret is unconfigured", async () => {
      delete process.env.COURSE_APPLICATION_WEBHOOK_SECRET;

      const request = new Request("http://localhost:3000/api/course-applications/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-signature": "0000000000000000000000000000000000000000000000000000000000000000",
          "x-webhook-timestamp": String(Date.now()),
        },
        body: JSON.stringify({ responseId: "2_ABaOnuc_1" }),
      });

      const response = await handleCourseApplicationWebhookRequest(request);
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe("CONFIGURATION_ERROR");
    });
  });

  // ─── 9. Notification Worker Contract & Payload Alignment ─────────────────
  describe("Notification Worker Contract & Payload Alignment", () => {
    it("renders application_approved email with course title and student name from payload", () => {
      const email = renderNotificationEmail("application_approved", "", {
        application_number: "APP-2026-00042",
        student_name: "Aarav Sharma",
        course_id: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
        course_title: "BioPlastic Innovation",
      });

      expect(email.subject).toContain("BioPlastic Innovation");
      expect(email.subject).toContain("APP-2026-00042");
      expect(email.html).toContain("Aarav Sharma");
      expect(email.html).toContain("BioPlastic Innovation");
      expect(email.html).toContain("academically approved");
    });

    it("resolves course title from course_id when course_title is omitted in payload", () => {
      const email = renderNotificationEmail("application_approved", "Priya Verma", {
        application_number: "APP-2026-00043",
        course_id: "d6a21b1f-2682-4cf2-a83d-2c030f476625", // AI in Drug Discovery
      });

      expect(email.subject).toContain("AI in Drug Discovery");
      expect(email.html).toContain("Priya Verma");
      expect(email.html).toContain("AI in Drug Discovery");
    });

    it("resolves rejection reason from payload.reason or payload.rejection_reason", () => {
      const emailWithReason = renderNotificationEmail("application_rejected", "", {
        application_number: "APP-2026-00044",
        student_name: "Rohan Gupta",
        course_id: "bioinformatics",
        reason: "Prerequisite coursework in molecular biology missing.",
      });

      expect(emailWithReason.subject).toContain("APP-2026-00044");
      expect(emailWithReason.html).toContain("Prerequisite coursework in molecular biology missing.");
      expect(emailWithReason.html).toContain("Rohan Gupta");

      const emailWithRejectionReason = renderNotificationEmail("application_rejected", "Rohan Gupta", {
        application_number: "APP-2026-00044",
        course_id: "bioinformatics",
        rejection_reason: "Cohort seat quota reached for current cycle.",
      });

      expect(emailWithRejectionReason.html).toContain("Cohort seat quota reached for current cycle.");
    });

    it("resolves resubmission notes from payload.notes or payload.resubmission_notes", () => {
      const email = renderNotificationEmail("resubmission_required", "", {
        application_number: "APP-2026-00045",
        student_name: "Sneha Patel",
        course_id: "bioplastic-innovation",
        resubmission_notes: "Government photo ID scan is blurry. Please provide clear PDF.",
      });

      expect(email.subject).toContain("Action Required");
      expect(email.html).toContain("Government photo ID scan is blurry. Please provide clear PDF.");
      expect(email.html).toContain("Sneha Patel");
    });
  });

  // ─── 10. Strict Approval vs Enrollment Decoupling & Privacy Safeguards ───────
  describe("Approval vs Enrollment Decoupling & Privacy Safeguards", () => {
    it("approval does NOT insert into enrollments_users or automatically activate enrollment", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      let enrollmentTableQueried = false;
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "enrollments_users") {
          enrollmentTableQueried = true;
          return {
            insert: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          } as any;
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-gf-separate",
                source: "google_forms",
                status: "submitted",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      let rpcNameCalled = "";
      vi.spyOn(db, "rpc").mockImplementation(((fn: string, params: any) => {
        rpcNameCalled = fn;
        return Promise.resolve({
          data: {
            id: "app-uuid-gf-separate",
            status: "approved",
            payment_status: "verified",
            documents_status: "not_required",
            enrollment_id: null, // Strictly NULL upon approval
          },
          error: null,
        });
      }) as any);

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-gf-separate",
        confirmedSheetVerification: true,
        verificationNotes: "Payment verified in Google Sheets.",
      });

      expect(res.success).toBe(true);
      expect(rpcNameCalled).toBe("rpc_admin_approve_google_forms_application");
      expect(enrollmentTableQueried).toBe(false);
      expect(res.application?.enrollment_id).toBeNull();
      expect(res.application?.status).toBe("approved");
    });

    it("separate enrollment activation fails if application is not in approved status", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-unapproved",
                status: "submitted", // NOT approved
                payment_status: "verified",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-unapproved",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Application must be in 'approved' status first");
    });

    it("separate enrollment activation fails if payment is not verified", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-unpaid",
                status: "approved",
                payment_status: "unpaid", // NOT verified
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-unpaid",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Payment must be verified before activating enrollment");
    });

    it("separate enrollment activation succeeds when application is approved and payment is verified", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-ready-to-enroll",
                status: "approved",
                payment_status: "verified",
                student_email: "student@example.com",
                course_id: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
                user_id: "student-account-uuid-42",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "student-account-uuid-42", email: "student@example.com" },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      let rpcTargetStatus = "";
      vi.spyOn(db, "rpc").mockImplementation(((fn: string, params: any) => {
        rpcTargetStatus = params.p_target_status;
        return Promise.resolve({
          data: {
            id: "app-uuid-ready-to-enroll",
            status: "enrolled",
            enrollment_id: "enrollment-uuid-999",
            user_id: "student-account-uuid-42",
          },
          error: null,
        });
      }) as any);

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-ready-to-enroll",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(true);
      expect(rpcTargetStatus).toBe("enrolled");
      expect(res.application?.status).toBe("enrolled");
    });

    it("separate enrollment activation fails when applicant has no registered account in system", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-no-account",
                status: "approved",
                payment_status: "verified",
                student_email: "unregistered@example.com",
                course_id: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-no-account",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("No registered PathFinder student account exists");
    });

    it("separate enrollment activation automatically links user_id when student account exists in profile", async () => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-1",
        email: "admin@admin.com",
        role: "admin",
      });

      let linkedUserId = "";
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-uuid-claim-enroll",
                status: "approved",
                payment_status: "verified",
                student_email: "registered.student@example.com",
                course_id: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
                user_id: null,
              },
              error: null,
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              linkedUserId = payload.user_id;
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({
              data: [{ id: "student-account-found-uuid", email: "registered.student@example.com" }],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(db, "rpc").mockResolvedValue({
        data: {
          id: "app-uuid-claim-enroll",
          status: "enrolled",
          enrollment_id: "enrollment-uuid-888",
          user_id: "student-account-found-uuid",
        },
        error: null,
      } as any);

      const res = await adminTransitionApplicationCore({
        authToken: "valid_admin_token",
        applicationId: "app-uuid-claim-enroll",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(true);
      expect(res.application?.user_id).toBe("student-account-found-uuid");
      expect(res.application?.status).toBe("enrolled");
    });

    it("webhook supports GOOGLE_FORMS_WEBHOOK_SECRET when COURSE_APPLICATION_WEBHOOK_SECRET is unset", () => {
      delete process.env.COURSE_APPLICATION_WEBHOOK_SECRET;
      process.env.GOOGLE_FORMS_WEBHOOK_SECRET = TEST_SECRET;

      const secret = getCourseApplicationWebhookSecret();
      expect(secret).toBe(TEST_SECRET);
    });

    it("webhook accepts formResponseId as an alias for responseId", async () => {
      let insertedPayload: any = null;
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation((payload: any) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "app-uuid-alias",
                      application_number: "APP-2026-00099",
                      status: "submitted",
                      payment_status: "pending_verification",
                      documents_status: "not_required",
                    },
                    error: null,
                  }),
                }),
              };
            }),
          } as any;
        }
        return {} as any;
      });

      const payload = {
        formResponseId: "2_ABaOnuc_ALIAS_FIELD_TEST",
        courseId: "bioplastic-innovation",
        studentName: "Alias Student",
        studentEmail: "alias@example.com",
      };

      const signed = createSignedWebhookRequest(payload);
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(true);
      expect(insertedPayload?.external_submission_id).toBe("2_ABaOnuc_ALIAS_FIELD_TEST");
    });

    it("extra sensitive form fields (phone, whatsapp, transaction_id, drive_url) are discarded and never persisted", async () => {
      let insertedPayload: any = null;
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation((payload: any) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "app-uuid-privacy",
                      application_number: "APP-2026-00100",
                      status: "submitted",
                      payment_status: "pending_verification",
                      documents_status: "not_required",
                    },
                    error: null,
                  }),
                }),
              };
            }),
          } as any;
        }
        return {} as any;
      });

      const sensitivePayload = {
        responseId: "2_ABaOnuc_SENSITIVE_TEST",
        courseId: "bioinformatics",
        studentName: "Privacy Conscious Student",
        studentEmail: "privacy@example.com",
        studentPhone: "+919876543210",
        studentWhatsapp: "+919876543210",
        transactionId: "UPI-TRANSACTION-987654321",
        paymentProofDriveUrl: "https://drive.google.com/file/d/sensitive_payment_proof/view",
        bankName: "HDFC Bank",
      };

      const signed = createSignedWebhookRequest(sensitivePayload);
      const result = await processCourseApplicationWebhookCore(signed);

      expect(result.success).toBe(true);
      expect(insertedPayload).toBeDefined();
      expect(insertedPayload.student_phone).toBeNull();
      expect(insertedPayload.payment_reference).toBeNull();
      expect(insertedPayload.payment_amount_inr).toBeNull();
      expect(insertedPayload.statement_of_purpose).toBeNull();
      expect(insertedPayload.academic_background.google_forms.transactionId).toBeUndefined();
      expect(insertedPayload.academic_background.google_forms.paymentProofDriveUrl).toBeUndefined();
      expect(insertedPayload.academic_background.google_forms.studentWhatsapp).toBeUndefined();
    });

  describe("Section 5: Student Identity Linking & Separate Enrollment Activation Safety Suite", () => {
    const VALID_ADMIN_TOKEN = "valid_admin_auth_jwt";
    const DUMMY_COURSE_ID = "d2756643-0b82-4ebe-a123-9fa3be97bd13";

    beforeEach(() => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-super",
        email: "admin@micrylisbiotech.com",
        role: "admin",
      });
    });

    // 1. Exact email match succeeds
    it("1. Exact email match succeeds", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-1-exact",
                status: "approved",
                payment_status: "verified",
                student_email: "student.exact@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({
              data: [{ id: "profile-uuid-exact-1", email: "student.exact@example.com" }],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(db, "rpc").mockResolvedValue({
        data: {
          id: "app-1-exact",
          status: "enrolled",
          enrollment_id: "enrollment-uuid-exact-1",
          user_id: "profile-uuid-exact-1",
        },
        error: null,
      } as any);

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-1-exact",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(true);
      expect(res.application?.status).toBe("enrolled");
      expect(res.application?.user_id).toBe("profile-uuid-exact-1");
    });

    // 2. Case handling is consistent
    it("2. Case handling is consistent", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-2-case",
                status: "approved",
                payment_status: "verified",
                student_email: "Student.MixedCase@Example.COM",
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({
              data: [{ id: "profile-uuid-case-2", email: "student.mixedcase@example.com" }],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(db, "rpc").mockResolvedValue({
        data: {
          id: "app-2-case",
          status: "enrolled",
          enrollment_id: "enrollment-uuid-case-2",
          user_id: "profile-uuid-case-2",
        },
        error: null,
      } as any);

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-2-case",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(true);
      expect(res.application?.status).toBe("enrolled");
    });

    // 3. Wildcard characters cannot match another account
    it("3. Wildcard characters cannot match another account", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-3-wildcard",
                status: "approved",
                payment_status: "verified",
                student_email: "user_test@example.com", // Contains SQL wildcard '_'
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            // Un-escaped SQL would return userAtest@example.com because '_' matches 'A'
            ilike: vi.fn().mockResolvedValue({
              data: [{ id: "attacker-profile-uuid", email: "userAtest@example.com" }],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-3-wildcard",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("No registered PathFinder student account exists for 'user_test@example.com'");
    });

    // 4. No matching profile blocks enrollment
    it("4. No matching profile blocks enrollment", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-4-no-profile",
                status: "approved",
                payment_status: "verified",
                student_email: "ghost@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-4-no-profile",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("No registered PathFinder student account exists for 'ghost@example.com'");
    });

    // 5. Multiple or ambiguous matches block enrollment
    it("5. Multiple or ambiguous matches block enrollment", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-5-ambiguous",
                status: "approved",
                payment_status: "verified",
                student_email: "ambiguous@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({
              data: [
                { id: "profile-account-1", email: "ambiguous@example.com" },
                { id: "profile-account-2", email: "ambiguous@example.com" },
              ],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-5-ambiguous",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Ambiguous identity: Multiple matching student profiles found for 'ambiguous@example.com'");
    });

    // 6. Existing matching user_id is accepted
    it("6. Existing matching user_id is accepted", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-6-existing-user",
                status: "approved",
                payment_status: "verified",
                student_email: "valid.student@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: "valid-student-uuid-6",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "valid-student-uuid-6", email: "valid.student@example.com" },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(db, "rpc").mockResolvedValue({
        data: {
          id: "app-6-existing-user",
          status: "enrolled",
          enrollment_id: "enrollment-uuid-6",
          user_id: "valid-student-uuid-6",
        },
        error: null,
      } as any);

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-6-existing-user",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(true);
      expect(res.application?.status).toBe("enrolled");
      expect(res.application?.user_id).toBe("valid-student-uuid-6");
    });

    // 7. Existing mismatched user_id is rejected
    it("7. Existing mismatched user_id is rejected", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-7-mismatch",
                status: "approved",
                payment_status: "verified",
                student_email: "victim.student@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: "attacker-user-id-7",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "attacker-user-id-7", email: "attacker@malicious.com" },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-7-mismatch",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Security violation: Application user ID (attacker-user-id-7) email (attacker@malicious.com) does not match applicant email (victim.student@example.com)");
    });

    // 8. Enrollment before approval is rejected
    it("8. Enrollment before approval is rejected", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-8-unapproved",
                status: "submitted", // NOT approved
                payment_status: "verified",
                student_email: "applicant@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-8-unapproved",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot activate enrollment: Application must be in 'approved' status first (current status: 'submitted')");
    });

    // 9. Google Forms enrollment without verified payment is rejected
    it("9. Google Forms enrollment without verified payment is rejected", async () => {
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-9-unverified-payment",
                status: "approved",
                payment_status: "pending_verification", // NOT verified
                student_email: "applicant@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: null,
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-9-unverified-payment",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot activate enrollment: Payment must be verified before activating enrollment (current payment status: 'pending_verification')");
    });

    // 10. Duplicate enrollment is prevented
    it("10. Duplicate enrollment is prevented", async () => {
      // Scenario A: Transition requested on application already enrolled
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-10-already-enrolled",
                status: "enrolled", // Already enrolled
                payment_status: "verified",
                student_email: "already.enrolled@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: "user-10-uuid",
              },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-10-already-enrolled",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Cannot activate enrollment: Application must be in 'approved' status first (current status: 'enrolled')");

      // Scenario B: Database RPC fails closed if duplicate enrollment conflict is detected
      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-10-dup-rpc",
                status: "approved",
                payment_status: "verified",
                student_email: "duplicate.student@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: "user-10-uuid",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "user-10-uuid", email: "duplicate.student@example.com" },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.spyOn(db, "rpc").mockResolvedValue({
        data: null,
        error: {
          code: "23505",
          message: "Student already enrolled in this course.",
        },
      } as any);

      const rpcConflictRes = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-10-dup-rpc",
        targetStatus: "enrolled",
      });

      expect(rpcConflictRes.success).toBe(false);
      expect(rpcConflictRes.error).toContain("Student already enrolled in this course.");
    });

    // 11. Approval never creates enrollment
    it("11. Approval never creates enrollment", async () => {
      let rpcNameCalled = "";
      let enrollmentsInsertCalled = false;

      vi.spyOn(db, "rpc").mockImplementation(((fn: string, params: any) => {
        rpcNameCalled = fn;
        return Promise.resolve({
          data: {
            id: "app-11-approval-only",
            status: "approved",
            payment_status: "verified",
            enrollment_id: null,
          },
          error: null,
        });
      }) as any);

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-11-approval-only",
                source: "google_forms",
                status: "submitted",
                payment_status: "pending_verification",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "enrollments_users") {
          enrollmentsInsertCalled = true;
        }
        return {} as any;
      });

      const res = await adminApproveGoogleFormsApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-11-approval-only",
        confirmedSheetVerification: true,
      });

      expect(res.success).toBe(true);
      expect(res.application?.status).toBe("approved");
      expect(res.application?.status).not.toBe("enrolled");
      expect(res.application?.enrollment_id).toBeNull();
      expect(rpcNameCalled).toBe("rpc_admin_approve_google_forms_application");
      expect(enrollmentsInsertCalled).toBe(false);
    });

    // 12. Failed enrollment does not leave an inconsistent identity link
    it("12. Failed enrollment does not leave an inconsistent identity link", async () => {
      let updateCourseAppsCalled = false;

      vi.spyOn(db, "from").mockImplementation((table: string) => {
        if (table === "courses") {
          return createMockCoursesQueryBuilder();
        }
        if (table === "course_applications") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "app-12-rollback",
                status: "approved",
                payment_status: "verified",
                student_email: "rollback.candidate@example.com",
                course_id: DUMMY_COURSE_ID,
                user_id: null, // user_id is null before enrollment
              },
              error: null,
            }),
            update: vi.fn().mockImplementation(() => {
              updateCourseAppsCalled = true;
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          } as any;
        }
        if (table === "profile") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({
              data: [{ id: "candidate-user-12", email: "rollback.candidate@example.com" }],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      // Stored procedure fails during enrollment activation
      vi.spyOn(db, "rpc").mockResolvedValue({
        data: null,
        error: {
          code: "40001",
          message: "Transaction serialization failure during enrollment activation.",
        },
      } as any);

      const res = await adminTransitionApplicationCore({
        authToken: VALID_ADMIN_TOKEN,
        applicationId: "app-12-rollback",
        targetStatus: "enrolled",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Transaction serialization failure");
      // Critical check: course_applications.update was NOT executed prior to the failed RPC,
      // guaranteeing that no inconsistent identity link is persisted outside the failed transaction!
      expect(updateCourseAppsCalled).toBe(false);
    });
  });

  // ─── 9. Safe Diagnostic Ping & Identity Conflict Remediation Suite ──────────
  describe("Remediation Suite: Safe Diagnostic Ping & Identity Conflict Quarantine", () => {
    const VALID_ADMIN_TOKEN = "valid_admin_auth_jwt";
    const DUMMY_COURSE_ID = "d2756643-0b82-4ebe-a123-9fa3be97bd13";

    beforeEach(() => {
      vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
        isValid: true,
        userId: "admin-uuid-remediation",
        email: "admin@micrylisbiotech.com",
        role: "admin",
      });
    });

    // ── Diagnostic Ping Tests ──
    describe("Safe In-Band Diagnostic Ping", () => {
      it("returns DIAGNOSTIC_PONG and performs ZERO database writes when valid diagnostic ping is received", async () => {
        let dbFromCalled = false;
        let dbRpcCalled = false;

        vi.spyOn(db, "from").mockImplementation((() => {
          dbFromCalled = true;
          return {} as any;
        }) as any);

        vi.spyOn(db, "rpc").mockImplementation((() => {
          dbRpcCalled = true;
          return Promise.resolve({ data: null, error: null }) as any;
        }) as any);

        const diagnosticPayload = {
          diagnostic: true,
          action: "ping",
          timestamp: Date.now(),
        };

        const signed = createSignedWebhookRequest(diagnosticPayload);
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(result.code).toBe("DIAGNOSTIC_PONG");
        expect(result.message).toContain("diagnostic ping successful");
        expect(dbFromCalled).toBe(false);
        expect(dbRpcCalled).toBe(false);
      });

      it("handles diagnostic ping via handleCourseApplicationWebhookRequest returning HTTP 200", async () => {
        const pingPayload = {
          diagnostic: true,
          action: "ping",
          timestamp: Date.now(),
        };
        const rawBody = JSON.stringify(pingPayload);
        const timestamp = String(Date.now());
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": timestamp,
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.code).toBe("DIAGNOSTIC_PONG");
      });

      it("handles diagnostic ping with x-vercel-protection-bypass header present returning HTTP 200", async () => {
        const pingPayload = {
          diagnostic: true,
          action: "ping",
          timestamp: Date.now(),
        };
        const rawBody = JSON.stringify(pingPayload);
        const timestamp = String(Date.now());
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": timestamp,
            "x-vercel-protection-bypass": "test-vercel-automation-bypass-secret-12345",
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.code).toBe("DIAGNOSTIC_PONG");
      });

      it("diagnostic ping fails closed if signature is invalid", async () => {
        const pingPayload = {
          diagnostic: true,
          action: "ping",
          timestamp: Date.now(),
        };

        const signed = createSignedWebhookRequest(pingPayload, { tamperSignature: true });
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(false);
        expect(result.code).toBe("INVALID_SIGNATURE");
      });

      it("diagnostic ping fails closed if timestamp is expired", async () => {
        const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 mins ago
        const pingPayload = {
          diagnostic: true,
          action: "ping",
          timestamp: oldTimestamp,
        };

        const signed = createSignedWebhookRequest(pingPayload, { timestamp: oldTimestamp });
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(false);
        expect(result.code).toBe("EXPIRED_TIMESTAMP");
      });
    });

    // ── Identity Conflict Ingestion Tests ──
    describe("Identity Conflict Detection & Quarantine Ingestion", () => {
      it("ingestion with matching respondent & entered emails marks is_identity_conflict: false", async () => {
        let insertedPayload: any = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                insertedPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-match-123",
                        application_number: "APP-2026-09001",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                        is_identity_conflict: false,
                        respondent_email: "matching.student@example.com",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          if (table === "profile") {
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockResolvedValue({
                data: [{ id: "user-matching-uuid", email: "matching.student@example.com" }],
                error: null,
              }),
            } as any;
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const payload: CourseApplicationWebhookPayload = {
          responseId: "2_ABaOnuc_MATCHING_ID",
          timestamp: Date.now(),
          courseId: "bioplastic-innovation",
          studentName: "Matching Student",
          studentEmail: "matching.student@example.com",
          respondentEmail: "matching.student@example.com",
        };

        const signed = createSignedWebhookRequest(payload);
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(insertedPayload).toBeDefined();
        expect(insertedPayload.is_identity_conflict).toBe(false);
        expect(insertedPayload.respondent_email).toBe("matching.student@example.com");
        expect(insertedPayload.user_id).toBeNull();
        expect(insertedPayload.academic_background.google_forms.identity_conflict).toBe(false);
      });

      it("ingestion with case-differing emails normalizes cleanly without identity conflict", async () => {
        let insertedPayload: any = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                insertedPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-case-123",
                        application_number: "APP-2026-09002",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const payload: CourseApplicationWebhookPayload = {
          responseId: "2_ABaOnuc_CASE_DIFF",
          timestamp: Date.now(),
          courseId: "bioplastic-innovation",
          studentName: "Case Student",
          studentEmail: "  Jane.Doe@EXAMPLE.com ",
          respondentEmail: "JANE.DOE@example.com",
        };

        const signed = createSignedWebhookRequest(payload);
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(insertedPayload.is_identity_conflict).toBe(false);
        expect(insertedPayload.respondent_email).toBe("jane.doe@example.com");
        expect(insertedPayload.student_email).toBe("jane.doe@example.com");
      });

      it("ingestion with mismatched emails sets is_identity_conflict: true and forces user_id: null", async () => {
        let insertedPayload: any = null;
        let eventInserted: any = null;
        let auditLogInserted: any = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                insertedPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-conflict-123",
                        application_number: "APP-2026-09003",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                        is_identity_conflict: true,
                        respondent_email: "parent.google@gmail.com",
                        student_email: "child.student@school.edu",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          if (table === "profile") {
            // Even if child profile exists, quarantine must force user_id: null!
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockResolvedValue({
                data: [{ id: "child-user-uuid", email: "child.student@school.edu" }],
                error: null,
              }),
            } as any;
          }
          if (table === "course_application_events") {
            return {
              insert: vi.fn().mockImplementation((event: any) => {
                eventInserted = event;
                return Promise.resolve({ data: null, error: null });
              }),
            } as any;
          }
          if (table === "course_application_audit_logs") {
            return {
              insert: vi.fn().mockImplementation((log: any) => {
                auditLogInserted = log;
                return Promise.resolve({ data: null, error: null });
              }),
            } as any;
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const payload: CourseApplicationWebhookPayload = {
          responseId: "2_ABaOnuc_MISMATCH_ID",
          timestamp: Date.now(),
          courseId: "ai-in-drug-discovery",
          studentName: "Child Student",
          studentEmail: "child.student@school.edu",
          respondentEmail: "parent.google@gmail.com",
        };

        const signed = createSignedWebhookRequest(payload);
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(insertedPayload).toBeDefined();
        expect(insertedPayload.is_identity_conflict).toBe(true);
        expect(insertedPayload.respondent_email).toBe("parent.google@gmail.com");
        expect(insertedPayload.user_id).toBeNull(); // Must NOT auto-link when in conflict!
        expect(insertedPayload.academic_background.google_forms.identity_conflict).toBe(true);
        expect(insertedPayload.academic_background.google_forms.respondent_email).toBe("parent.google@gmail.com");

        expect(eventInserted).toBeDefined();
        expect(eventInserted.title).toContain("Quarantined: Identity Conflict");
        expect(eventInserted.description).toContain("Quarantined due to mismatch");

        expect(auditLogInserted).toBeDefined();
        expect(auditLogInserted.action).toBe("INGEST_GOOGLE_FORMS_SUBMISSION_QUARANTINED");
        expect(auditLogInserted.notes).toContain("identity conflict");
      });

      it("ingestion without respondentEmail falls back cleanly without conflict", async () => {
        let insertedPayload: any = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                insertedPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-noresp-123",
                        application_number: "APP-2026-09004",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const payload: CourseApplicationWebhookPayload = {
          responseId: "2_ABaOnuc_NO_RESP",
          timestamp: Date.now(),
          courseId: "bioinformatics",
          studentName: "Solo Student",
          studentEmail: "solo@example.com",
        };

        const signed = createSignedWebhookRequest(payload);
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(insertedPayload.is_identity_conflict).toBe(false);
        expect(insertedPayload.respondent_email).toBeNull();
      });
    });

    // ── Quarantine Enforcement in Approvals & Status Transitions ──
    describe("Quarantine Enforcement in Approvals & Transitions", () => {
      it("adminApproveGoogleFormsApplicationCore blocks approval when is_identity_conflict is true", async () => {
        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "app-blocked-approval",
                  source: "google_forms",
                  status: "submitted",
                  payment_status: "pending_verification",
                  is_identity_conflict: true,
                  respondent_email: "parent@gmail.com",
                  student_email: "child@school.edu",
                },
                error: null,
              }),
            } as any;
          }
          return {} as any;
        });

        const res = await adminApproveGoogleFormsApplicationCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-blocked-approval",
          confirmedSheetVerification: true,
        });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/identity conflict/i);
      });

      it("adminTransitionApplicationCore blocks approved transition when is_identity_conflict is true", async () => {
        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "app-blocked-transition",
                  status: "submitted",
                  payment_status: "verified",
                  is_identity_conflict: true,
                  academic_background: { google_forms: { isIdentityConflict: true } },
                },
                error: null,
              }),
            } as any;
          }
          return {} as any;
        });

        const res = await adminTransitionApplicationCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-blocked-transition",
          targetStatus: "approved",
        });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/identity conflict/i);
      });

      it("adminTransitionApplicationCore blocks enrolled transition when is_identity_conflict is true", async () => {
        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "app-blocked-enrolled",
                  status: "approved",
                  payment_status: "verified",
                  is_identity_conflict: true,
                  academic_background: { google_forms: { isIdentityConflict: true } },
                },
                error: null,
              }),
            } as any;
          }
          return {} as any;
        });

        const res = await adminTransitionApplicationCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-blocked-enrolled",
          targetStatus: "enrolled",
        });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/identity conflict/i);
      });
    });

    // ── Admin Identity Conflict Reconciliation Workflow ──
    describe("Admin Identity Conflict Reconciliation Workflow", () => {
      it("adminReconcileIdentityConflictCore successfully resolves conflict via RPC", async () => {
        vi.spyOn(db, "rpc").mockResolvedValue({
          data: {
            id: "app-reconciled-uuid",
            is_identity_conflict: false,
            student_email: "reconciled.student@example.com",
            academic_background: {
              google_forms: {
                identity_conflict: false,
                identity_reconciled: true,
                reconciled_at: new Date().toISOString(),
              },
            },
          },
          error: null,
        } as any);

        const res = await adminReconcileIdentityConflictCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-reconciled-uuid",
          chosenAuthoritativeEmail: "reconciled.student@example.com",
          reconciliationNotes: "Confirmed valid identity by checking institutional student ID card.",
        });

        expect(res.success).toBe(true);
        expect(res.application?.is_identity_conflict).toBe(false);
        expect(res.application?.student_email).toBe("reconciled.student@example.com");
      });

      it("adminReconcileIdentityConflictCore fails closed on invalid email format", async () => {
        const res = await adminReconcileIdentityConflictCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-reconciled-uuid",
          chosenAuthoritativeEmail: "not-a-valid-email",
          reconciliationNotes: "Confirmed valid identity by checking institutional student ID card.",
        });

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/valid.*email/i);
      });

      it("adminReconcileIdentityConflictCore fails closed when caller is not an admin", async () => {
        vi.spyOn(adminGuard, "verifyAdminSession").mockResolvedValue({
          isValid: false,
          error: "Invalid session token",
        });

        const res = await adminReconcileIdentityConflictCore({
          authToken: "invalid_admin_token",
          applicationId: "app-reconciled-uuid",
          chosenAuthoritativeEmail: "authoritative@example.com",
          reconciliationNotes: "Notes here",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("Unauthorized");
      });

      it("adminReconcileIdentityConflictCore fails fast when RPC rejects non-google_forms application", async () => {
        vi.spyOn(db, "rpc").mockResolvedValue({
          data: null,
          error: {
            code: "23514",
            message: "Cannot reconcile application: Application source is web (reconciliation is only permitted for google_forms applications).",
          },
        } as any);

        const res = await adminReconcileIdentityConflictCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-web-uuid",
          chosenEmail: "reconciled@example.com",
          notes: "Verification notes here.",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("only permitted for google_forms");
      });

      it("adminReconcileIdentityConflictCore fails fast when RPC rejects application without active conflict", async () => {
        vi.spyOn(db, "rpc").mockResolvedValue({
          data: null,
          error: {
            code: "23514",
            message: "Cannot reconcile application: Application does not have an unresolved identity conflict.",
          },
        } as any);

        const res = await adminReconcileIdentityConflictCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-noconflict-uuid",
          chosenEmail: "reconciled@example.com",
          notes: "Verification notes here.",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("does not have an unresolved identity conflict");
      });

      it("adminReconcileIdentityConflictCore service fallback rejects non-google_forms application", async () => {
        // Mock RPC missing (42883) to trigger fallback path
        vi.spyOn(db, "rpc").mockResolvedValue({
          data: null,
          error: { code: "42883", message: "function rpc_admin_reconcile_identity_conflict does not exist" },
        } as any);

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "app-direct-web",
                  source: "web", // Direct portal, not google_forms
                  is_identity_conflict: true,
                  student_email: "web.student@example.com",
                },
                error: null,
              }),
            } as any;
          }
          return {} as any;
        });

        const res = await adminReconcileIdentityConflictCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-direct-web",
          chosenEmail: "web.student@example.com",
          notes: "Attempting reconciliation on direct web submission.",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("only permitted for google_forms");
      });

      it("adminReconcileIdentityConflictCore service fallback rejects application without active conflict", async () => {
        // Mock RPC missing (42883) to trigger fallback path
        vi.spyOn(db, "rpc").mockResolvedValue({
          data: null,
          error: { code: "42883", message: "function rpc_admin_reconcile_identity_conflict does not exist" },
        } as any);

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createMockCoursesQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "app-gf-noconflict",
                  source: "google_forms",
                  is_identity_conflict: false, // No conflict
                  academic_background: { google_forms: { identity_conflict: false } },
                  student_email: "normal.student@example.com",
                },
                error: null,
              }),
            } as any;
          }
          return {} as any;
        });

        const res = await adminReconcileIdentityConflictCore({
          authToken: VALID_ADMIN_TOKEN,
          applicationId: "app-gf-noconflict",
          chosenEmail: "normal.student@example.com",
          notes: "Attempting reconciliation on unconflicted submission.",
        });

        expect(res.success).toBe(false);
        expect(res.error).toContain("does not have an unresolved identity conflict");
      });
    });
  });

  // ─── Phase 4.5G: Dynamic Webhook Course Resolution & Persistence Protection Suite ─
  describe("Phase 4.5G — Dynamic Webhook Course Resolution & Persistence Protection", () => {
    const PROD_BIO_UUID = "6801f93f-2d3b-4841-81c2-fa4b1a27fc64";
    const STAGING_BIO_UUID = "d2756643-0b82-4ebe-a123-9fa3be97bd13";
    const PROD_DRUG_UUID = "16dcf034-706d-4d7a-b1db-55bb247e1997";
    const PROD_BIOINFO_UUID = "619be200-e170-4f38-89c5-c2d1b71c1ad2";

    const PROD_DATABASE_COURSES = [
      {
        id: PROD_BIO_UUID,
        slug: "bioplastic-innovation",
        title: "BioPlastic Innovation",
      },
      {
        id: PROD_DRUG_UUID,
        slug: "ai-in-drug-discovery",
        title: "AI in Drug Discovery",
      },
      {
        id: PROD_BIOINFO_UUID,
        slug: "bioinformatics",
        title: "Bioinformatics & Genomic Data Analysis",
      },
    ];

    function createProdCoursesMockQueryBuilder() {
      return createMockCoursesQueryBuilder(PROD_DATABASE_COURSES);
    }

    // ── 1. Successful Resolution ──
    describe("1. Successful Resolution", () => {
      it("1. Production UUID resolves to the database row", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase({ courseId: PROD_BIO_UUID }, mockClient);

        expect(res.success).toBe(true);
        expect(res.course?.id).toBe(PROD_BIO_UUID);
        expect(res.course?.slug).toBe("bioplastic-innovation");
        expect(res.course?.title).toBe("BioPlastic Innovation");
        expect(res.httpStatus).toBe(200);
      });

      it("2. Course slug resolves to the database row", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase({ courseSlug: "bioplastic-innovation" }, mockClient);

        expect(res.success).toBe(true);
        expect(res.course?.id).toBe(PROD_BIO_UUID);
        expect(res.course?.slug).toBe("bioplastic-innovation");
      });

      it("3. Documented legacy alias resolves to the database row", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase({ courseId: "course-bioplastic-innovation" }, mockClient);

        expect(res.success).toBe(true);
        expect(res.course?.id).toBe(PROD_BIO_UUID);
        expect(res.course?.slug).toBe("bioplastic-innovation");
      });

      it("4. Production UUID plus matching slug succeeds", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          { courseId: PROD_BIO_UUID, courseSlug: "bioplastic-innovation" },
          mockClient
        );

        expect(res.success).toBe(true);
        expect(res.course?.id).toBe(PROD_BIO_UUID);
      });

      it("5. Multiple equivalent identifiers succeed", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          {
            courseId: PROD_BIO_UUID,
            course_id: PROD_BIO_UUID,
            courseSlug: "bioplastic-innovation",
            course: "course-bioplastic-innovation",
          },
          mockClient
        );

        expect(res.success).toBe(true);
        expect(res.course?.id).toBe(PROD_BIO_UUID);
      });

      it("6. The application insertion receives the database-returned UUID", async () => {
        let insertedPayload: any = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createProdCoursesMockQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                insertedPayload = payload;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-prod-uuid-test",
                        application_number: "APP-2026-09999",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_PROD_INSERT_TEST",
          courseSlug: "bioplastic-innovation",
          studentName: "Prod Student",
          studentEmail: "prod.student@example.com",
        };

        const signed = createSignedWebhookRequest(payload);
        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(result.courseId).toBe(PROD_BIO_UUID);
        expect(insertedPayload).not.toBeNull();
        expect(insertedPayload.course_id).toBe(PROD_BIO_UUID);
      });
    });

    // ── 2. Rejection Cases ──
    describe("2. Rejection Cases", () => {
      it("7. Missing course identifier", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase({}, mockClient);

        expect(res.success).toBe(false);
        expect(res.code).toBe("MISSING_COURSE_IDENTIFIER");
        expect(res.httpStatus).toBe(400);

        const signed = createSignedWebhookRequest({
          responseId: "2_ABaOnuc_MISSING_COURSE",
          studentName: "No Course Student",
          studentEmail: "nocourse@example.com",
        });
        const result = await processCourseApplicationWebhookCore(signed);
        expect(result.success).toBe(false);
        expect(result.code).toBe("MISSING_COURSE_IDENTIFIER");
      });

      it("8. Empty or whitespace-only identifier", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase({ courseId: "   " }, mockClient);

        expect(res.success).toBe(false);
        expect(res.code).toBe("MALFORMED_COURSE_IDENTIFIER");
        expect(res.message).toContain("empty or whitespace only");
        expect(res.httpStatus).toBe(400);
      });

      it("9. Non-string populated field", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase({ courseId: 12345 as any }, mockClient);

        expect(res.success).toBe(false);
        expect(res.code).toBe("MALFORMED_COURSE_IDENTIFIER");
        expect(res.message).toContain("must be a string");
        expect(res.httpStatus).toBe(400);
      });

      it("10. Malformed UUID", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        // 35 characters instead of 36
        const res = await resolveCourseFromDatabase(
          { courseId: "6801f93f-2d3b-4841-81c2-fa4b1a27fc6" },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("MALFORMED_COURSE_IDENTIFIER");
        expect(res.message).toContain("Malformed UUID");
        expect(res.httpStatus).toBe(400);
      });

      it("11. Invalid slug", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          { courseSlug: "invalid slug with spaces and !@#" },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("MALFORMED_COURSE_IDENTIFIER");
        expect(res.message).toContain("Invalid course slug format");
        expect(res.httpStatus).toBe(400);
      });

      it("12. Unknown UUID", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          { courseId: "00000000-0000-0000-0000-000000000000" },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("UNKNOWN_COURSE");
        expect(res.message).toContain("Course not found for identifier");
        expect(res.httpStatus).toBe(400);
      });

      it("13. Unknown slug", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          { courseSlug: "unknown-quantum-biophysics" },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("UNKNOWN_COURSE");
        expect(res.message).toContain("Course not found for slug");
        expect(res.httpStatus).toBe(400);
      });

      it("14. Conflicting UUID and slug", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        // courseId for BioPlastic, slug for AI in Drug Discovery
        const res = await resolveCourseFromDatabase(
          {
            courseId: PROD_BIO_UUID,
            courseSlug: "ai-in-drug-discovery",
          },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("CONFLICTING_COURSE_IDENTIFIERS");
        expect(res.message).toContain("Conflicting course identifiers");
        expect(res.httpStatus).toBe(400);
      });

      it("15. Two identifiers resolving to different courses", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          {
            courseId: "bioplastic-innovation",
            courseSlug: "bioinformatics",
          },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("CONFLICTING_COURSE_IDENTIFIERS");
        expect(res.message).toContain("Conflicting course identifiers");
        expect(res.httpStatus).toBe(400);
      });

      it("16. Unknown legacy alias", async () => {
        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const res = await resolveCourseFromDatabase(
          { courseId: "course-quantum-computing" },
          mockClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("UNKNOWN_COURSE");
        expect(res.message).toContain("Unknown course legacy alias");
        expect(res.httpStatus).toBe(400);
      });
    });

    // ── 3. Database Failures (Fail-Closed) ──
    describe("3. Database Failures (Fail-Closed)", () => {
      it("17. UUID lookup error fails closed with DATABASE_LOOKUP_ERROR (500)", async () => {
        const errorClient = {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { code: "50000", message: "Connection timeout to replica" },
                }),
              }),
            }),
          }),
        };

        const res = await resolveCourseFromDatabase({ courseId: PROD_BIO_UUID }, errorClient);

        expect(res.success).toBe(false);
        expect(res.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(res.httpStatus).toBe(500);
      });

      it("18. Slug lookup error fails closed with DATABASE_LOOKUP_ERROR (500)", async () => {
        const errorClient = {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { code: "57014", message: "Query canceled due to statement timeout" },
                }),
              }),
            }),
          }),
        };

        const res = await resolveCourseFromDatabase(
          { courseSlug: "bioplastic-innovation" },
          errorClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(res.httpStatus).toBe(500);
      });

      it("19. Alias lookup error fails closed with DATABASE_LOOKUP_ERROR (500)", async () => {
        const errorClient = {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { code: "08006", message: "Connection failure during alias query" },
                }),
              }),
            }),
          }),
        };

        const res = await resolveCourseFromDatabase(
          { courseId: "course-bioplastic-innovation" },
          errorClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(res.httpStatus).toBe(500);
      });

      it("20. Network/exception failure fails closed with DATABASE_LOOKUP_ERROR (500)", async () => {
        const throwingClient = {
          from: () => {
            throw new Error("fetch failed: socket hang up");
          },
        };

        const res = await resolveCourseFromDatabase(
          { courseSlug: "bioplastic-innovation" },
          throwingClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(res.httpStatus).toBe(500);
      });

      it("21. Unexpected database response fails closed with DATABASE_LOOKUP_ERROR (500)", async () => {
        const malformedRecordClient = {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { some_irrelevant_field: 123 }, // Missing id, slug, title
                  error: null,
                }),
              }),
            }),
          }),
        };

        const res = await resolveCourseFromDatabase(
          { courseSlug: "bioplastic-innovation" },
          malformedRecordClient
        );

        expect(res.success).toBe(false);
        expect(res.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(res.message).toBe("An internal database error occurred while resolving course identity. Please retry shortly.");
        expect(res.httpStatus).toBe(500);
      });
    });

    // ── 4. Persistence Protection ──
    describe("4. Persistence Protection & Invariant Verification", () => {
      it("22. A slug must never be converted into a Staging UUID for insertion", async () => {
        let persistedCourseId: string | null = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createProdCoursesMockQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                persistedCourseId = payload.course_id;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-prod-invariant-1",
                        application_number: "APP-2026-09001",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const signed = createSignedWebhookRequest({
          responseId: "2_ABaOnuc_SLUG_CONVERSION_GUARD",
          courseSlug: "bioplastic-innovation",
          studentName: "Guard Student",
          studentEmail: "guard@example.com",
        });

        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        // INVARIANT: Must be Production UUID
        expect(persistedCourseId).toBe(PROD_BIO_UUID);
        // CRITICAL: Must NEVER be the Staging UUID
        expect(persistedCourseId).not.toBe(STAGING_BIO_UUID);
      });

      it("23. A Production UUID must remain unchanged during resolution and persistence", async () => {
        let persistedCourseId: string | null = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createProdCoursesMockQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                persistedCourseId = payload.course_id;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-prod-invariant-2",
                        application_number: "APP-2026-09002",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const signed = createSignedWebhookRequest({
          responseId: "2_ABaOnuc_PROD_UUID_UNCHANGED",
          courseId: PROD_BIO_UUID,
          studentName: "Prod Student 2",
          studentEmail: "prod2@example.com",
        });

        const result = await processCourseApplicationWebhookCore(signed);

        expect(result.success).toBe(true);
        expect(result.courseId).toBe(PROD_BIO_UUID);
        expect(persistedCourseId).toBe(PROD_BIO_UUID);
      });

      it("24. The inserted course_id must equal the database resolver's returned id", async () => {
        let persistedCourseId: string | null = null;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createProdCoursesMockQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockImplementation((payload: any) => {
                persistedCourseId = payload.course_id;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: "app-prod-invariant-3",
                        application_number: "APP-2026-09003",
                        status: "submitted",
                        payment_status: "pending_verification",
                        documents_status: "not_required",
                      },
                      error: null,
                    }),
                  }),
                };
              }),
            } as any;
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        });

        const mockClient = { from: () => createProdCoursesMockQueryBuilder() };
        const resolution = await resolveCourseFromDatabase(
          { courseSlug: "ai-in-drug-discovery" },
          mockClient
        );

        expect(resolution.success).toBe(true);
        const resolvedId = resolution.course?.id;

        const signed = createSignedWebhookRequest({
          responseId: "2_ABaOnuc_EQUAL_RESOLVER_ID",
          courseSlug: "ai-in-drug-discovery",
          studentName: "Drug Discovery Student",
          studentEmail: "drug@example.com",
        });

        await processCourseApplicationWebhookCore(signed);

        expect(persistedCourseId).toBe(resolvedId);
        expect(persistedCourseId).toBe(PROD_DRUG_UUID);
      });

      it("25. HTTP endpoint returns 500 when database lookup fails", async () => {
        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { code: "50000", message: "Database lookup failed catastrophically" },
                  }),
                }),
              }),
            } as any;
          }
          return {} as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_HTTP_500_TEST",
          courseSlug: "bioplastic-innovation",
          studentName: "Error Student",
          studentEmail: "err@example.com",
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(Date.now()),
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.code).toBe("DATABASE_LOOKUP_ERROR");
      });
    });

    // ── 5. Phase 4.5G-W: HTTP Error Response Sanitization Suite ──
    describe("5. Phase 4.5G-W: HTTP Error Response Sanitization Suite", () => {
      const GENERIC_COURSE_LOOKUP_ERROR =
        "An internal database error occurred while resolving course identity. Please retry shortly.";
      const GENERIC_INSERT_ERROR =
        "An internal database error occurred while saving the application. Please retry shortly.";

      it("W1. UUID lookup query error with fake sensitive DB message returns generic message and HTTP 500", async () => {
        const FAKE_SENSITIVE_DB_MSG = "FATAL: relation \"pg_catalog.pg_user\" does not exist at line 42; role \"postgres_internal_admin\"";

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { code: "42P01", message: FAKE_SENSITIVE_DB_MSG },
                  }),
                }),
              }),
            } as any;
          }
          return {} as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_UUID_QUERY_ERR_TEST",
          courseId: PROD_BIO_UUID,
          studentName: "Sanitization Test",
          studentEmail: "sanitization@example.com",
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(Date.now()),
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(500);

        const responseText = await response.text();
        const body = JSON.parse(responseText);

        expect(body.success).toBe(false);
        expect(body.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(body.message).toBe(GENERIC_COURSE_LOOKUP_ERROR);

        // STRICT PRIVACY ASSERTIONS: Injected sensitive strings MUST NOT appear in the HTTP response
        expect(responseText).not.toContain(FAKE_SENSITIVE_DB_MSG);
        expect(responseText).not.toContain("pg_catalog");
        expect(responseText).not.toContain("postgres_internal_admin");
        expect(responseText).not.toContain("FATAL");
      });

      it("W2. UUID lookup network exception with fake Supabase hostname returns generic message and HTTP 500", async () => {
        const FAKE_SUPABASE_HOST = "db.fake-project-999.supabase.co:5432";
        const FAKE_EXCEPTION_MSG = `fetch failed: connection timeout to ${FAKE_SUPABASE_HOST}`;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    throw new Error(FAKE_EXCEPTION_MSG);
                  },
                }),
              }),
            } as any;
          }
          return {} as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_UUID_NET_ERR_TEST",
          courseId: PROD_BIO_UUID,
          studentName: "Sanitization Test",
          studentEmail: "sanitization@example.com",
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(Date.now()),
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(500);

        const responseText = await response.text();
        const body = JSON.parse(responseText);

        expect(body.success).toBe(false);
        expect(body.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(body.message).toBe(GENERIC_COURSE_LOOKUP_ERROR);

        // STRICT PRIVACY ASSERTIONS: Supabase hostname/port MUST NOT appear in response
        expect(responseText).not.toContain(FAKE_SUPABASE_HOST);
        expect(responseText).not.toContain("fake-project-999");
        expect(responseText).not.toContain("5432");
      });

      it("W3. Slug lookup query error with fake SQL/schema details returns generic message and HTTP 500", async () => {
        const FAKE_SQL_SCHEMA_MSG = "syntax error at or near \"courses_secret_tbl\" (SQLSTATE 42601) SELECT secret_token FROM internal_keys";

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { code: "42601", message: FAKE_SQL_SCHEMA_MSG },
                  }),
                }),
              }),
            } as any;
          }
          return {} as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_SLUG_QUERY_ERR_TEST",
          courseSlug: "bioplastic-innovation",
          studentName: "Sanitization Test",
          studentEmail: "sanitization@example.com",
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(Date.now()),
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(500);

        const responseText = await response.text();
        const body = JSON.parse(responseText);

        expect(body.success).toBe(false);
        expect(body.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(body.message).toBe(GENERIC_COURSE_LOOKUP_ERROR);

        // STRICT PRIVACY ASSERTIONS: SQL and internal table names MUST NOT appear in response
        expect(responseText).not.toContain(FAKE_SQL_SCHEMA_MSG);
        expect(responseText).not.toContain("courses_secret_tbl");
        expect(responseText).not.toContain("internal_keys");
        expect(responseText).not.toContain("SQLSTATE");
      });

      it("W4. Slug lookup network exception with fake connection string returns generic message and HTTP 500", async () => {
        const FAKE_CONN_STRING = "postgresql://postgres:fake_password_secret_999@db.fake-ref.supabase.co:6543/postgres";
        const FAKE_CONN_ERR = `ECONNREFUSED ${FAKE_CONN_STRING}`;

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    throw new Error(FAKE_CONN_ERR);
                  },
                }),
              }),
            } as any;
          }
          return {} as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_SLUG_NET_ERR_TEST",
          courseSlug: "bioplastic-innovation",
          studentName: "Sanitization Test",
          studentEmail: "sanitization@example.com",
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(Date.now()),
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(500);

        const responseText = await response.text();
        const body = JSON.parse(responseText);

        expect(body.success).toBe(false);
        expect(body.code).toBe("DATABASE_LOOKUP_ERROR");
        expect(body.message).toBe(GENERIC_COURSE_LOOKUP_ERROR);

        // STRICT PRIVACY ASSERTIONS: Passwords, credentials, and connection strings MUST NOT appear in response
        expect(responseText).not.toContain(FAKE_CONN_STRING);
        expect(responseText).not.toContain("fake_password_secret_999");
        expect(responseText).not.toContain("postgresql://");
      });

      it("W5. Application insertion error with fake internal DB message returns generic message and HTTP 500", async () => {
        const FAKE_INSERT_ERR_MSG = "relation \"public.course_applications_audit_replica\" does not exist with secret_key column";

        vi.spyOn(db, "from").mockImplementation((table: string) => {
          if (table === "courses") {
            return createProdCoursesMockQueryBuilder();
          }
          if (table === "course_applications") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              contains: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "42P01", message: FAKE_INSERT_ERR_MSG },
                  }),
                }),
              }),
            } as any;
          }
          return {} as any;
        });

        const payload = {
          responseId: "2_ABaOnuc_INSERT_ERR_TEST",
          courseSlug: "bioplastic-innovation",
          studentName: "Insert Error Student",
          studentEmail: "inserterr@example.com",
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex");

        const request = new Request("http://localhost:3000/api/course-applications/webhook", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-webhook-signature": signature,
            "x-webhook-timestamp": String(Date.now()),
          },
          body: rawBody,
        });

        const response = await handleCourseApplicationWebhookRequest(request);
        expect(response.status).toBe(500);

        const responseText = await response.text();
        const body = JSON.parse(responseText);

        expect(body.success).toBe(false);
        expect(body.code).toBe("DATABASE_ERROR");
        expect(body.message).toBe(GENERIC_INSERT_ERROR);

        // STRICT PRIVACY ASSERTIONS: Internal DB table/column names MUST NOT appear in response
        expect(responseText).not.toContain(FAKE_INSERT_ERR_MSG);
        expect(responseText).not.toContain("course_applications_audit_replica");
        expect(responseText).not.toContain("secret_key");
      });
    });
  });
  });
});
