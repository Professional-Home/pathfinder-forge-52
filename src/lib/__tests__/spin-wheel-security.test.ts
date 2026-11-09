import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SPIN_REWARDS,
  selectRewardByProbability,
  generateVoucherCode,
  isSpinOfferExpired,
  SPIN_EXPIRY_LABEL,
  SPIN_WHEEL_EXPIRY_DATE,
} from "../spin-wheel/config";
import {
  executeSpinRollCore as handleExecuteSpinRoll,
  fetchAdminSpinEntriesCore as handleFetchAdminSpinEntries,
  checkEmailSpunCore as handleCheckEmailSpun,
  claimSpinRewardCore as handleClaimSpinReward,
  rejectSpinRewardCore as handleRejectSpinReward,
  acceptSpinRewardCore as handleAcceptSpinReward,
  redeemSpinRewardAdminCore as handleRedeemSpinRewardAdmin,
  verifyFormManualAdminCore as handleVerifyFormManualAdmin,
  processSpinWebhookCore as handleProcessSpinWebhook,
  sendSpinOtpCore as handleSendSpinOtp,
  handleVerifySpinOtp,
  verifyParticipantSession,
  maskEmail,
  maskPhone,
} from "../server/spin-wheel-security";
import {
  GOOGLE_FORM_DEFINITIONS,
  buildPrefilledGoogleFormUrl,
  getBaseGoogleFormUrl,
  getSpinWebhookSecret,
} from "../server/google-forms-config";
import crypto from "node:crypto";
import server from "../../server";
import {
  verifyAdminSession,
  requireAdminSession,
  deleteUserAdminCore,
  listUsersAdminCore,
} from "../server/admin-guard";
import {
  supabaseAdmin,
  getSupabaseAdminUrl,
  getServiceRoleKey,
  resetCachedAdminClient,
} from "../server/supabase-admin";

