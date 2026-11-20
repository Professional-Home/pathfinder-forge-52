import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodemailer from "nodemailer";
import {
  getSharedMailCredentials,
  getTransporter,
  transporter,
  ensureMailReady,
  getSenderAddress,
  resetSharedTransporterForTesting,
  getCourseNotificationCredentials,
  getCourseNotificationTransporter,
  getCourseNotificationSenderAddress,
  resetCourseNotificationTransporterForTesting,
} from "../../lib/server/mail";

describe("Shared Application Email Transporter Security & Regression Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.COURSE_NOTIFICATIONS_GMAIL_USER;
    delete process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD;
    delete process.env.ENABLE_REAL_SMTP;
    resetSharedTransporterForTesting();
    resetCourseNotificationTransporterForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetSharedTransporterForTesting();
    resetCourseNotificationTransporterForTesting();
    vi.restoreAllMocks();
  });

  // ─── 1. Credential Validation & Zero-Hardcoded Fallback ───
  describe("1. Credential Validation & No-Fallback Guarantees", () => {
    it("returns null when both GMAIL_USER and GMAIL_APP_PASSWORD are missing", () => {
      expect(getSharedMailCredentials()).toBeNull();
    });

    it("returns null when only GMAIL_USER is missing", () => {
      process.env.GMAIL_APP_PASSWORD = "testpassword123";
      expect(getSharedMailCredentials()).toBeNull();
    });

    it("returns null when only GMAIL_APP_PASSWORD is missing", () => {
      process.env.GMAIL_USER = "test@example.com";
      expect(getSharedMailCredentials()).toBeNull();
    });

    it("returns null when values are empty or whitespace only", () => {
      process.env.GMAIL_USER = "   ";
      process.env.GMAIL_APP_PASSWORD = "   ";
      expect(getSharedMailCredentials()).toBeNull();
    });

    it("returns valid credentials when GMAIL_USER and GMAIL_APP_PASSWORD are set", () => {
      process.env.GMAIL_USER = "shared-auth@example.com";
      process.env.GMAIL_APP_PASSWORD = "secretpassword123";

      const creds = getSharedMailCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.user).toBe("shared-auth@example.com");
      expect(creds?.pass).toBe("secretpassword123");
    });

    it("supports legacy EMAIL_USER and EMAIL_PASS aliases for backward compatibility", () => {
      process.env.EMAIL_USER = "legacy-user@example.com";
      process.env.EMAIL_PASS = "legacypassword123";

      const creds = getSharedMailCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.user).toBe("legacy-user@example.com");
      expect(creds?.pass).toBe("legacypassword123");
    });

    it("correctly strips whitespace from Google Workspace 4x4 app passwords", () => {
      process.env.GMAIL_USER = "  appuser@example.com  ";
      process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";

      const creds = getSharedMailCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.user).toBe("appuser@example.com");
      expect(creds?.pass).toBe("abcdefghijklmnop");
    });
  });

  // ─── 2. Fail-Closed Transporter Behavior ───
  describe("2. Fail-Closed Transporter Initialization", () => {
    it("throws descriptive error when getTransporter is called without credentials", () => {
      expect(() => getTransporter()).toThrow(
        /Shared application SMTP error: GMAIL_USER \(or EMAIL_USER\) and GMAIL_APP_PASSWORD \(or EMAIL_PASS\) environment variables are required/
      );
    });

    it("error message does not contain or expose any secret tokens or passwords", () => {
      try {
        getTransporter();
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err.message).not.toContain("ukpucdorwtlwxiqo");
        expect(err.message).not.toContain("password=");
      }
    });

    it("creates dedicated nodemailer transporter when credentials exist", () => {
      process.env.GMAIL_USER = "app@example.com";
      process.env.GMAIL_APP_PASSWORD = "validpassword123";

      const createSpy = vi.spyOn(nodemailer, "createTransport");
      const client = getTransporter();

      expect(client).toBeDefined();
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "gmail",
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          auth: {
            user: "app@example.com",
            pass: "validpassword123",
          },
        })
      );

      // Singleton reuse
      const client2 = getTransporter();
      expect(client2).toBe(client);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 3. Transporter Proxy Delegation ───
  describe("3. Transporter Proxy Compatibility", () => {
    it("transporter proxy object is defined but throws on operation if unconfigured", async () => {
      expect(transporter).toBeDefined();
      expect(() => (transporter as any).sendMail({ to: "test@example.com" })).toThrow(
        /Shared application SMTP error/
      );
    });

    it("transporter proxy delegates sendMail when configured", async () => {
      process.env.GMAIL_USER = "app@example.com";
      process.env.GMAIL_APP_PASSWORD = "validpassword123";

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-123" });
      vi.spyOn(nodemailer, "createTransport").mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      await transporter.sendMail({
        from: "Micrylis <app@example.com>",
        to: "recipient@example.com",
        subject: "Test",
        text: "Hello",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "recipient@example.com",
          subject: "Test",
        })
      );
    });
  });

  // ─── 4. Non-Blocking Readiness & Sender Identity ───
  describe("4. ensureMailReady & getSenderAddress Safety", () => {
    it("ensureMailReady returns false gracefully when credentials are not configured", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const isReady = await ensureMailReady();
      expect(isReady).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Shared application SMTP not configured")
      );
    });

    it("ensureMailReady triggers verification and returns true when configured", async () => {
      process.env.GMAIL_USER = "app@example.com";
      process.env.GMAIL_APP_PASSWORD = "validpassword123";

      const mockVerify = vi.fn((cb: (err: Error | null) => void) => cb(null));
      vi.spyOn(nodemailer, "createTransport").mockReturnValue({
        verify: mockVerify,
      } as any);

      const isReady = await ensureMailReady();
      expect(isReady).toBe(true);
      expect(mockVerify).toHaveBeenCalled();
    });

    it("getSenderAddress returns formatted address with user when configured", () => {
      process.env.GMAIL_USER = "verified@example.com";
      expect(getSenderAddress()).toBe("Micrylis <verified@example.com>");
    });

    it("getSenderAddress does not fall back to hardcoded micrylisbiotech email when unconfigured", () => {
      expect(getSenderAddress()).toBe("Micrylis");
      expect(getSenderAddress()).not.toContain("micrylisbiotech@gmail.com");
    });
  });

  // ─── 5. Logical Transporter Isolation (Same Gmail Account Compatibility) ───
  describe("5. Logical Transporter Isolation & Dual-Workflow Coexistence", () => {
    it("shared transporter credentials do not satisfy course notification transporter", () => {
      process.env.GMAIL_USER = "shared-account@gmail.com";
      process.env.GMAIL_APP_PASSWORD = "shared-app-password";

      // Course notification transporter must remain unconfigured
      expect(getCourseNotificationCredentials()).toBeNull();
      expect(() => getCourseNotificationTransporter()).toThrow(
        /Dedicated course notification SMTP error/
      );
    });

    it("course notification credentials do not satisfy shared application transporter", () => {
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "admissions@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "admissions-app-password";

      // Shared transporter must remain unconfigured
      expect(getSharedMailCredentials()).toBeNull();
      expect(() => getTransporter()).toThrow(
        /Shared application SMTP error/
      );
    });

    it("both workflows can safely use the SAME Gmail account and password with separate transporters", () => {
      const commonEmail = "common-org@gmail.com";
      const commonPassword = "common-app-password-16";

      process.env.GMAIL_USER = commonEmail;
      process.env.GMAIL_APP_PASSWORD = commonPassword;
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = commonEmail;
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = commonPassword;

      const sharedCreds = getSharedMailCredentials();
      const courseCreds = getCourseNotificationCredentials();

      expect(sharedCreds).not.toBeNull();
      expect(courseCreds).not.toBeNull();
      expect(sharedCreds?.user).toBe(commonEmail);
      expect(courseCreds?.user).toBe(commonEmail);

      const createSpy = vi.spyOn(nodemailer, "createTransport");

      const sharedClient = getTransporter();
      const courseClient = getCourseNotificationTransporter();

      // Transporters are logically distinct instances with distinct sender identities
      expect(sharedClient).toBeDefined();
      expect(courseClient).toBeDefined();
      expect(createSpy).toHaveBeenCalledTimes(2);

      expect(getSenderAddress()).toBe(`Micrylis <${commonEmail}>`);
      expect(getCourseNotificationSenderAddress()).toBe(`PathFinder Admissions <${commonEmail}>`);
    });
  });

  // ─── 6. Application Workflow Integration & Graceful Error Handling ───
  describe("6. Application Workflow Integration & Graceful Error Handling", () => {
    it("ensureMailReady signals unready state so auth callers can return MAIL_ERROR without throwing", async () => {
      // Simulate auth-server.ts or spin-wheel workflow when SMTP is not configured
      const isReady = await ensureMailReady();
      expect(isReady).toBe(false);

      // Verify that caller receives false and can formulate safe response
      const safeResponse = !isReady
        ? {
            success: false,
            code: "MAIL_ERROR",
            message: "Unable to send email at this time. Please try again later.",
          }
        : { success: true };

      expect(safeResponse.success).toBe(false);
      expect(safeResponse.code).toBe("MAIL_ERROR");
      expect(safeResponse.message).toContain("Unable to send email at this time");
    });

    it("Spin Wheel email failure handling catches unconfigured transporter safely", async () => {
      // When credentials are not configured, invoking transporter.sendMail throws a caught configuration error
      let caughtError: any = null;
      try {
        await transporter.sendMail({
          from: getSenderAddress(),
          to: "spin-user@example.com",
          subject: "Spin Code",
          text: "123456",
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toContain("Shared application SMTP error");
      // Verify simulated spin-wheel response
      const spinResult = {
        success: false,
        code: "MAIL_FAILED",
        message: `Unable to send email: ${caughtError.message}`,
      };
      expect(spinResult.success).toBe(false);
      expect(spinResult.code).toBe("MAIL_FAILED");
    });
  });
});
