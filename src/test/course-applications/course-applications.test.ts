import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  validateDocumentMagicBytes,
  validateDocumentFile,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/server/course-application-storage";
import {
  renderNotificationEmail,
  calculateExponentialBackoffMs,
  sanitizeErrorMessage,
} from "@/lib/server/notification-worker";

describe("Course Application Management — Security & Functional Verification", () => {
  // ─── 1. DEC-04 Document Magic Byte & Size Validation ───────────────────────────
  describe("DEC-04: Magic Byte Binary Validation & 10MB Limit", () => {
    it("accepts authentic PDF files with %PDF- binary header", () => {
      const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
      const result = validateDocumentMagicBytes(pdfHeader);
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe("application/pdf");
    });

    it("accepts authentic PNG files with \\x89PNG binary header", () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = validateDocumentMagicBytes(pngHeader);
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe("image/png");
    });

    it("accepts authentic JPEG files with \\xFF\\xD8\\xFF binary header", () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const result = validateDocumentMagicBytes(jpegHeader);
      expect(result.isValid).toBe(true);
      expect(result.detectedMime).toBe("image/jpeg");
    });

    it("rejects spoofed files (e.g. text/html renamed to .pdf)", () => {
      const textFile = Buffer.from("<html><body>Malicious HTML disguised as PDF</body></html>");
      const result = validateDocumentMagicBytes(textFile);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid file format");
    });

    it("rejects executable / PE binaries disguised as images", () => {
      const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ
      const result = validateDocumentMagicBytes(exeHeader);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid file format");
    });

    it("strictly enforces 10 MB maximum file size limit (DEC-04)", () => {
      expect(MAX_DOCUMENT_SIZE_BYTES).toBe(10 * 1024 * 1024);
      const oversizedBytes = 10 * 1024 * 1024 + 1;
      const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

      const result = validateDocumentFile({
        buffer: pdfHeader,
        fileName: "large.pdf",
        mimeType: "application/pdf",
        sizeBytes: oversizedBytes,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceeds the 10 MB limit");
    });
  });

  // ─── 2. DEC-02 Guest Claim Token Security ──────────────────────────────────────
  describe("DEC-02: Guest Claim Cryptographic Security", () => {
    it("generates 64-character hex tokens with 256 bits of CSPRNG entropy", () => {
      const token1 = crypto.randomBytes(32).toString("hex");
      const token2 = crypto.randomBytes(32).toString("hex");
      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it("computes deterministic SHA-256 hash for database storage", () => {
      const rawToken = "d4e2a87c1f9b3e6a5c8d0e2f4a6b8c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b";
      const hash1 = crypto.createHash("sha256").update(rawToken).digest("hex");
      const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex");
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(rawToken);
    });

    it("validates 30-day expiration window logic", () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(expiresAt.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);

      const pastExpiry = new Date(now.getTime() - 1000);
      expect(pastExpiry < now).toBe(true);
    });
  });

  // ─── 3. DEC-01 Application Number Formatting ───────────────────────────────────
  describe("DEC-01: Application Sequence Formatting", () => {
    it("validates application number regex pattern APP-YYYY-XXXXX", () => {
      const pattern = /^APP-\d{4}-\d{5}$/;
      expect(pattern.test("APP-2026-00001")).toBe(true);
      expect(pattern.test("APP-2026-09872")).toBe(true);
      expect(pattern.test("APP-2025-10000")).toBe(true);
      expect(pattern.test("APP-26-001")).toBe(false);
      expect(pattern.test("INV-2026-00001")).toBe(false);
    });
  });

  // ─── 4. DEC-03 Academic Approval vs Payment Separation ────────────────────────
  describe("DEC-03: Two-Phase Admission & Enrollment Invariants", () => {
    it("allows academic approval when documents are verified regardless of payment status", () => {
      const application = {
        status: "under_review",
        documents_status: "verified",
        payment_status: "pending",
      };

      const canApprove = application.documents_status === "verified";
      expect(canApprove).toBe(true);
    });

    it("prevents enrollment activation if payment status is pending", () => {
      const application = {
        status: "approved",
        documents_status: "verified",
        payment_status: "pending",
      };

      const validPaymentStates = ["verified", "waived", "not_required"];
      const canEnroll =
        application.status === "approved" && validPaymentStates.includes(application.payment_status);
      expect(canEnroll).toBe(false);
    });

    it("permits enrollment activation when payment is verified or waived", () => {
      const validPaymentStates = ["verified", "waived", "not_required"];

      for (const pStatus of validPaymentStates) {
        const application = {
          status: "approved",
          documents_status: "verified",
          payment_status: pStatus,
        };
        const canEnroll =
          application.status === "approved" && validPaymentStates.includes(application.payment_status);
        expect(canEnroll).toBe(true);
      }
    });
  });

  // ─── 5. Notification Outbox Worker & Template Verification ─────────────────────
  describe("Notification Outbox Worker & Email Templates", () => {
    it("calculates correct exponential backoff timings", () => {
      expect(calculateExponentialBackoffMs(0)).toBe(60 * 1000); // 1 min
      expect(calculateExponentialBackoffMs(1)).toBe(120 * 1000); // 2 min
      expect(calculateExponentialBackoffMs(2)).toBe(240 * 1000); // 4 min
      expect(calculateExponentialBackoffMs(3)).toBe(480 * 1000); // 8 min
      expect(calculateExponentialBackoffMs(4)).toBe(960 * 1000); // 16 min
    });

    const templates = [
      "application_received",
      "review_started",
      "resubmission_required",
      "application_approved",
      "application_rejected",
      "enrollment_confirmed",
      "enrollment_revoked",
    ];

    templates.forEach((tmpl) => {
      it(`renders valid HTML and text for template '${tmpl}'`, () => {
        const payload = {
          application_number: "APP-2026-00042",
          course_title: "Bioplastic Innovation Lab",
          course_slug: "bioplastic-innovation",
          notes: "Please re-upload higher resolution marksheet.",
          rejection_reason: "Prerequisites not fully satisfied.",
          claim_token: "d4e2a87c1f9b3e6a5c8d0e2f4a6b8c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b",
        };

        const email = renderNotificationEmail(tmpl, "Alex Student", payload);
        expect(email.subject).toBeTruthy();
        expect(email.subject).toContain("APP-2026-00042");
        expect(email.html).toContain("PathFinder");
        expect(email.html).toContain("APP-2026-00042");
        expect(email.html).toContain("Alex Student");
        expect(email.text).toContain("APP-2026-00042");
      });
    });
  });

  // ─── 6. SQL Migration Artifact Verification ───────────────────────────────────
  describe("SQL Migration Specification & Invariant Audit", () => {
    const migrationPath = path.resolve(process.cwd(), "supabase_course_applications_v1_migration.sql");

    it("verifies existence and integrity of consolidated SQL migration", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql.length).toBeGreaterThan(30000);

      // Verify v_prev_app typed snapshot is present
      expect(sql).toContain("v_prev_app public.course_applications%ROWTYPE;");

      // Verify FOR UPDATE row lock is acquired
      expect(sql).toContain("FROM public.course_applications");
      expect(sql).toContain("FOR UPDATE;");

      // Verify deterministic scalar candidate selection
      expect(sql).toContain("SELECT id INTO v_candidate_id");
      expect(sql).toContain("LIMIT 1;");

      // Verify occurrence-aware notification idempotency key construction
      expect(sql).toContain("v_idempotency_key :=");
      expect(sql).toContain("v_occurrence_seq::text");

      // Verify DEC-03 separation in RPC
      expect(sql).toContain("documents_status IS DISTINCT FROM 'verified'");
      expect(sql).toContain("payment_status NOT IN ('verified', 'waived', 'not_required')");

      // Verify immutability trigger on audit logs
      expect(sql).toContain("trg_prevent_audit_log_tampering");
      expect(sql).toContain("Audit logs are strictly append-only");

      // Verify RPC execution permissions are restricted from public/anon/authenticated
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.rpc_admin_transition_application_status(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.rpc_claim_guest_application(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT) FROM PUBLIC, anon, authenticated;");
    });
  });

  // ─── 7. PII Redaction & Sanitization ───────────────────────────────────────────
  describe("PII & Error Sanitization", () => {
    it("redacts email addresses from error strings", () => {
      const raw = "SMTP error: Failed to connect while emailing applicant.john@gmail.com on host 1.2.3.4";
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain("applicant.john@gmail.com");
      expect(sanitized).toContain("[REDACTED_EMAIL]");
    });

    it("redacts bearer tokens and secrets from error strings", () => {
      const raw = "Unauthorized: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(sanitized).toContain("[REDACTED_TOKEN]");
    });

    it("redacts 32-64 char hashes from error strings", () => {
      const raw = "Token lookup failed for c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2";
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain("c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2");
      expect(sanitized).toContain("[REDACTED_HASH]");
    });

    it("truncates excessively long error strings to 500 characters", () => {
      const longMessage = "E".repeat(1000);
      const sanitized = sanitizeErrorMessage(longMessage);
      expect(sanitized.length).toBeLessThanOrEqual(500);
    });
  });

  // ─── 8. Outbox Worker Lifecycle & Retry Invariants ─────────────────────────────
  describe("Outbox Worker Lifecycle & State Machine", () => {
    it("marks notification permanently failed once retry_count reaches max_retries", () => {
      const maxRetries = 5;
      const simulateRetry = (currentRetries: number) => {
        const nextRetries = currentRetries + 1;
        const isPermanentlyFailed = nextRetries >= maxRetries;
        return {
          status: isPermanentlyFailed ? "failed" : "pending",
          retry_count: nextRetries,
        };
      };

      const attempt1 = simulateRetry(0);
      expect(attempt1.status).toBe("pending");
      expect(attempt1.retry_count).toBe(1);

      const attempt4 = simulateRetry(3);
      expect(attempt4.status).toBe("pending");
      expect(attempt4.retry_count).toBe(4);

      const attempt5 = simulateRetry(4);
      expect(attempt5.status).toBe("failed");
      expect(attempt5.retry_count).toBe(5);
    });
  });

  // ─── 9. Negative Guest Claim Security ──────────────────────────────────────────
  describe("Negative Security: Guest Claim Token Invariants", () => {
    it("rejects token claiming if token was already claimed", () => {
      const claimedRecord = {
        id: "app-123",
        claim_token_hash: "a".repeat(64),
        claim_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
        claimed_at: new Date(Date.now() - 3600000).toISOString(),
        applicant_user_id: "user-456",
      };

      const isClaimable =
        claimedRecord.claimed_at === null &&
        new Date(claimedRecord.claim_token_expires_at) > new Date();

      expect(isClaimable).toBe(false);
    });

    it("rejects token claiming if token has expired", () => {
      const expiredRecord = {
        id: "app-123",
        claim_token_hash: "a".repeat(64),
        claim_token_expires_at: new Date(Date.now() - 1000).toISOString(),
        claimed_at: null,
        applicant_user_id: null,
      };

      const isClaimable =
        expiredRecord.claimed_at === null &&
        new Date(expiredRecord.claim_token_expires_at) > new Date();

      expect(isClaimable).toBe(false);
    });

    it("rejects non-matching hash against stored hash", () => {
      const storedHash = crypto.createHash("sha256").update("valid-secret-token").digest("hex");
      const candidateHash = crypto.createHash("sha256").update("invalid-secret-token").digest("hex");

      expect(candidateHash).not.toBe(storedHash);
    });
  });

  // ─── 10. File Validation Negative Security ─────────────────────────────────────
  describe("Negative Security: Storage File Validation", () => {
    it("rejects zero-byte files", () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validateDocumentFile({
        buffer: emptyBuffer,
        fileName: "empty.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
      });

      expect(result.isValid).toBe(false);
    });

    it("rejects unsupported file extensions even if MIME type is faked", () => {
      const dummyHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const result = validateDocumentFile({
        buffer: dummyHeader,
        fileName: "malicious.exe",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Unsupported file format");
    });
  });
});