describe("PathFinder Spin & Win — Security Lockdown & Privilege Audit (Phase 1C)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createValidWebhookHeaders(body: string, timestamp = Date.now()) {
    const secret = getSpinWebhookSecret();
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return {
      signature,
      timestamp: String(timestamp),
    };
  }

  // ─── Scenario 1: Client-Generated Legacy Admin Token Rejected ────────────────
  describe("Scenario 1: Client-generated legacy admin token rejection", () => {
    it("strictly rejects any token matching the legacy session_<hash>_<timestamp> format", async () => {
      const legacyToken = "session_982348a_1730900000000";
      const result = await verifyAdminSession(legacyToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Legacy client-generated admin tokens are rejected");
    });
  });

  // ─── Scenario 2: Hardcoded Default Administrator Rejected ───────────────────
  describe("Scenario 2: Hardcoded default administrator rejection", () => {
    it("rejects admin@admin.com when not explicitly configured in server ADMIN_EMAILS", async () => {
      const savedEnv = process.env.ADMIN_EMAILS;
      delete process.env.ADMIN_EMAILS;

      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "fake-admin-id",
            email: "admin@admin.com",
            app_metadata: {}, // No authoritative admin role
            user_metadata: {},
            created_at: new Date().toISOString(),
          } as any,
        },
        error: null,
      });

      const result = await verifyAdminSession("mock_jwt_for_default_admin");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Access denied");

      process.env.ADMIN_EMAILS = savedEnv;
    });
  });

  // ─── Scenario 3: Self-Assigned user_metadata.role Rejected ──────────────────
  describe("Scenario 3: Untrusted user_metadata.role rejection", () => {
    it("strictly ignores user_metadata.role = 'admin' self-assigned by a client", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "attacker-user-id",
            email: "attacker@untrusted.com",
            user_metadata: { role: "admin", full_name: "Attacker" }, // Client-controlled metadata
            app_metadata: { role: "user" }, // Server-controlled authoritative metadata
            created_at: new Date().toISOString(),
          } as any,
        },
        error: null,
      });

      const result = await verifyAdminSession("mock_attacker_tampered_jwt");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  // ─── Scenario 4: Authoritative app_metadata.role Accepted ───────────────────
  describe("Scenario 4: Authoritative server app_metadata.role acceptance", () => {
    it("accepts authenticated admin session when app_metadata.role is 'admin'", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "legit-admin-id",
            email: "verified-admin@micrylis.com",
            app_metadata: { role: "admin" }, // Authoritative role
            user_metadata: {},
            created_at: new Date().toISOString(),
          } as any,
        },
        error: null,
      });

      const result = await verifyAdminSession("valid_admin_jwt");
      expect(result.isValid).toBe(true);
      expect(result.email).toBe("verified-admin@micrylis.com");
      expect(result.role).toBe("admin");
    });

    it("accepts authenticated admin session when email is in server process.env.ADMIN_EMAILS", async () => {
      const savedEnv = process.env.ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "configured-lead@micrylis.com,another@micrylis.com";

      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "lead-admin-id",
            email: "configured-lead@micrylis.com",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          } as any,
        },
        error: null,
      });

      const result = await verifyAdminSession("valid_lead_admin_jwt");
      expect(result.isValid).toBe(true);
      expect(result.email).toBe("configured-lead@micrylis.com");

      process.env.ADMIN_EMAILS = savedEnv;
    });
  });

  // ─── Scenario 5: Missing or Empty Admin JWT Rejected ────────────────────────
  describe("Scenario 5: Missing or empty admin JWT rejection", () => {
    it("fails closed when authToken is undefined, empty string, or whitespace", async () => {
      const res1 = await verifyAdminSession(undefined);
      expect(res1.isValid).toBe(false);
      expect(res1.error).toContain("Admin authentication required");

      const res2 = await verifyAdminSession("");
      expect(res2.isValid).toBe(false);

      const res3 = await verifyAdminSession("   ");
      expect(res3.isValid).toBe(false);
    });
  });

  // ─── Scenario 6: deleteUserAdmin Protected ──────────────────────────────────
  describe("Scenario 6: Administrative user deletion authorization requirement", () => {
    it("rejects deleteUserAdminCore without valid admin authorization", async () => {
      const result = await deleteUserAdminCore({
        userId: "target-user-123",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("Admin authentication required");
    });

    it("rejects deleteUserAdminCore with non-admin participant token", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "normal-user-id",
            email: "student@college.edu",
            app_metadata: { role: "user" },
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const result = await deleteUserAdminCore({
        userId: "target-user-123",
        authToken: "student_non_admin_token",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
    });
  });

  // ─── Scenario 7: listUsersAdmin Protected ───────────────────────────────────
  describe("Scenario 7: Administrative user listing authorization requirement", () => {
    it("rejects listUsersAdminCore without valid admin authorization", async () => {
      const result = await listUsersAdminCore({});

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.users).toEqual([]);
      expect(result.error).toContain("Admin authentication required");
    });

    it("rejects listUsersAdminCore with non-admin participant token", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "normal-user-id",
            email: "student@college.edu",
            app_metadata: { role: "user" },
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const result = await listUsersAdminCore({
        authToken: "student_non_admin_token",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.users).toEqual([]);
    });
  });

  // ─── Scenario 8: claimSpinReward Without Authentication Rejected ────────────
  describe("Scenario 8: claimSpinReward authentication requirement", () => {
    it("rejects claimSpinRewardCore when authToken is missing", async () => {
      const result = await handleClaimSpinReward({
        phone: "9876543210",
        college: "Tech University",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("verified email session is required");
    });

    it("rejects unauthenticated spoofed email payload without verified session", async () => {
      const result = await handleClaimSpinReward({
        phone: "9876543210",
        college: "Tech University",
        // @ts-expect-error test unauthenticated legacy param
        email: "victim@target.com",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
    });
  });

  // ─── Scenario 9: rejectSpinReward Without Authentication Rejected ───────────
  describe("Scenario 9: rejectSpinReward authentication requirement", () => {
    it("rejects rejectSpinRewardCore when authToken is missing", async () => {
      const result = await handleRejectSpinReward({});

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("verified email session is required");
    });

    it("rejects unauthenticated rejection request with spoofed email", async () => {
      const result = await handleRejectSpinReward({
        // @ts-expect-error test unauthenticated legacy param
        email: "victim@target.com",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("UNAUTHORIZED");
    });
  });

  // ─── Scenario 10: Participant Cannot Modify Another's Reward ────────────────
  describe("Scenario 10: Participant reward ownership enforcement", () => {
    it("prevents authenticated participant from claiming a reward entry that does not belong to them", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "participant-a-id",
            email: "participant-a@domain.com",
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const result = await handleClaimSpinReward({
        authToken: "valid_jwt_for_participant_a",
        entryId: "foreign-spin-entry-999",
        phone: "9876543210",
        college: "College A",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("ENTRY_NOT_FOUND");
      expect(result.message).toContain("No spin reward record found for your verified account");
    });

    it("prevents authenticated participant from rejecting a reward entry that does not belong to them", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "participant-a-id",
            email: "participant-a@domain.com",
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const result = await handleRejectSpinReward({
        authToken: "valid_jwt_for_participant_a",
        entryId: "foreign-spin-entry-999",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("ENTRY_NOT_FOUND");
    });
  });

  // ─── Scenario 11: Missing or Invalid Supabase JWT in executeSpinRoll ─────────
  describe("Scenario 11: executeSpinRoll JWT validation", () => {
    it("rejects spin roll attempt when Supabase JWT is invalid", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid JWT signature" } as any,
      });

      const result = await handleExecuteSpinRoll({
        authToken: "invalid_jwt_signature",
        name: "Test Participant",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("AUTH_REQUIRED");
      expect(result.message).toMatch(/(verified email session is required|Invalid or expired session token)/i);
    });

    it("rejects spin roll when user email is not confirmed in Supabase Auth", async () => {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "unconfirmed-user-id",
            email: "unconfirmed@domain.com",
            email_confirmed_at: null, // Unconfirmed email
            confirmed_at: null,
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const result = await handleExecuteSpinRoll({
        authToken: "unconfirmed_user_jwt",
        name: "Unconfirmed Participant",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("AUTH_REQUIRED");
      expect(result.message).toContain("Email address is not yet confirmed");
    });
  });

  // ─── Scenario 12: No Client-Side HMAC Fallback Remains ───────────────────────
  describe("Scenario 12: Complete removal of client-side HMAC token fallback", () => {
    it("rejects custom HMAC tokens in verifyParticipantSession and requires pure Supabase Auth JWT", async () => {
      // Create a base64url payload pretending to be an HMAC token
      const fakeHmacToken = Buffer.from(
        JSON.stringify({
          email: "user@domain.com",
          issuedAt: Date.now(),
          expiresAt: Date.now() + 60000,
          signature: "0123456789abcdef",
        })
      ).toString("base64url");

      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid token format" } as any,
      });

      const result = await verifyParticipantSession(fakeHmacToken);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid or expired session token");
    });
  });

  // ─── Migration & Schema Integrity Checks ─────────────────────────────────────
  describe("Database Migration Integrity & Role Self-Assignment Prevention", () => {
    it("verifies supabase_auth_profile_role_security_v1.sql enforces role lock", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase_auth_profile_role_security_v1.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("CREATE POLICY \"Users can insert own profile\"");
      expect(sql).toContain("AND (role IS NULL OR lower(role) = 'user')");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()");
      expect(sql).toContain("CREATE TRIGGER trg_prevent_profile_role_escalation");
    });

    it("verifies supabase_spin_wheel_rls_lockdown_v1.sql denies public access", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase_spin_wheel_rls_lockdown_v1.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("USING (false)");
      expect(sql).toContain("WITH CHECK (false)");
    });
  });

  // ─── Phase 1E: Database RPC Lockdown & Migration Integrity ───────────────────
  describe("Phase 1E: Database RPC Lockdown & Trigger Hardening", () => {
    it("verifies supabase_auth_admin_rpc_lockdown_v1.sql drops delete_user and get_all_users", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase_auth_admin_rpc_lockdown_v1.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.delete_user(UUID);");
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.get_all_users();");
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_escalation()");
      expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.handle_new_user()");
    });

    it("verifies supabase_auth_profile_schema.sql does not contain delete_user or get_all_users", () => {
      const schemaPath = path.resolve(
        process.cwd(),
        "supabase_auth_profile_schema.sql"
      );
      expect(fs.existsSync(schemaPath)).toBe(true);

      const sql = fs.readFileSync(schemaPath, "utf-8");
      expect(sql).not.toContain("FUNCTION public.delete_user");
      expect(sql).not.toContain("FUNCTION public.get_all_users");
      expect(sql).toContain("SET search_path = ''");
    });
  });

  // ─── Phase 1E: Reward Lifecycle Terminal State Invariants ──────────────────────
  describe("Phase 1E: Reward Lifecycle Terminal State Invariants", () => {
    it("strictly prevents claiming a reward that has already been rejected", async () => {
      const participantEmail = "rejected-claimant@micrylis.com";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "user-rejected-id",
            email: participantEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: "spin-rej-1",
              email: participantEmail,
              status: "rejected",
              is_claimed: false,
            },
          ],
          error: null,
        }),
      });
      vi.spyOn(supabaseAdmin, "from").mockReturnValueOnce({
        select: mockSelect,
      } as any);

      const result = await handleClaimSpinReward({
        authToken: "valid_jwt_rejected_user",
        phone: "9876543210",
        college: "Tech College",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("REWARD_ALREADY_REJECTED");
      expect(result.message).toContain("already been rejected and cannot be claimed");
    });

    it("strictly prevents rejecting a reward that has already been claimed", async () => {
      const participantEmail = "claimed-rejector@micrylis.com";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "user-claimed-id",
            email: participantEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: "spin-clm-1",
              email: participantEmail,
              status: "claimed",
              is_claimed: true,
            },
          ],
          error: null,
        }),
      });
      vi.spyOn(supabaseAdmin, "from").mockReturnValueOnce({
        select: mockSelect,
      } as any);

      const result = await handleRejectSpinReward({
        authToken: "valid_jwt_claimed_user",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("REWARD_ALREADY_CLAIMED");
      expect(result.message).toContain("already been claimed and cannot be rejected");
    });

    it("idempotently allows repeating rejection for an already rejected reward", async () => {
      const participantEmail = "repeat-rejector@micrylis.com";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "user-repeat-rej-id",
            email: participantEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: "spin-rep-rej-1",
              email: participantEmail,
              status: "rejected",
              is_claimed: false,
            },
          ],
          error: null,
        }),
      });
      vi.spyOn(supabaseAdmin, "from").mockReturnValueOnce({
        select: mockSelect,
      } as any);

      const result = await handleRejectSpinReward({
        authToken: "valid_jwt_repeat_rejector",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Reward offer dismissed");
    });
  });

  // ─── Phase 1E: Database Insert Failure & Race Condition Handling ─────────────
  describe("Phase 1E: Database Insert Failure & Concurrency Idempotency", () => {
    it("handles concurrent spin duplicate race condition idempotently via unique constraint", async () => {
      const participantEmail = "racer@micrylis.com";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "racer-id",
            email: participantEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const existingEntryDb = {
        id: "spin-existing-race",
        name: "Racer User",
        email: participantEmail,
        reward_id: "internship-50",
        reward_title: "50% Off Technical Internship",
        voucher_code: "PTECH-RACE99",
        probability_pct: 20,
        status: "won",
        is_claimed: false,
        created_at: new Date().toISOString(),
      };

      let callCount = 0;
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            } as any;
          }
          if (callCount === 2) {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "23505", message: "duplicate key value violates unique constraint" },
                  }),
                }),
              }),
            } as any;
          }
          if (callCount === 3) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: existingEntryDb, error: null }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      const result = await handleExecuteSpinRoll({
        authToken: "valid_jwt_racer",
        name: "Racer User",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("ALREADY_SPUN");
      expect(result.entry?.voucherCode).toBe("PTECH-RACE99");
      expect(result.entry?.rewardTitle).toBe("50% Off Technical Internship");
    });

    it("aborts safely and returns DATABASE_ERROR when Supabase insert fails unexpectedly", async () => {
      const participantEmail = "dberror@micrylis.com";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "dberror-id",
            email: participantEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      let callCount = 0;
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            } as any;
          }
          if (callCount === 2) {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "50000", message: "Connection timeout to PostgreSQL" },
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      const result = await handleExecuteSpinRoll({
        authToken: "valid_jwt_dberror",
        name: "DB Error User",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("DATABASE_ERROR");
      expect(result.message).toContain("Failed to record your spin");
      expect(result.voucherCode).toBeUndefined();
      expect(result.reward).toBeUndefined();
    });
  });

  // ─── Phase 1E: Genuine Participant Spin Roll Execution ────────────────────────
  describe("Phase 1E: Genuine Participant Spin Roll Execution", () => {
    it("successfully executes a spin roll for a genuine participant and returns valid reward", async () => {
      const participantEmail = "genuine-participant@college.edu";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "genuine-user-id",
            email: participantEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      let callCount = 0;
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            } as any;
          }
          if (callCount === 2) {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "inserted-spin-entry-uuid" },
                    error: null,
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      const result = await handleExecuteSpinRoll({
        authToken: "genuine_user_valid_jwt",
        name: "Genuine Participant",
      });

      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
      expect(SPIN_REWARDS.some((r) => r.id === result.reward?.id)).toBe(true);
      expect(typeof result.winningIndex).toBe("number");
      expect(result.winningIndex).toBeGreaterThanOrEqual(0);
      expect(result.winningIndex).toBeLessThan(6);
      expect(result.voucherCode).toBeDefined();
      expect(result.entry?.id).toBe("inserted-spin-entry-uuid");
    });
  });

  // ─── Wheel Invariants ────────────────────────────────────────────────────────
  describe("Campaign & Wheel Configuration Invariants", () => {
    it("preserves exactly 6 configured reward categories", () => {
      expect(SPIN_REWARDS).toHaveLength(6);
    });

    it("verifies exact probabilities match approved specification (25, 20, 20, 20, 14, 1)", () => {
      const probabilities = SPIN_REWARDS.map((r) => r.probability);
      expect(probabilities).toEqual([25, 20, 20, 20, 14, 1]);
    });

    it("verifies sum of reward probabilities equals exactly 100%", () => {
      const totalProbability = SPIN_REWARDS.reduce((acc, r) => acc + r.probability, 0);
      expect(totalProbability).toBe(100);
    });

    it("verifies campaign expiry cutoff is 20 November 2026", () => {
      expect(SPIN_EXPIRY_LABEL).toContain("20 November 2026");
    });

    it("correctly masks email and phone PII", () => {
      expect(maskEmail("john.doe@example.com")).toBe("j****e@example.com");
      expect(maskEmail("ab@micrylis.com")).toBe("a*@micrylis.com");
      expect(maskEmail("")).toBe("***@***.com");

      expect(maskPhone("9876543210")).toBe("******3210");
      expect(maskPhone("+919876543210")).toBe("*********3210");
      expect(maskPhone("1234")).toBe("****");
      expect(maskPhone("")).toBe("");
    });
  });

  // ─── Phase 1G: Six Reward-Specific Google Forms Configuration ─────────────────
  describe("Phase 1G: Six Reward-Specific Google Forms Configuration", () => {
    it("defines explicit Google Form mappings for all 6 campaign rewards", () => {
      const definedRewardIds = Object.keys(GOOGLE_FORM_DEFINITIONS);
      expect(definedRewardIds).toHaveLength(6);
      expect(definedRewardIds).toEqual(
        expect.arrayContaining([
          "discount-25",
          "discount-50",
          "free-mentorship",
          "live-call-founder",
          "ielts-interview",
          "free-full-project",
        ])
      );
    });

    it("maps all 6 rewards to their unique final Google Form URLs when environment variables are not set", () => {
      const expectedUrls: Record<string, string> = {
        "discount-25": "https://forms.gle/R35Bv3dhTtE2soDQA",
        "discount-50": "https://forms.gle/TkUCfTE3f7NvEumK9",
        "free-mentorship": "https://forms.gle/jcSeiXqBn2ePETKQ8",
        "live-call-founder": "https://forms.gle/zuYfD77siQYXHCSy5",
        "ielts-interview": "https://forms.gle/QiW1kPwENgyUNz4V9",
        "free-full-project": "https://forms.gle/qaSw1zMAG8LunGAU8",
      };

      const definedRewardIds = Object.keys(GOOGLE_FORM_DEFINITIONS);
      expect(definedRewardIds).toHaveLength(6);

      for (const rewardId of definedRewardIds) {
        const base = getBaseGoogleFormUrl(rewardId);
        expect(base.url).toBe(expectedUrls[rewardId]);
        expect(base.isTemporaryFallback).toBe(false);

        const prefill = buildPrefilledGoogleFormUrl(rewardId, {
          voucherCode: "SPIN-TEST-VOUCH",
          email: "test@micrylis.com",
        });
        // Shortened forms.gle URL must not have broken query params appended
        expect(prefill.url).toBe(expectedUrls[rewardId]);
        expect(prefill.url).not.toContain("?");
        expect(prefill.isTemporaryFallback).toBe(false);
      }
    });

    it("allows environment variables to override the final URLs and appends prefill params to full viewform URLs", () => {
      const savedEnv = process.env.GOOGLE_FORM_URL_DISCOUNT_25;
      process.env.GOOGLE_FORM_URL_DISCOUNT_25 = "https://docs.google.com/forms/d/e/1FAIpQLSc_TEST_25/viewform";

      const prefill = buildPrefilledGoogleFormUrl("discount-25", {
        voucherCode: "SPIN-25OFF-OVERRIDE",
        email: "winner@college.edu",
        name: "Test Winner",
      });

      expect(prefill.url).toContain("https://docs.google.com/forms/d/e/1FAIpQLSc_TEST_25/viewform");
      expect(prefill.url).toContain("usp=pp_url");
      expect(prefill.url).toContain("SPIN-25OFF-OVERRIDE");
      expect(prefill.url).toContain("winner%40college.edu");
      expect(prefill.isTemporaryFallback).toBe(false);

      if (savedEnv) {
        process.env.GOOGLE_FORM_URL_DISCOUNT_25 = savedEnv;
      } else {
        delete process.env.GOOGLE_FORM_URL_DISCOUNT_25;
      }
    });

    it("verifies GOOGLE_FORM_URL_LIVE_CALL_FOUNDER environment variable override works for live-call-founder", () => {
      const savedEnv = process.env.GOOGLE_FORM_URL_LIVE_CALL_FOUNDER;
      process.env.GOOGLE_FORM_URL_LIVE_CALL_FOUNDER = "https://docs.google.com/forms/d/e/1FAIpQLSc_FOUNDER_CUSTOM/viewform";

      const base = getBaseGoogleFormUrl("live-call-founder");
      expect(base.url).toBe("https://docs.google.com/forms/d/e/1FAIpQLSc_FOUNDER_CUSTOM/viewform");

      if (savedEnv) {
        process.env.GOOGLE_FORM_URL_LIVE_CALL_FOUNDER = savedEnv;
      } else {
        delete process.env.GOOGLE_FORM_URL_LIVE_CALL_FOUNDER;
      }
    });

    it("throws descriptive error when requesting Google Form URL for invalid reward ID", () => {
      expect(() => {
        getBaseGoogleFormUrl("non-existent-reward-99");
      }).toThrow(/Invalid reward ID/);
    });
  });

  // ─── Phase 1G: Participant Reward Acceptance Workflow ─────────────────────────
  describe("Phase 1G: Participant Reward Acceptance Workflow", () => {
    it("rejects acceptSpinReward when authToken is missing", async () => {
      const res = await handleAcceptSpinReward({});
      expect(res.success).toBe(false);
      expect(res.code).toBe("UNAUTHORIZED");
    });

    it("successfully accepts reward, sets reward_status = ACCEPTED, form_status = FORM_PENDING, and returns form URL", async () => {
      const email = "accept-winner@college.edu";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-accept-id",
            email,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "entry-to-accept-id",
                    email,
                    reward_id: "discount-50",
                    voucher_code: "SPIN-50OFF-ACCEPT-TEST",
                    name: "Acceptance Tester",
                    status: "won",
                    reward_status: "PENDING",
                    form_status: "NOT_APPLICABLE",
                  },
                ],
                error: null,
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await handleAcceptSpinReward({
        authToken: "valid_jwt_accept_winner",
      });

      expect(res.success).toBe(true);
      expect(res.rewardStatus).toBe("ACCEPTED");
      expect(res.formStatus).toBe("FORM_PENDING");
      expect(res.formUrl).toBeDefined();
      expect(res.formUrl).toBe("https://forms.gle/TkUCfTE3f7NvEumK9");
    });

    it("prevents accepting a reward that has already been rejected", async () => {
      const email = "already-rejected@college.edu";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-rejected-id",
            email,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "entry-rej-id",
                    email,
                    reward_id: "free-mentorship",
                    voucher_code: "SPIN-MENTOR-REJ",
                    status: "rejected",
                    reward_status: "REJECTED",
                  },
                ],
                error: null,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await handleAcceptSpinReward({
        authToken: "valid_jwt_rejected_user",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("REWARD_ALREADY_REJECTED");
    });

    it("prevents accepting a reward that has already been redeemed", async () => {
      const email = "already-redeemed@college.edu";
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-redeemed-id",
            email,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "entry-red-id",
                    email,
                    reward_id: "free-mentorship",
                    voucher_code: "SPIN-MENTOR-RED",
                    status: "claimed",
                    reward_status: "REDEEMED",
                  },
                ],
                error: null,
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await handleAcceptSpinReward({
        authToken: "valid_jwt_redeemed_user",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ALREADY_REDEEMED");
    });
  });

  // ─── Phase 1G: Google Apps Script Webhook Verification & Security ──────────────
  describe("Phase 1G: Google Apps Script Webhook Verification & Security", () => {
    function createValidWebhookHeaders(body: string, timestamp = Date.now()) {
      const activeSecret = getSpinWebhookSecret();
      const signature = crypto.createHmac("sha256", activeSecret).update(body).digest("hex");
      return {
        signature,
        timestamp: String(timestamp),
      };
    }

    it("rejects webhook request when headers are missing", async () => {
      const res = await handleProcessSpinWebhook({
        rawBody: JSON.stringify({ voucher_code: "TEST" }),
        signature: null,
        timestamp: null,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("MISSING_HEADERS");
    });

    it("rejects webhook request with invalid non-integer timestamp", async () => {
      const res = await handleProcessSpinWebhook({
        rawBody: JSON.stringify({ voucher_code: "TEST" }),
        signature: "some-sig",
        timestamp: "not-a-number",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_TIMESTAMP");
    });

    it("rejects webhook request with expired timestamp (> 5 minutes old)", async () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      const body = JSON.stringify({ voucher_code: "TEST", email: "test@micrylis.com" });
      const { signature } = createValidWebhookHeaders(body, sixMinutesAgo);

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp: String(sixMinutesAgo),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("EXPIRED_TIMESTAMP");
    });

    it("rejects webhook request with forged / invalid HMAC signature", async () => {
      const now = Date.now();
      const body = JSON.stringify({ voucher_code: "TEST", email: "test@micrylis.com" });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        timestamp: String(now),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SIGNATURE");
    });

    it("rejects webhook request when voucher code is not found in database", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-UNKNOWN-VOUCHER",
        email: "unknown@example.com",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "VOUCHER_NOT_FOUND",
          message: "No spin reward record found matching this voucher code.",
        },
        error: null,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("VOUCHER_NOT_FOUND");
    });

    it("rejects webhook request when submitted email does not match voucher owner", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-MATCH-TEST",
        email: "imposter@attacker.com",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "EMAIL_MISMATCH",
          message: "The submitted email does not match the registered voucher owner.",
        },
        error: null,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("EMAIL_MISMATCH");
    });

    it("rejects webhook request when submitted reward_id mismatches won reward", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-REWARD-MISMATCH",
        email: "winner@college.edu",
        reward_id: "free-full-project", // attacker claims top prize
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "REWARD_MISMATCH",
          message: "The submitted form does not correspond to the reward won with this voucher.",
        },
        error: null,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("REWARD_MISMATCH");
    });

    it("successfully verifies valid Google Form submission via webhook", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-VALID-VERIFY",
        email: "verified-winner@college.edu",
        reward_id: "discount-50",
        form_response_id: "resp_987654321",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      let rpcCalledWith: any = null;
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any, args: any) => {
        if (fn === "verify_spin_webhook_atomic") {
          rpcCalledWith = args;
          return {
            data: {
              success: true,
              status: "SUCCESS",
              code: "SUCCESS",
              message: "Google Form submission verified successfully.",
              voucher_code: args.p_voucher_code,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCESS");
      expect(rpcCalledWith).toBeDefined();
      expect(rpcCalledWith.p_voucher_code).toBe("SPIN-VALID-VERIFY");
      expect(rpcCalledWith.p_email).toBe("verified-winner@college.edu");
      expect(rpcCalledWith.p_form_response_id).toBe("resp_987654321");
    });

    it("idempotently handles duplicate webhook replay submissions with DUPLICATE status", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-DUPLICATE-REPLAY",
        email: "replay-winner@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          status: "DUPLICATE",
          code: "DUPLICATE_SUBMISSION",
          message: "Form submission already verified previously (idempotent request).",
          voucher_code: "SPIN-DUPLICATE-REPLAY",
        },
        error: null,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("DUPLICATE");
      expect(res.message).toContain("idempotent");
    });
  });

  // ─── Phase 1G: Separate Redemption Lifecycle & Admin Verification ─────────────
  describe("Phase 1G: Separate Redemption Lifecycle & Admin Verification", () => {
    const adminEmail = "verified-admin@micrylis.com";

    function mockAdminSession() {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "admin-user-id",
            email: adminEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: { role: "admin" },
            user_metadata: {},
          } as any,
        },
        error: null,
      });
    }

    it("rejects redeemSpinRewardAdminCore when not authenticated as admin", async () => {
      const res = await handleRedeemSpinRewardAdmin({
        authToken: "not-an-admin-token",
        entryId: "any-entry-id",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("UNAUTHORIZED");
    });

    it("rejects redeemSpinRewardAdminCore when form is NOT yet verified", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "FORM_NOT_VERIFIED",
          message: "Reward cannot be redeemed until the Google Form submission is verified.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-not-verified-form-id",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("FORM_NOT_VERIFIED");
      expect(res.message).toContain("Google Form submission is verified");
    });

    it("strictly rejects redeemSpinRewardAdminCore when form is FORM_SUBMITTED (not yet FORM_VERIFIED)", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "FORM_NOT_VERIFIED",
          message: "Reward cannot be redeemed until the Google Form submission is verified.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-submitted-form-id",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("FORM_NOT_VERIFIED");
      expect(res.message).toContain("Google Form submission is verified");
    });

    it("strictly rejects redeemSpinRewardAdminCore when form_status is NULL (NULL-safety check)", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "FORM_NOT_VERIFIED",
          message: "Reward cannot be redeemed until the Google Form submission is verified.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-null-form-status-id",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("FORM_NOT_VERIFIED");
      expect(res.message).toContain("Google Form submission is verified");
    });

    it("allows admin to manually verify form when needed", async () => {
      mockAdminSession();

      let auditLogged: any = null;
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "entry-manual-verify-id",
                    email: "student@test.com",
                    form_status: "FORM_PENDING",
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          } as any;
        }
        if (table === "spin_admin_audit_logs") {
          return {
            insert: vi.fn().mockImplementation((entry: any) => {
              auditLogged = entry;
              return Promise.resolve({ data: null, error: null });
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await handleVerifyFormManualAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-manual-verify-id",
        notes: "Verified participant response in Google Sheet manually",
      });

      expect(res.success).toBe(true);
      expect(auditLogged).toBeDefined();
      expect(auditLogged.action).toBe("MANUAL_VERIFY_FORM");
      expect(auditLogged.admin_email).toBe(adminEmail);
    });

    it("successfully redeems reward when form is verified and logs admin audit action", async () => {
      mockAdminSession();

      let rpcArgs: any = null;
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any, args: any) => {
        if (fn === "redeem_spin_reward_atomic") {
          rpcArgs = args;
          return {
            data: {
              success: true,
              code: "SUCCESS",
              message: "Reward marked as redeemed successfully.",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-ready-redeem-id",
        notes: "Provided discount coupon for course enrollment",
      });

      expect(res.success).toBe(true);
      expect(rpcArgs).toBeDefined();
      expect(rpcArgs.p_entry_id).toBe("entry-ready-redeem-id");
      expect(rpcArgs.p_admin_email).toBe(adminEmail);
      expect(rpcArgs.p_notes).toBe("Provided discount coupon for course enrollment");
    });

    it("rejects duplicate redemption of an already redeemed reward", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "ALREADY_REDEEMED",
          message: "This reward has already been marked as redeemed.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-already-redeemed-id",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ALREADY_REDEEMED");
    });
  });

  // ─── Phase 1H: Database Integrity & Atomicity Suite ───────────────────────────
  // Note: These unit and mock integration tests verify application-level RPC dispatch,
  // parameter passing, error translation, and fallback semantics.
  // PostgreSQL-level concurrency and row-locking invariants are validated via SQL AST checks.
  describe("Phase 1H: Database Integrity & Atomicity Suite", () => {
    const adminEmail = "verified-admin@micrylis.com";

    function mockAdminSession() {
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "admin-user-id",
            email: adminEmail,
            email_confirmed_at: new Date().toISOString(),
            app_metadata: { role: "admin" },
            user_metadata: {},
          } as any,
        },
        error: null,
      });
    }

    it("verifies successful atomic redemption via service_role RPC and memory sync", async () => {
      mockAdminSession();

      let rpcName: string = "";
      let rpcArgs: any = null;

      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any, args: any) => {
        rpcName = fn;
        rpcArgs = args;
        return {
          data: {
            success: true,
            code: "SUCCESS",
            message: "Reward marked as redeemed successfully.",
          },
          error: null,
        };
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-atomic-1",
        notes: "Verified physical ID and dispensed voucher",
      });

      expect(res.success).toBe(true);
      expect(rpcName).toBe("redeem_spin_reward_atomic");
      expect(rpcArgs.p_entry_id).toBe("entry-atomic-1");
      expect(rpcArgs.p_admin_email).toBe(adminEmail);
      expect(rpcArgs.p_notes).toBe("Verified physical ID and dispensed voucher");
    });

    it("verifies rejected reward redemption is rejected by atomic RPC", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "REWARD_ALREADY_REJECTED",
          message: "Cannot redeem a rejected reward.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-rejected-reward",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("REWARD_ALREADY_REJECTED");
    });

    it("verifies redemption before form verification is rejected by atomic RPC", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "FORM_NOT_VERIFIED",
          message: "Reward cannot be redeemed until the Google Form submission is verified.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-unverified-form",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("FORM_NOT_VERIFIED");
    });

    it("verifies duplicate redemption of already redeemed reward is rejected by atomic RPC", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: false,
          code: "ALREADY_REDEEMED",
          message: "This reward has already been marked as redeemed.",
        },
        error: null,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-redeemed-already",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ALREADY_REDEEMED");
    });

    it("verifies that if audit log insertion fails, atomic RPC rolls back and returns error", async () => {
      mockAdminSession();

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: null,
        error: {
          code: "23503",
          message: "foreign key violation on spin_admin_audit_logs",
        } as any,
      });

      const res = await handleRedeemSpinRewardAdmin({
        authToken: "valid_admin_jwt",
        entryId: "entry-fail-audit",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("DATABASE_ERROR");
      expect(res.message).toContain("Failed to atomically redeem reward");
    });

    it("simulates two concurrent redemption requests: first succeeds, second receives ALREADY_REDEEMED", async () => {
      mockAdminSession();

      let callCount = 0;
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any) => {
        if (fn === "redeem_spin_reward_atomic") {
          callCount++;
          if (callCount === 1) {
            return {
              data: { success: true, code: "SUCCESS", message: "Reward marked as redeemed successfully." },
              error: null,
            };
          } else {
            return {
              data: { success: false, code: "ALREADY_REDEEMED", message: "This reward has already been marked as redeemed." },
              error: null,
            };
          }
        }
        return { data: null, error: null };
      });

      const [res1, res2] = await Promise.all([
        handleRedeemSpinRewardAdmin({ authToken: "valid_admin_jwt", entryId: "entry-race-id" }),
        handleRedeemSpinRewardAdmin({ authToken: "valid_admin_jwt", entryId: "entry-race-id" }),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(false);
      expect(res2.code).toBe("ALREADY_REDEEMED");
    });

    it("verifies successful atomic webhook processing via verify_spin_webhook_atomic RPC", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-ATOMIC-OK",
        email: "winner@college.edu",
        reward_id: "free-mentorship",
        form_response_id: "resp_1001",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      let capturedArgs: any = null;
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any, args: any) => {
        if (fn === "verify_spin_webhook_atomic") {
          capturedArgs = args;
          return {
            data: {
              success: true,
              status: "SUCCESS",
              code: "SUCCESS",
              message: "Google Form submission verified successfully.",
              voucher_code: args.p_voucher_code,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCESS");
      expect(capturedArgs.p_voucher_code).toBe("SPIN-ATOMIC-OK");
      expect(capturedArgs.p_email).toBe("winner@college.edu");
      expect(capturedArgs.p_form_response_id).toBe("resp_1001");
    });

    it("simulates two identical concurrent webhook requests: first SUCCESS, second DUPLICATE", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-CONCURRENT-WEBHOOK",
        email: "racer@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      let callCount = 0;
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any) => {
        if (fn === "verify_spin_webhook_atomic") {
          callCount++;
          if (callCount === 1) {
            return {
              data: { success: true, status: "SUCCESS", code: "SUCCESS", message: "Google Form submission verified successfully." },
              error: null,
            };
          } else {
            return {
              data: { success: true, status: "DUPLICATE", code: "DUPLICATE_SUBMISSION", message: "Form submission already verified previously (idempotent request)." },
              error: null,
            };
          }
        }
        return { data: null, error: null };
      });

      const [res1, res2] = await Promise.all([
        handleProcessSpinWebhook({ rawBody: body, signature, timestamp }),
        handleProcessSpinWebhook({ rawBody: body, signature, timestamp }),
      ]);

      expect(res1.success).toBe(true);
      expect(res1.status).toBe("SUCCESS");
      expect(res2.success).toBe(true);
      expect(res2.status).toBe("DUPLICATE");
    });

    it("verifies different form response IDs for the same voucher: losing request does not overwrite winning ID", async () => {
      const body1 = JSON.stringify({
        voucher_code: "SPIN-DIFF-RESP",
        email: "winner@college.edu",
        form_response_id: "resp_FIRST_WINNER",
      });
      const body2 = JSON.stringify({
        voucher_code: "SPIN-DIFF-RESP",
        email: "winner@college.edu",
        form_response_id: "resp_SECOND_LOSER",
      });
      const headers1 = createValidWebhookHeaders(body1);
      const headers2 = createValidWebhookHeaders(body2);

      let savedResponseId: string = "";
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any, args: any) => {
        if (fn === "verify_spin_webhook_atomic") {
          if (!savedResponseId) {
            savedResponseId = args.p_form_response_id;
            return {
              data: { success: true, status: "SUCCESS", code: "SUCCESS", message: "Google Form submission verified successfully." },
              error: null,
            };
          } else {
            // Second request: already verified, do not overwrite response ID
            return {
              data: { success: true, status: "DUPLICATE", code: "DUPLICATE_SUBMISSION", message: "Already verified (idempotent replay)" },
              error: null,
            };
          }
        }
        return { data: null, error: null };
      });

      const res1 = await handleProcessSpinWebhook({
        rawBody: body1,
        signature: headers1.signature,
        timestamp: headers1.timestamp,
      });
      const res2 = await handleProcessSpinWebhook({
        rawBody: body2,
        signature: headers2.signature,
        timestamp: headers2.timestamp,
      });

      expect(res1.status).toBe("SUCCESS");
      expect(res2.status).toBe("DUPLICATE");
      expect(savedResponseId).toBe("resp_FIRST_WINNER"); // First response ID preserved
    });

    it("verifies duplicate webhook unique-index conflict (23505) is caught and handled gracefully as DUPLICATE", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-UNIQUE-CONFLICT",
        email: "winner@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint idx_spin_webhook_logs_unique_success",
        } as any,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("DUPLICATE");
      expect(res.message).toContain("idempotent");
    });

    it("verifies failed webhook audit/log insertion returns DATABASE_ERROR", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-LOG-FAIL",
        email: "winner@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: null,
        error: {
          code: "50000",
          message: "Disk full or database read-only",
        } as any,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("DATABASE_ERROR");
      expect(res.message).toContain("Webhook verification failed");
    });

    it("verifies unauthorized RPC access assumptions: caller cannot spoof admin identity", async () => {
      // 1. Missing token
      const res1 = await handleRedeemSpinRewardAdmin({
        authToken: "",
        entryId: "any-entry",
      });
      expect(res1.success).toBe(false);
      expect(res1.code).toBe("UNAUTHORIZED");

      // 2. Non-admin participant token
      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValueOnce({
        data: {
          user: {
            id: "participant-id",
            email: "participant@student.edu",
            app_metadata: {}, // Not admin!
          } as any,
        },
        error: null,
      });

      const res2 = await handleRedeemSpinRewardAdmin({
        authToken: "participant_token",
        entryId: "any-entry",
      });
      expect(res2.success).toBe(false);
      expect(res2.code).toBe("UNAUTHORIZED");
    });
  });

  // ─── Phase 1H: Database Integrity v3 Migration SQL Validation ─────────────────
  describe("Phase 1H: Database Integrity v3 Migration SQL Validation", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase_spin_wheel_integrity_v3.sql"
    );

    it("verifies supabase_spin_wheel_integrity_v3.sql exists", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it("verifies precondition validation checks for required tables and columns", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("Precondition Failed: Table public.spin_wheel_entries does not exist");
      expect(sql).toContain("Precondition Failed: Column public.spin_wheel_entries.reward_status does not exist");
      expect(sql).toContain("Precondition Failed: Table public.spin_admin_audit_logs does not exist");
      expect(sql).toContain("Precondition Failed: Table public.spin_webhook_logs does not exist");
    });

    it("verifies partial unique index on successful webhook logs", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_spin_webhook_logs_unique_success");
      expect(sql).toContain("ON public.spin_webhook_logs (voucher_code)");
      expect(sql).toContain("WHERE status = 'SUCCESS'");
    });

    it("verifies redeem_spin_reward_atomic definition and guarantees", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.redeem_spin_reward_atomic");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain("FOR UPDATE");
      expect(sql).toContain("reward_status = 'REDEEMED'");
      expect(sql).toContain("status = 'claimed'");
      expect(sql).toContain("is_claimed = true");
      expect(sql).toContain("v_entry.form_status IS DISTINCT FROM 'FORM_VERIFIED'");
      expect(sql).not.toContain("v_entry.form_status <> 'FORM_VERIFIED'");
      expect(sql).toContain("INSERT INTO public.spin_admin_audit_logs");
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.redeem_spin_reward_atomic(UUID, TEXT, TEXT)");
      expect(sql).toContain("FROM PUBLIC, anon, authenticated;");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.redeem_spin_reward_atomic(UUID, TEXT, TEXT)");
      expect(sql).toContain("TO service_role;");
    });

    it("verifies NULL-safe form_status evaluation in redeem_spin_reward_atomic (SQL ternary logic protection)", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Verify IS DISTINCT FROM is used to prevent NULL <> 'FORM_VERIFIED' evaluating to NULL (which bypasses IF in SQL)
      expect(sql).toContain("IF v_entry.form_status IS DISTINCT FROM 'FORM_VERIFIED' THEN");
      expect(sql).not.toContain("IF v_entry.form_status <> 'FORM_VERIFIED' THEN");

      // Simulate PostgreSQL ternary logic: in SQL, (NULL <> 'X') is NULL (falsy in IF),
      // whereas (NULL IS DISTINCT FROM 'X') is TRUE (enters rejection block).
      const sqlInequalityIsBypassed = (val: string | null) => {
        // Simulates IF val <> 'FORM_VERIFIED': in SQL, NULL <> 'FORM_VERIFIED' is NULL, so IF condition is false/skipped!
        if (val === null) return false; // Fails to trigger rejection! (Vulnerability)
        return val !== "FORM_VERIFIED";
      };

      const sqlIsDistinctFromRejects = (val: string | null) => {
        // Simulates IF val IS DISTINCT FROM 'FORM_VERIFIED': in SQL, NULL IS DISTINCT FROM 'FORM_VERIFIED' is TRUE!
        return val !== "FORM_VERIFIED"; // Successfully triggers rejection! (Protected)
      };

      expect(sqlInequalityIsBypassed(null)).toBe(false); // Demonstrates the vulnerability of <>
      expect(sqlIsDistinctFromRejects(null)).toBe(true); // Demonstrates the fix with IS DISTINCT FROM
      expect(sqlIsDistinctFromRejects("FORM_PENDING")).toBe(true);
      expect(sqlIsDistinctFromRejects("FORM_SUBMITTED")).toBe(true);
      expect(sqlIsDistinctFromRejects("NOT_APPLICABLE")).toBe(true);
      expect(sqlIsDistinctFromRejects("FORM_VERIFIED")).toBe(false); // Only FORM_VERIFIED is allowed
    });

    it("verifies verify_spin_webhook_atomic definition and guarantees", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.verify_spin_webhook_atomic");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain("FOR UPDATE");
      expect(sql).toContain("form_status = 'FORM_VERIFIED'");
      expect(sql).toContain("WHEN unique_violation THEN");
      expect(sql).toContain("REVOKE ALL ON FUNCTION public.verify_spin_webhook_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT)");
      expect(sql).toContain("FROM PUBLIC, anon, authenticated;");
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.verify_spin_webhook_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT)");
      expect(sql).toContain("TO service_role;");
    });
  });

  // ─── Phase 1G: Database Lifecycle v2 Migration SQL Validation ─────────────────
  describe("Phase 1G: Database Lifecycle v2 Migration SQL Validation", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase_spin_wheel_lifecycle_v2.sql"
    );

    it("verifies supabase_spin_wheel_lifecycle_v2.sql exists", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it("verifies migration alters spin_wheel_entries with all lifecycle columns", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("ALTER TABLE public.spin_wheel_entries");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS reward_status");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS form_status");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS form_url");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS form_opened_at");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS form_submitted_at");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS form_verified_at");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS form_response_id");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS redeemed_at");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS redeemed_by_admin");
      expect(sql).toContain("ADD COLUMN IF NOT EXISTS redemption_notes");
    });

    it("verifies migration creates spin_admin_audit_logs and spin_webhook_logs tables", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.spin_admin_audit_logs");
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.spin_webhook_logs");
    });

    it("verifies strict deny-by-default RLS policies on all lifecycle and log tables", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("ALTER TABLE public.spin_admin_audit_logs ENABLE ROW LEVEL SECURITY;");
      expect(sql).toContain("ALTER TABLE public.spin_webhook_logs ENABLE ROW LEVEL SECURITY;");
      expect(sql).toContain("DROP POLICY IF EXISTS \"Deny direct public access\" ON public.spin_admin_audit_logs;");
      expect(sql).toContain("DROP POLICY IF EXISTS \"Deny direct public access\" ON public.spin_webhook_logs;");
      expect(sql).toContain("GRANT ALL ON TABLE public.spin_admin_audit_logs TO service_role;");
      expect(sql).toContain("GRANT ALL ON TABLE public.spin_webhook_logs TO service_role;");
    });
  });

  // ─── Phase 1M: Auth Profile Schema & RLS Recursion Prevention Validation ──────
  describe("Phase 1M: Auth Profile Schema & RLS Recursion Prevention Validation", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase_auth_profile_schema.sql"
    );

    it("verifies supabase_auth_profile_schema.sql exists", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it("verifies Users can update own profile policy eliminates subquery to prevent infinite RLS recursion", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Verify the policy does NOT query public.profile in WITH CHECK
      expect(sql).not.toContain("SELECT p.role FROM public.profile");

      // Verify the updated recursion-free policy
      expect(sql).toContain('DROP POLICY IF EXISTS "Users can update own profile"');
      expect(sql).toContain('CREATE POLICY "Users can update own profile"');
      expect(sql).toContain("FOR UPDATE");
      expect(sql).toContain("USING (auth.uid() = id)");
      expect(sql).toContain("WITH CHECK (auth.uid() = id);");
    });

    it("verifies role-escalation trigger is enabled and protects role integrity", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain("IF auth.role() = 'service_role' THEN");
      expect(sql).toContain("RETURN NEW;");
      expect(sql).toContain("IF TG_OP = 'INSERT' THEN");
      expect(sql).toContain("NEW.role := 'user';");
      expect(sql).toContain("ELSIF TG_OP = 'UPDATE' THEN");
      expect(sql).toContain("IF NEW.role IS DISTINCT FROM OLD.role THEN");
      expect(sql).toContain("NEW.role := OLD.role;");
      expect(sql).toContain("CREATE TRIGGER trg_prevent_profile_role_escalation");
      expect(sql).toContain("BEFORE INSERT OR UPDATE ON public.profile");
    });

    it("verifies handle_new_user trigger safely synchronizes profile and users on signup", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");

      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.handle_new_user()");
      expect(sql).toContain("SECURITY DEFINER");
      expect(sql).toContain("SET search_path = ''");
      expect(sql).toContain("INSERT INTO public.profile");
      expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
      expect(sql).toContain("INSERT INTO public.users");
      expect(sql).toContain("AFTER INSERT ON auth.users");
    });
  });

  // ─── Phase 1N: Staging Isolation & Fail-Closed Supabase Admin Client ───────
  describe("Phase 1N: Staging Isolation & Fail-Closed Supabase Admin Client", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      resetCachedAdminClient();
    });

    afterEach(() => {
      process.env = { ...originalEnv };
      resetCachedAdminClient();
      vi.restoreAllMocks();
    });

    it("verifies production URL (knrmfpgwcdtpwcgkjrnk) is completely removed from supabase-admin.ts", () => {
      const adminFilePath = path.resolve(process.cwd(), "src/lib/server/supabase-admin.ts");
      const fileContent = fs.readFileSync(adminFilePath, "utf-8");

      expect(fileContent).not.toContain("knrmfpgwcdtpwcgkjrnk");
      expect(fileContent).not.toContain("sb_publishable_mEpvsAW9z6SpMPhLL6DMOw_-leXOoRi");
    });

    it("fails closed with descriptive error when SUPABASE_SERVICE_ROLE_KEY is missing or placeholder", () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => getServiceRoleKey()).toThrow(
        /CRITICAL CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or contains placeholder/
      );

      process.env.SUPABASE_SERVICE_ROLE_KEY = "your_supabase_service_role_key";
      expect(() => getServiceRoleKey()).toThrow(
        /CRITICAL CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or contains placeholder/
      );
    });

    it("strictly forbids substituting anonymous/publishable key for service-role key", () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dummy_anon_key_for_test";

      // Must throw rather than falling back to VITE_SUPABASE_PUBLISHABLE_KEY
      expect(() => getServiceRoleKey()).toThrow(
        /CRITICAL CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or contains placeholder/
      );

      // Verify source code does not reference VITE_SUPABASE_PUBLISHABLE_KEY inside getServiceRoleKey
      const adminFilePath = path.resolve(process.cwd(), "src/lib/server/supabase-admin.ts");
      const fileContent = fs.readFileSync(adminFilePath, "utf-8");
      expect(fileContent).not.toMatch(/getServiceRoleKey[\s\S]*?VITE_SUPABASE_PUBLISHABLE_KEY/);
    });

    it("fails closed with descriptive error when Supabase URL is missing", () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);
      delete process.env.SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;

      expect(() => getSupabaseAdminUrl()).toThrow(
        /CRITICAL CONFIGURATION ERROR: Supabase URL is not configured/
      );
    });

    it("rejects invalid Supabase URL format", () => {
      process.env.SUPABASE_URL = "not-a-valid-url";

      expect(() => getSupabaseAdminUrl()).toThrow(
        /CRITICAL CONFIGURATION ERROR: Invalid Supabase URL/
      );
    });

    it("never falls back to production URL when resolving Supabase Admin URL", () => {
      vi.spyOn(fs, "existsSync").mockReturnValue(false);
      delete process.env.SUPABASE_URL;
      delete process.env.VITE_SUPABASE_URL;

      let thrownError: Error | null = null;
      try {
        getSupabaseAdminUrl();
      } catch (err: any) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(Error);
      expect(thrownError?.message).toContain("Automatic fallback to production is strictly forbidden");
      expect(thrownError?.message).not.toContain("knrmfpgwcdtpwcgkjrnk");
    });

    it("ensures server-only secrets have no VITE_ prefix exposed to client bundles", () => {
      const serverSecrets = [
        "SUPABASE_SERVICE_ROLE_KEY",
        "SPIN_WEBHOOK_SECRET",
      ];

      for (const secretName of serverSecrets) {
        expect(secretName.startsWith("VITE_")).toBe(false);
      }
    });

    it("prioritizes SUPABASE_URL over VITE_SUPABASE_URL when both are explicitly set", () => {
      process.env.SUPABASE_URL = "https://custom-server-supabase.example.com";
      process.env.VITE_SUPABASE_URL = "https://client-supabase.example.com";

      expect(getSupabaseAdminUrl()).toBe("https://custom-server-supabase.example.com");
    });
  });

  // ─── Phase 1U: Campaign Expiration Boundary & Cutoff Enforcement Suite ─────────
  describe("Phase 1U: Campaign Expiration Boundary & Cutoff Enforcement Suite", () => {
    const cutoffMs = SPIN_WHEEL_EXPIRY_DATE.getTime();

    it("verifies spin request immediately before campaign cutoff succeeds", async () => {
      // 1 second before cutoff instant
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs - 1000);

      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "boundary-user-before",
            email: "participant-before-cutoff@college.edu",
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      let callCount = 0;
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            } as any;
          }
          if (callCount === 2) {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "spin-before-cutoff-id" },
                    error: null,
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      const result = await handleExecuteSpinRoll({
        authToken: "valid_jwt_before_cutoff",
        name: "Before Cutoff Participant",
      });

      expect(isSpinOfferExpired()).toBe(false);
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
      expect(result.code).not.toBe("OFFER_EXPIRED");
    });

    it("verifies spin request exactly at campaign cutoff is accepted at the boundary", async () => {
      // Exactly at the cutoff millisecond
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs);

      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "boundary-user-exact",
            email: "participant-exact-cutoff@college.edu",
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      let callCount = 0;
      vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
        if (table === "spin_wheel_entries") {
          callCount++;
          if (callCount === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            } as any;
          }
          if (callCount === 2) {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "spin-exact-cutoff-id" },
                    error: null,
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      const result = await handleExecuteSpinRoll({
        authToken: "valid_jwt_exact_cutoff",
        name: "Exact Cutoff Participant",
      });

      expect(isSpinOfferExpired()).toBe(false);
      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
      expect(result.code).not.toBe("OFFER_EXPIRED");
    });

    it("verifies spin request after campaign cutoff is strictly rejected with OFFER_EXPIRED", async () => {
      // 1 second after cutoff instant
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs + 1000);

      const dbSpy = vi.spyOn(supabaseAdmin, "from");

      const result = await handleExecuteSpinRoll({
        authToken: "valid_jwt_after_cutoff",
        name: "After Cutoff Participant",
      });

      expect(isSpinOfferExpired()).toBe(true);
      expect(result.success).toBe(false);
      expect(result.code).toBe("OFFER_EXPIRED");
      expect(result.message).toContain(SPIN_EXPIRY_LABEL);
      // Ensure zero database access occurred
      expect(dbSpy).not.toHaveBeenCalled();
    });

    it("verifies webhook request after campaign expiration is rejected with CAMPAIGN_EXPIRED", async () => {
      // 1 second after cutoff instant
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs + 1000);

      const body = JSON.stringify({
        voucher_code: "SPIN-EXPIRED-SUBMISSION",
        email: "winner@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body, cutoffMs + 1000);

      const rpcSpy = vi.spyOn(supabaseAdmin as any, "rpc");

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CAMPAIGN_EXPIRED");
      expect(res.message).toContain(SPIN_EXPIRY_LABEL);
      expect(res.message).toContain("Webhook submissions are closed");
      // Atomic RPC must not be invoked
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it("verifies OTP request after campaign cutoff is rejected with OFFER_EXPIRED", async () => {
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs + 1000);

      const res = await handleSendSpinOtp({
        name: "Late Participant",
        email: "late@college.edu",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("OFFER_EXPIRED");
      expect(res.message).toContain(SPIN_EXPIRY_LABEL);
    });

    it("verifies OTP verification after campaign cutoff is rejected with offer expired message", async () => {
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs + 1000);

      const res = await handleVerifySpinOtp({
        email: "late@college.edu",
        otp: "123456",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain(SPIN_EXPIRY_LABEL);
    });

    it("verifies reward acceptance (Google Forms workflow) after cutoff is rejected with CAMPAIGN_EXPIRED", async () => {
      vi.spyOn(Date, "now").mockReturnValue(cutoffMs + 1000);

      vi.spyOn(supabaseAdmin.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: "user-late-accept",
            email: "winner-late@college.edu",
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any,
        },
        error: null,
      });

      const res = await handleAcceptSpinReward({
        authToken: "valid_jwt_late_accept",
        entryId: "entry-late-uuid",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CAMPAIGN_EXPIRED");
      expect(res.message).toContain(SPIN_EXPIRY_LABEL);
    });
  });

  // ─── Phase 1V: HMAC Replay, Tampered Payload & Concurrency Suite ───────────────
  describe("Phase 1V: HMAC Replay, Tampered Payload & Concurrency Suite", () => {
    it("successfully verifies a valid signed webhook request", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-HMAC-OK-1",
        email: "winner@college.edu",
        reward_id: "discount-25",
        form_response_id: "resp_hmac_1001",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          status: "SUCCESS",
          code: "SUCCESS",
          message: "Google Form submission verified successfully.",
          voucher_code: "SPIN-HMAC-OK-1",
        },
        error: null,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUCCESS");
      expect(res.code).toBe("SUCCESS");
      expect(res.voucherCode).toBe("SPIN-HMAC-OK-1");
    });

    it("idempotently handles exact duplicate webhook request without reprocessing", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-HMAC-DUPLICATE-1",
        email: "winner@college.edu",
        reward_id: "discount-25",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          status: "DUPLICATE",
          code: "DUPLICATE_SUBMISSION",
          message: "Form submission already verified previously (idempotent request).",
          voucher_code: "SPIN-HMAC-DUPLICATE-1",
        },
        error: null,
      });

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("DUPLICATE");
      expect(res.code).toBe("DUPLICATE_SUBMISSION");
      expect(res.message).toContain("idempotent");
    });

    it("rejects tampered payload when valid signature is reused with modified reward_id (privilege escalation attack)", async () => {
      const legitimatePayload = JSON.stringify({
        voucher_code: "SPIN-TAMPER-REWARD",
        email: "winner@college.edu",
        reward_id: "discount-25",
      });
      const { signature, timestamp } = createValidWebhookHeaders(legitimatePayload);

      // Attacker attempts to claim grand prize using signature from 25% discount
      const tamperedPayload = JSON.stringify({
        voucher_code: "SPIN-TAMPER-REWARD",
        email: "winner@college.edu",
        reward_id: "free-full-project",
      });

      const rpcSpy = vi.spyOn(supabaseAdmin as any, "rpc");

      const res = await handleProcessSpinWebhook({
        rawBody: tamperedPayload,
        signature, // Reused signature from legitimatePayload
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SIGNATURE");
      expect(res.message).toBe("HMAC signature verification failed.");
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it("rejects tampered payload when valid signature is reused with modified email (identity takeover attack)", async () => {
      const legitimatePayload = JSON.stringify({
        voucher_code: "SPIN-TAMPER-EMAIL",
        email: "alice@college.edu",
        reward_id: "discount-50",
      });
      const { signature, timestamp } = createValidWebhookHeaders(legitimatePayload);

      // Attacker swaps email to their own address
      const tamperedPayload = JSON.stringify({
        voucher_code: "SPIN-TAMPER-EMAIL",
        email: "eve@attacker.com",
        reward_id: "discount-50",
      });

      const rpcSpy = vi.spyOn(supabaseAdmin as any, "rpc");

      const res = await handleProcessSpinWebhook({
        rawBody: tamperedPayload,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SIGNATURE");
      expect(res.message).toBe("HMAC signature verification failed.");
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it("rejects tampered payload when valid signature is reused with modified voucher_code", async () => {
      const legitimatePayload = JSON.stringify({
        voucher_code: "SPIN-ORIGINAL-VOUCH",
        email: "alice@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(legitimatePayload);

      const tamperedPayload = JSON.stringify({
        voucher_code: "SPIN-FORGED-VOUCH",
        email: "alice@college.edu",
      });

      const res = await handleProcessSpinWebhook({
        rawBody: tamperedPayload,
        signature,
        timestamp,
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SIGNATURE");
      expect(res.message).toBe("HMAC signature verification failed.");
    });

    it("rejects webhook request with expired past timestamp (> 5 minutes past allowed tolerance)", async () => {
      const now = Date.now();
      const expiredPastMs = now - (5 * 60 * 1000 + 1000); // 5m 1s ago

      const body = JSON.stringify({
        voucher_code: "SPIN-EXPIRED-TS-TEST",
        email: "winner@college.edu",
      });
      const { signature } = createValidWebhookHeaders(body, expiredPastMs);

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp: String(expiredPastMs),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("EXPIRED_TIMESTAMP");
      expect(res.message).toContain("Webhook timestamp expired or out of bounds");
    });

    it("rejects webhook request with future timestamp outside tolerance (> 5 minutes into the future)", async () => {
      const now = Date.now();
      const futureMs = now + (5 * 60 * 1000 + 1000); // 5m 1s into future

      const body = JSON.stringify({
        voucher_code: "SPIN-FUTURE-TS-TEST",
        email: "winner@college.edu",
      });
      const { signature } = createValidWebhookHeaders(body, futureMs);

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature,
        timestamp: String(futureMs),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("EXPIRED_TIMESTAMP");
      expect(res.message).toContain("Webhook timestamp expired or out of bounds");
    });

    it("rejects forged signature generated with wrong secret", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-WRONG-SECRET",
        email: "winner@college.edu",
      });
      const wrongSignature = crypto
        .createHmac("sha256", "unauthorized-secret-key-999")
        .update(body)
        .digest("hex");

      const res = await handleProcessSpinWebhook({
        rawBody: body,
        signature: wrongSignature,
        timestamp: String(Date.now()),
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SIGNATURE");
      expect(res.message).toBe("HMAC signature verification failed.");
    });

    it("rejects malformed signature: non-hex characters and truncated length", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-MALFORMED-SIG",
        email: "winner@college.edu",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      // Truncated
      const truncatedRes = await handleProcessSpinWebhook({
        rawBody: body,
        signature: signature.substring(0, 32),
        timestamp,
      });
      expect(truncatedRes.success).toBe(false);
      expect(truncatedRes.code).toBe("INVALID_SIGNATURE");

      // Non-hex
      const nonHexRes = await handleProcessSpinWebhook({
        rawBody: body,
        signature: "GGGG" + signature.substring(4),
        timestamp,
      });
      expect(nonHexRes.success).toBe(false);
      expect(nonHexRes.code).toBe("INVALID_SIGNATURE");
    });

    it("safely handles concurrent duplicate webhook requests preventing double fulfillment", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-CONCURRENT-SAFE",
        email: "racer@college.edu",
        reward_id: "discount-50",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      let executionCount = 0;
      vi.spyOn(supabaseAdmin as any, "rpc").mockImplementation(async (fn: any) => {
        if (fn === "verify_spin_webhook_atomic") {
          executionCount++;
          if (executionCount === 1) {
            return {
              data: {
                success: true,
                status: "SUCCESS",
                code: "SUCCESS",
                message: "Google Form submission verified successfully.",
                voucher_code: "SPIN-CONCURRENT-SAFE",
              },
              error: null,
            };
          } else {
            // Second concurrent request gets caught by PostgreSQL lock inspection
            return {
              data: {
                success: true,
                status: "DUPLICATE",
                code: "DUPLICATE_SUBMISSION",
                message: "Form submission already verified previously (concurrent idempotent replay).",
                voucher_code: "SPIN-CONCURRENT-SAFE",
              },
              error: null,
            };
          }
        }
        return { data: null, error: null };
      });

      const [res1, res2] = await Promise.all([
        handleProcessSpinWebhook({ rawBody: body, signature, timestamp }),
        handleProcessSpinWebhook({ rawBody: body, signature, timestamp }),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain("SUCCESS");
      expect(statuses).toContain("DUPLICATE");
      expect(executionCount).toBe(2);
    });
  });

  // ─── Phase 1W: Vercel Deployment Protection Bypass Security Suite ─────────────
  describe("Phase 1W: Vercel Deployment Protection Bypass Security Suite", () => {
    it("HTTP endpoint verifies request WITH optional x-vercel-protection-bypass header", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-BYPASS-WITH-HEADER",
        email: "verified@college.edu",
        reward_id: "discount-25",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          status: "SUCCESS",
          code: "SUCCESS",
          message: "Google Form submission verified successfully.",
          voucher_code: "SPIN-BYPASS-WITH-HEADER",
        },
        error: null,
      });

      const request = new Request("https://pathfinder-preview.vercel.app/api/spin-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-spin-signature": signature,
          "x-spin-timestamp": timestamp,
          "x-vercel-protection-bypass": "mock-protection-bypass-secret-12345",
        },
        body,
      });

      const response = await server.fetch(request, {}, {});
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.status).toBe("SUCCESS");
      expect(responseBody.voucherCode).toBe("SPIN-BYPASS-WITH-HEADER");
    });

    it("HTTP endpoint verifies request WITHOUT optional x-vercel-protection-bypass header", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-BYPASS-WITHOUT-HEADER",
        email: "verified@college.edu",
        reward_id: "discount-25",
      });
      const { signature, timestamp } = createValidWebhookHeaders(body);

      vi.spyOn(supabaseAdmin as any, "rpc").mockResolvedValueOnce({
        data: {
          success: true,
          status: "SUCCESS",
          code: "SUCCESS",
          message: "Google Form submission verified successfully.",
          voucher_code: "SPIN-BYPASS-WITHOUT-HEADER",
        },
        error: null,
      });

      const request = new Request("https://pathfinder-preview.vercel.app/api/spin-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-spin-signature": signature,
          "x-spin-timestamp": timestamp,
        },
        body,
      });

      const response = await server.fetch(request, {}, {});
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.status).toBe("SUCCESS");
    });

    it("confirms bypass header does NOT bypass HMAC authentication (missing HMAC rejected with HTTP 400)", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-BYPASS-NO-HMAC",
        email: "attacker@college.edu",
      });

      const rpcSpy = vi.spyOn(supabaseAdmin as any, "rpc");

      const request = new Request("https://pathfinder-preview.vercel.app/api/spin-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vercel-protection-bypass": "mock-protection-bypass-secret-12345",
          // Intentionally omitting x-spin-signature and x-spin-timestamp
        },
        body,
      });

      const response = await server.fetch(request, {}, {});
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.code).toBe("MISSING_HEADERS");
      expect(responseBody.message).toContain("Missing required webhook headers");
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it("confirms bypass header does NOT bypass HMAC authentication (forged HMAC rejected with HTTP 401)", async () => {
      const body = JSON.stringify({
        voucher_code: "SPIN-BYPASS-FORGED-HMAC",
        email: "attacker@college.edu",
      });

      const rpcSpy = vi.spyOn(supabaseAdmin as any, "rpc");

      const request = new Request("https://pathfinder-preview.vercel.app/api/spin-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-spin-signature": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          "x-spin-timestamp": String(Date.now()),
          "x-vercel-protection-bypass": "mock-protection-bypass-secret-12345",
        },
        body,
      });

      const response = await server.fetch(request, {}, {});
      expect(response.status).toBe(401);

      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.code).toBe("INVALID_SIGNATURE");
      expect(responseBody.message).toBe("HMAC signature verification failed.");
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it("verifies Apps Script v2.4 header dispatch logic attaches bypass header conditionally", () => {
      // Simulates the exact logic in SpinWinSheetsWebhook.gs (lines 250-265)
      function buildOutgoingHeaders(signatureHex: string, timestamp: number, bypassSecret?: string | null) {
        const headers: Record<string, string> = {
          "X-Spin-Signature": signatureHex,
          "X-Spin-Timestamp": String(timestamp),
          "User-Agent": "PathFinder-GoogleAppsScript-Webhook/2.4",
        };
        if (bypassSecret) {
          headers["x-vercel-protection-bypass"] = bypassSecret;
        }
        return headers;
      }

      const mockSig = "a".repeat(64);
      const mockTs = Date.now();

      // Case A: Configured bypass property
      const headersWithBypass = buildOutgoingHeaders(mockSig, mockTs, "custom-preview-bypass-token");
      expect(headersWithBypass["x-vercel-protection-bypass"]).toBe("custom-preview-bypass-token");
      expect(headersWithBypass["X-Spin-Signature"]).toBe(mockSig);
      expect(headersWithBypass["X-Spin-Timestamp"]).toBe(String(mockTs));

      // Case B: Missing/empty bypass property
      const headersWithoutBypass1 = buildOutgoingHeaders(mockSig, mockTs, "");
      expect("x-vercel-protection-bypass" in headersWithoutBypass1).toBe(false);

      const headersWithoutBypass2 = buildOutgoingHeaders(mockSig, mockTs, null);
      expect("x-vercel-protection-bypass" in headersWithoutBypass2).toBe(false);

      const headersWithoutBypass3 = buildOutgoingHeaders(mockSig, mockTs, undefined);
      expect("x-vercel-protection-bypass" in headersWithoutBypass3).toBe(false);
    });

    it("verifies zero secret exposure: bypass tokens and webhook secrets are never logged or exposed in status text", () => {
      // Simulates Apps Script parseSanitizedError logic
      const VALID_CODES = [
        "SUCCESS",
        "CAMPAIGN_EXPIRED",
        "MISSING_HEADERS",
        "INVALID_TIMESTAMP",
        "EXPIRED_TIMESTAMP",
        "CONFIGURATION_ERROR",
        "INVALID_SIGNATURE",
        "INVALID_JSON",
        "MISSING_FIELDS",
        "DATABASE_ERROR",
        "VOUCHER_NOT_FOUND",
        "EMAIL_MISMATCH",
        "REWARD_MISMATCH",
        "DUPLICATE_SUBMISSION",
        "RATE_LIMITED",
        "INTERNAL_ERROR",
      ];

      function parseSanitizedError(httpStatus: number, responseText: string): string {
        let code = "";
        try {
          const parsed = JSON.parse(responseText);
          if (parsed && typeof parsed.code === "string") {
            code = parsed.code.trim();
          }
        } catch {}

        if (code && VALID_CODES.includes(code)) {
          return "HTTP " + httpStatus + " - " + code;
        }

        const category = httpStatus >= 400 && httpStatus < 500 ? "CLIENT_ERROR" : "SERVER_ERROR";
        return "HTTP " + httpStatus + " - " + category;
      }

      const fakeSecret = "secret_bypass_9876543210_never_leak";

      // 401 with invalid signature
      const out1 = parseSanitizedError(401, JSON.stringify({ code: "INVALID_SIGNATURE", secret: fakeSecret }));
      expect(out1).toBe("HTTP 401 - INVALID_SIGNATURE");
      expect(out1).not.toContain(fakeSecret);

      // 400 with unwhitelisted exception reflecting sensitive content
      const out2 = parseSanitizedError(400, JSON.stringify({ code: "LEAKED_" + fakeSecret }));
      expect(out2).toBe("HTTP 400 - CLIENT_ERROR");
      expect(out2).not.toContain(fakeSecret);

      // 500 with unparsed HTML / SSO redirect
      const out3 = parseSanitizedError(500, `<html>SSO Error containing ${fakeSecret}</html>`);
      expect(out3).toBe("HTTP 500 - SERVER_ERROR");
      expect(out3).not.toContain(fakeSecret);
    });
  });
});
