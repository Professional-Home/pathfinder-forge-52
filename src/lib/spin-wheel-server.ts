import { createServerFn } from "@tanstack/react-start";
import { isValidEmail } from "@/lib/server/otp";
import {
  checkEmailSpunCore,
  sendSpinOtpCore,
  handleVerifySpinOtp as verifySpinOtpCore,
  executeSpinRollCore,
  claimSpinRewardCore,
  rejectSpinRewardCore,
  acceptSpinRewardCore,
  redeemSpinRewardAdminCore,
  verifyFormManualAdminCore,
  processSpinWebhookCore,
  fetchAdminSpinEntriesCore,
} from "@/lib/server/spin-wheel-security";

// ─── 1. Check If Email Has Already Spun (Safe, PII-Free) ───────────────────────

export const checkEmailSpun = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => {
    if (!input.email || !isValidEmail(input.email)) {
      throw new Error("Valid email is required");
    }
    return input;
  })
  .handler(async ({ data }) => checkEmailSpunCore(data));

// ─── 2. Send Spin OTP to Email ──────────────────────────────────────────────────

export const sendSpinOtp = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string }) => {
    if (!input.email || !isValidEmail(input.email)) {
      throw new Error("Valid email is required");
    }
    return input;
  })
  .handler(async ({ data }) => sendSpinOtpCore(data));

// ─── 3. Verify Spin OTP ─────────────────────────────────────────────────────────

export const verifySpinOtp = createServerFn({ method: "POST" })
  .validator((input: { email: string; otp: string }) => {
    if (!input.email || !input.otp) {
      throw new Error("Email and OTP are required");
    }
    return input;
  })
  .handler(async ({ data }) => verifySpinOtpCore(data));

// ─── 4. Server-Authoritative Spin Roll & Record (Strict Zero-Trust Identity) ───

export const executeSpinRoll = createServerFn({ method: "POST" })
  .validator((input: { authToken?: string; name?: string; email?: string }) => {
    return input || {};
  })
  .handler(async ({ data }) => executeSpinRollCore(data));

// ─── 5. Claim Won Reward Form Submission ────────────────────────────────────────

export const claimSpinReward = createServerFn({ method: "POST" })
  .validator((input: {
    authToken?: string;
    email?: string;
    phone: string;
    college?: string;
    claimNotes?: string;
    entryId?: string;
  }) => {
    if (!input.phone) {
      throw new Error("Phone number is required");
    }
    return input;
  })
  .handler(async ({ data }) => claimSpinRewardCore(data));

// ─── 6. Reject / Dismiss Reward ───────────────────────────────────────────────

export const rejectSpinReward = createServerFn({ method: "POST" })
  .validator((input: { authToken?: string; email?: string; entryId?: string }) => {
    return input || {};
  })
  .handler(async ({ data }) => rejectSpinRewardCore(data));

// ─── 7. Accept Won Reward & Open Prefilled Google Form ───────────────────────

export const acceptSpinReward = createServerFn({ method: "POST" })
  .validator((input: { authToken?: string; entryId?: string }) => input || {})
  .handler(async ({ data }) => acceptSpinRewardCore(data));

// ─── 8. Admin Redeem Reward ────────────────────────────────────────────────────

export const redeemSpinRewardAdmin = createServerFn({ method: "POST" })
  .validator((input: { authToken?: string; entryId: string; notes?: string }) => {
    if (!input.entryId) throw new Error("entryId is required");
    return input;
  })
  .handler(async ({ data }) => redeemSpinRewardAdminCore(data));

// ─── 9. Admin Manual Form Verification ─────────────────────────────────────────

export const verifyFormManualAdmin = createServerFn({ method: "POST" })
  .validator((input: { authToken?: string; entryId: string; notes?: string }) => {
    if (!input.entryId) throw new Error("entryId is required");
    return input;
  })
  .handler(async ({ data }) => verifyFormManualAdminCore(data));

// ─── 10. Process Google Apps Script Submission Webhook ─────────────────────────

export const processSpinWebhook = createServerFn({ method: "POST" })
  .validator((input: { rawBody: string; signature?: string | null; timestamp?: string | null }) => {
    if (!input.rawBody) throw new Error("rawBody is required");
    return input;
  })
  .handler(async ({ data }) => processSpinWebhookCore(data));

// ─── 11. Admin Fetch All Entries (Authenticated & PII-Masked) ───────────────────

export const fetchAdminSpinEntries = createServerFn({ method: "POST" })
  .validator((input?: { authToken?: string; unmask?: boolean }) => {
    return input || {};
  })
  .handler(async ({ data }) => fetchAdminSpinEntriesCore(data));
