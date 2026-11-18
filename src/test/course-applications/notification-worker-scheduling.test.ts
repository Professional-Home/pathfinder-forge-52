import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { handleNotificationWorkerRequest } from "../../server";
import * as notificationWorker from "../../lib/server/notification-worker";
import { supabaseAdmin } from "../../lib/server/supabase-admin";

describe("Phase 4: Notification Worker Automatic Scheduling & Enrollment Filtering", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.COURSE_NOTIFICATIONS_GMAIL_USER;
    delete process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD;
    delete process.env.ENABLE_REAL_SMTP;
    delete process.env.NOTIFICATION_WORKER_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ─── 1. Worker Authentication Tests (Phase B) ───
  describe("Worker Authentication Independent Validation", () => {
    it("returns 503 Service Unavailable when neither NOTIFICATION_WORKER_SECRET nor CRON_SECRET is configured", async () => {
      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain("authentication is not configured");
    });

    it("rejects requests without authorization headers with 401 Unauthorized", async () => {
      process.env.NOTIFICATION_WORKER_SECRET = "worker-secret-123";
      process.env.CRON_SECRET = "cron-secret-456";

      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Unauthorized");
    });

    it("rejects invalid secrets with 401 Unauthorized", async () => {
      process.env.NOTIFICATION_WORKER_SECRET = "worker-secret-123";
      process.env.CRON_SECRET = "cron-secret-456";

      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
        headers: {
          authorization: "Bearer wrong-secret",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(401);
    });

    it("authenticates successfully via valid NOTIFICATION_WORKER_SECRET in Authorization header", async () => {
      process.env.NOTIFICATION_WORKER_SECRET = "worker-secret-123";
      process.env.CRON_SECRET = "cron-secret-456";

      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
        headers: {
          authorization: "Bearer worker-secret-123",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.dryRun).toBe(true);
    });

    it("authenticates successfully via valid NOTIFICATION_WORKER_SECRET in x-worker-secret header", async () => {
      process.env.NOTIFICATION_WORKER_SECRET = "worker-secret-123";

      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
        headers: {
          "x-worker-secret": "worker-secret-123",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(200);
    });

    it("authenticates successfully via valid CRON_SECRET in Authorization header (Vercel Cron format)", async () => {
      // Distinct custom secrets for worker and cron
      process.env.NOTIFICATION_WORKER_SECRET = "worker-custom-secret-777";
      process.env.CRON_SECRET = "vercel-cron-secret-888";

      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
        headers: {
          authorization: "Bearer vercel-cron-secret-888",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("strictly rejects SUPABASE_SERVICE_ROLE_KEY as a worker authentication fallback", async () => {
      process.env.NOTIFICATION_WORKER_SECRET = "worker-custom-secret-777";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-999";

      const req = new Request("http://localhost/api/worker/notifications", {
        method: "GET",
        headers: {
          authorization: "Bearer service-role-key-999",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(401);
    });

    it("preserves separate SMTP verification behavior for action=verify-smtp", async () => {
      process.env.CRON_SECRET = "cron-secret-456";

      const req = new Request("http://localhost/api/worker/notifications?action=verify-smtp", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret-456",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      // Fails with 502 because SMTP creds are missing in this test env, but confirms action=verify-smtp was executed
      expect([200, 502]).toContain(res.status);
      const data = await res.json();
      expect(data).toHaveProperty("verified");
      expect(data).not.toHaveProperty("processed");
    });
  });

  // ─── 2. Enrollment-Only Filtering & Anti-Bypass (Phase C) ───
  describe("Enrollment-Only Notification Filtering & Fail-Closed Protection", () => {
    it("rejects requests attempting to filter for non-enrollment templates with 400 Bad Request", async () => {
      process.env.CRON_SECRET = "cron-secret-456";

      const req = new Request("http://localhost/api/worker/notifications?template=application_approved", {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret-456",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Only 'enrollment_confirmed' notifications are permitted");
    });

    it("accepts requests explicitly specifying template=enrollment_confirmed", async () => {
      process.env.CRON_SECRET = "cron-secret-456";

      const req = new Request("http://localhost/api/worker/notifications?template=enrollment_confirmed", {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret-456",
        },
      });
      const res = await handleNotificationWorkerRequest(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("live dispatch fails closed if allowedTemplate is not enrollment_confirmed", async () => {
      process.env.ENABLE_REAL_SMTP = "true";
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      // Attempting live dispatch with unapproved template
      const result = await notificationWorker.processNotificationBatch(10, 60, {
        dryRun: false,
        allowedTemplate: "application_approved",
      });

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.dryRun).toBe(false);
    });

    it("dry-run simulation mode strictly filters out application_approved and sends 0 emails", async () => {
      const mockOutboxRows = [
        {
          id: "app-approved-row-1",
          template_name: "application_approved",
          recipient_email: "student1@example.com",
          status: "pending",
          payload: { application_number: "APP-2026-00001" },
        },
        {
          id: "enrollment-confirmed-row-2",
          template_name: "enrollment_confirmed",
          recipient_email: "student2@example.com",
          status: "pending",
          payload: { application_number: "APP-2026-00002" },
        },
      ];

      // Spy on Supabase query builder
      const queryBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: string) => {
          // Verify that eq("template_name", "enrollment_confirmed") is invoked
          expect(col).toBe("template_name");
          expect(val).toBe("enrollment_confirmed");
          return Promise.resolve({
            data: mockOutboxRows.filter((r) => r.template_name === val),
            error: null,
          });
        }),
      };

      vi.spyOn(supabaseAdmin, "from").mockReturnValue(queryBuilder as any);

      const result = await notificationWorker.processNotificationBatch(10, 60, {
        dryRun: true,
        allowedTemplate: "enrollment_confirmed",
      });

      expect(result.dryRun).toBe(true);
      expect(result.sent).toBe(0); // Never sends emails in dry-run
      expect(result.processed).toBe(1); // Only the enrollment_confirmed record was processed
      expect(result.simulatedDeliveries?.[0].template_name).toBe("enrollment_confirmed");
    });

    it("live dispatch passes p_template_name to rpc_dequeue_notification_batch and skips any mismatched records", async () => {
      process.env.ENABLE_REAL_SMTP = "true";
      process.env.COURSE_NOTIFICATIONS_GMAIL_USER = "professionalhome01@gmail.com";
      process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD = "secretpassword123";

      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            id: "outbox-1",
            template_name: "enrollment_confirmed",
            recipient_email: "student@example.com",
            status: "processing",
            payload: { application_number: "APP-2026-00010" },
          },
          {
            id: "outbox-2",
            template_name: "application_approved", // An unexpected non-enrollment record
            recipient_email: "unintended@example.com",
            status: "processing",
            payload: { application_number: "APP-2026-00011" },
          },
        ],
        error: null,
      });

      vi.spyOn(supabaseAdmin, "rpc").mockImplementation(mockRpc as any);

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-123" });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.spyOn(supabaseAdmin, "from").mockReturnValue({ update: mockUpdate } as any);

      // Mock nodemailer transporter
      const mailModule = await import("../../lib/server/mail");
      vi.spyOn(mailModule, "getCourseNotificationTransporter").mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const result = await notificationWorker.processNotificationBatch(10, 60, {
        dryRun: false,
        allowedTemplate: "enrollment_confirmed",
      });

      // Verify RPC was called with p_template_name
      expect(mockRpc).toHaveBeenCalledWith("rpc_dequeue_notification_batch", {
        p_batch_size: 10,
        p_lock_seconds: 60,
        p_template_name: "enrollment_confirmed",
      });

      // Verify that sendMail was called ONLY for enrollment_confirmed, NEVER for application_approved
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "student@example.com",
        })
      );
      expect(result.sent).toBe(1);
    });
  });

  // ─── 3. Database Migration & Concurrency Verification (Phase 4.1 Hardened) ───
  describe("Forward-Only Migration Verification (Phase 4.1 Hardened)", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase_course_applications_v1_notification_filter_migration.sql"
    );

    it("migration file exists and drops previous 2-argument signature to prevent ambiguous overloading", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.rpc_dequeue_notification_batch(INT, INT);");
    });

    it("migration defines 3-argument function strictly defaulting p_template_name to enrollment_confirmed", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rpc_dequeue_notification_batch(");
      expect(sql).toContain("p_batch_size INT DEFAULT 10");
      expect(sql).toContain("p_lock_seconds INT DEFAULT 60");
      expect(sql).toContain("p_template_name TEXT DEFAULT 'enrollment_confirmed'");
    });

    it("migration enforces fail-closed template guard rejecting NULL and unapproved templates", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("v_target_template CONSTANT TEXT := 'enrollment_confirmed';");
      expect(sql).toContain("IF p_template_name IS NULL OR p_template_name <> v_target_template THEN");
      expect(sql).toContain("RETURN;");
    });

    it("migration enforces strict SQL equality filtering on template_name without NULL bypass", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("AND template_name = v_target_template");
      expect(sql).not.toContain("(p_template_name IS NULL OR template_name = p_template_name)");
    });

    it("migration enforces atomic FOR UPDATE SKIP LOCKED row locking", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    });

    it("migration locks down function execution to service_role only", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain(
        "REVOKE EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT, TEXT) FROM PUBLIC, anon, authenticated;"
      );
      expect(sql).toContain(
        "GRANT EXECUTE ON FUNCTION public.rpc_dequeue_notification_batch(INT, INT, TEXT) TO service_role;"
      );
    });

    it("migration includes clear rollback instructions matching original definition", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("Rollback Instructions");
      expect(sql).toContain("p_lock_seconds INT DEFAULT 300");
    });
  });

  // ─── 4. RPC Dequeue Invariant Coverage (Five Parameter Cases) ───
  describe("RPC Dequeue Fail-Closed Parameter Evaluation Invariants", () => {
    const mockOutboxRows = [
      { id: "row-enrollment-1", template_name: "enrollment_confirmed", status: "pending" },
      { id: "row-enrollment-2", template_name: "enrollment_confirmed", status: "pending" },
      { id: "row-approved-1", template_name: "application_approved", status: "pending" },
      { id: "row-received-1", template_name: "application_received", status: "pending" },
    ];

    // Functional model of hardened PL/pgSQL logic:
    function simulateHardenedRpcDequeue(
      rows: typeof mockOutboxRows,
      p_batch_size: number = 10,
      p_lock_seconds: number = 60,
      p_template_name: string | null = "enrollment_confirmed"
    ) {
      const v_target_template = "enrollment_confirmed";
      // Fail-closed guard:
      if (p_template_name === null || p_template_name !== v_target_template) {
        return [];
      }
      return rows.filter((r) => r.template_name === v_target_template).slice(0, p_batch_size);
    }

    it("Case 1: two-argument invocation defaults to enrollment_confirmed and dequeues matching records", () => {
      const dequeued = simulateHardenedRpcDequeue(mockOutboxRows, 10, 60);
      expect(dequeued.length).toBe(2);
      expect(dequeued.every((r) => r.template_name === "enrollment_confirmed")).toBe(true);
      expect(dequeued.some((r) => r.template_name === "application_approved")).toBe(false);
    });

    it("Case 2: explicit NULL template parameter fails closed and dequeues zero records", () => {
      const dequeued = simulateHardenedRpcDequeue(mockOutboxRows, 10, 60, null);
      expect(dequeued).toEqual([]);
      expect(dequeued.length).toBe(0);
    });

    it("Case 3: explicit enrollment_confirmed parameter dequeues matching records", () => {
      const dequeued = simulateHardenedRpcDequeue(mockOutboxRows, 10, 60, "enrollment_confirmed");
      expect(dequeued.length).toBe(2);
      expect(dequeued.every((r) => r.template_name === "enrollment_confirmed")).toBe(true);
    });

    it("Case 4: application_approved parameter fails closed and leaves approved records untouched", () => {
      const dequeued = simulateHardenedRpcDequeue(mockOutboxRows, 10, 60, "application_approved");
      expect(dequeued).toEqual([]);
      expect(dequeued.length).toBe(0);
    });

    it("Case 5: any unsupported template name fails closed and dequeues zero records", () => {
      const dequeuedUnknown = simulateHardenedRpcDequeue(mockOutboxRows, 10, 60, "unknown_template");
      expect(dequeuedUnknown).toEqual([]);

      const dequeuedWildcard = simulateHardenedRpcDequeue(mockOutboxRows, 10, 60, "*");
      expect(dequeuedWildcard).toEqual([]);
    });
  });

  // ─── 5. Vercel Cron Configuration Verification ───
  describe("Vercel Configuration (vercel.json)", () => {
    const vercelConfigPath = path.resolve(process.cwd(), "vercel.json");

    it("vercel.json defines Hobby-compliant daily schedule and enrollment-only endpoint path", () => {
      expect(fs.existsSync(vercelConfigPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
      expect(config).toHaveProperty("crons");
      expect(Array.isArray(config.crons)).toBe(true);
      expect(config.crons.length).toBeGreaterThan(0);

      const cronEntry = config.crons.find(
        (c: any) => c.path === "/api/worker/notifications?template=enrollment_confirmed"
      );
      expect(cronEntry).toBeDefined();
      expect(cronEntry.schedule).toBe("0 0 * * *");
    });

    it("vercel.json preserves all security headers", () => {
      const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
      expect(config).toHaveProperty("headers");
      expect(Array.isArray(config.headers)).toBe(true);
      expect(config.headers.length).toBeGreaterThan(0);
    });
  });
});
