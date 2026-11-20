import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import {
  getCourseNotificationCredentials,
  getCourseNotificationTransporter,
  getCourseNotificationSenderAddress,
  verifyCourseNotificationSmtp,
  resetCourseNotificationTransporterForTesting,
  transporter as sharedTransporter,
  getSenderAddress as getSharedSenderAddress,
} from "../../lib/server/mail";
import * as notificationWorker from "../../lib/server/notification-worker";
import { handleNotificationWorkerRequest } from "../../server";

describe("Dedicated PathFinder Course Notification Transporter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.COURSE_NOTIFICATIONS_GMAIL_USER;
    delete process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD;
    delete process.env.ENABLE_REAL_SMTP;
    delete process.env.NOTIFICATION_WORKER_SECRET;
    resetCourseNotificationTransporterForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetCourseNotificationTransporterForTesting();
    vi.restoreAllMocks();
  });

  // ─── 1. Dedicated Credential Validation & Isolation ───
  describe("Dedicated Credential Validation & No-Fallback Guarantees", () => {
    it("returns null when COURSE_NOTIFICATIONS_GMAIL_USER is missing", () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "test password 1234";
      expect(getCourseNotificationCredentials()).toBeNull();
    });

    it("returns null when COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD is missing", () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      expect(getCourseNotificationCredentials()).toBeNull();
    });

    it("returns null when both dedicated variables are missing, even if shared GMAIL vars exist", () => {
      process.env.GMAIL_USER = "shared@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "sharedpassword123";
      process.env.EMAIL_USER = "fallback@gmail.com";
      process.env.EMAIL_PASS = "fallbackpassword123";

      // Must NOT fall back to shared or legacy env vars
      expect(getCourseNotificationCredentials()).toBeNull();
    });

    it("correctly strips whitespace from Google Workspace 4x4 app passwords", () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com ";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";

      const creds = getCourseNotificationCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.user).toBe("professionalhome01@gmail.com");
      expect(creds?.pass).toBe("abcdefghijklmnop");
    });

    it("throws descriptive configuration error when getCourseNotificationTransporter is called without dedicated credentials", () => {
      expect(() => getCourseNotificationTransporter()).toThrow(
        /Dedicated course notification SMTP error: COURSE_NOTIFICATIONS_GMAIL_USER and COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD are required/
      );
    });

    it("never falls back to shared credentials when getCourseNotificationTransporter is called", () => {
      process.env.GMAIL_USER = "shared-spin-wheel@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "shared-password";

      expect(() => getCourseNotificationTransporter()).toThrow(
        /Fallback to shared credentials is strictly prohibited/
      );
    });

    it("resolves dedicated sender address correctly", () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      expect(getCourseNotificationSenderAddress()).toBe(
        "PathFinder Admissions <professionalhome01@gmail.com>"
      );
    });
  });

  // ─── 2. Singleton Transporter Creation & Options ───
  describe("Transporter Creation & Singleton Caching", () => {
    it("creates dedicated transporter with pooled connection and Gmail service", () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      const createSpy = vi.spyOn(nodemailer, "createTransport");
      const transporter = getCourseNotificationTransporter();

      expect(transporter).toBeDefined();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "gmail",
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          auth: {
            user: "professionalhome01@gmail.com",
            pass: "secretpassword123",
          },
        })
      );

      // Verify singleton caching: second call does not recreate
      const secondCall = getCourseNotificationTransporter();
      expect(secondCall).toBe(transporter);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 3. Verification Function (Non-Sending) ───
  describe("verifyCourseNotificationSmtp()", () => {
    it("returns error without throwing when dedicated credentials are not configured", async () => {
      const result = await verifyCourseNotificationSmtp();
      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).toContain("COURSE_NOTIFICATIONS_GMAIL_USER");
    });

    it("calls transporter.verify() and resolves true without sending mail", async () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      const mockTransporter = {
        verify: vi.fn((cb: (err: Error | null) => void) => cb(null)),
        sendMail: vi.fn(),
      };
      vi.spyOn(nodemailer, "createTransport").mockReturnValue(mockTransporter as any);

      const result = await verifyCourseNotificationSmtp();
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it("redacts potential emails and sensitive data in verification errors", async () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      const mockTransporter = {
        verify: vi.fn((cb: (err: Error | null) => void) =>
          cb(new Error("Auth failed for professionalhome01@gmail.com token a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"))
        ),
      };
      vi.spyOn(nodemailer, "createTransport").mockReturnValue(mockTransporter as any);

      const result = await verifyCourseNotificationSmtp();
      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error).not.toContain("professionalhome01@gmail.com");
      expect(result.error).toContain("[REDACTED_EMAIL]");
    });
  });

  // ─── 4. Shared Transporter Independence (Spin Wheel & Auth OTP) ───
  describe("Shared Transporter Remains Unaffected for Spin Wheel and Auth OTP", () => {
    it("shared transporter continues to use GMAIL_USER and getSenderAddress", () => {
      expect(getSharedSenderAddress()).toContain("Micrylis");
      expect(sharedTransporter).toBeDefined();
    });
  });

  // ─── 5. Notification Worker Live Dispatch & Dry-Run Integration ───
  describe("Notification Worker Integration", () => {
    it("dry-run mode never attempts to initialize the dedicated transporter or send emails", async () => {
      delete process.env.ENABLE_REAL_SMTP; // dry-run mode
      const result = await notificationWorker.processNotificationBatch(5, 60, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.sent).toBe(0);
    });

    it("live dispatch mode fails closed safely if dedicated credentials are missing", async () => {
      process.env.ENABLE_REAL_SMTP = "true";
      // dedicated credentials missing

      const result = await notificationWorker.processNotificationBatch(5, 60, { dryRun: false });
      expect(result.sent).toBe(0);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  // ─── 6. Diagnostic API Route Integration ───
  describe("Worker HTTP Endpoint Diagnostic Verification (action=verify-smtp)", () => {
    it("rejects unauthenticated requests to action=verify-smtp with 401/503", async () => {
      const req = new Request("http://localhost/api/worker/notifications?action=verify-smtp", {
        method: "POST",
      });
      const res = await handleNotificationWorkerRequest(req);
      expect([401, 503]).toContain(res.status);
    });

    it("returns verification result when authenticated with worker secret", async () => {
      process.env.NOTIFICATION_WORKER_SECRET = "super-secret-worker-token-999";
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      const mockTransporter = {
        verify: vi.fn((cb: (err: Error | null) => void) => cb(null)),
      };
      vi.spyOn(nodemailer, "createTransport").mockReturnValue(mockTransporter as any);

      const req = new Request("http://localhost/api/worker/notifications?action=verify-smtp", {
        method: "POST",
        headers: {
          authorization: "Bearer super-secret-worker-token-999",
        },
      });

      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.verified).toBe(true);
    });
  });
});
