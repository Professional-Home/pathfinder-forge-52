import { randomInt, createHmac, timingSafeEqual, createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import {
  verifyAdminSession,
  requireAdminSession,
  type AdminAuthResult,
} from "@/lib/server/admin-guard";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
  normalizeEmail,
  isValidEmail,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_EXPIRY_MINUTES,
} from "@/lib/server/otp";
import {
  SPIN_REWARDS,
  selectRewardByProbability,
  generateVoucherCode,
  isSpinOfferExpired,
  SPIN_EXPIRY_LABEL,
} from "../spin-wheel/config";
import type { SpinWheelEntry, RewardStatus, FormStatus } from "../spin-wheel/types";
import {
  buildPrefilledGoogleFormUrl,
  getSpinWebhookSecret,
  normalizeRewardId,
} from "./google-forms-config";

export { verifyAdminSession, requireAdminSession };
export type { AdminAuthResult };

// ─── PII Masking Utilities ─────────────────────────────────────────────────────

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "***@***.com";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  const maskedCount = Math.min(local.length - 2, 4);
  const maskedMiddle = "*".repeat(maskedCount);
  return `${first}${maskedMiddle}${last}@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "****";
  const visibleLast = cleaned.slice(-4);
  return "*".repeat(Math.max(0, cleaned.length - 4)) + visibleLast;
}

// ─── Participant Verification Guard (Supabase Auth Only) ──────────────────────

export async function verifyParticipantSession(authToken?: string): Promise<{
  isValid: boolean;
  email?: string;
  userId?: string;
  error?: string;
}> {
  if (!authToken || typeof authToken !== "string" || !authToken.trim()) {
    return {
      isValid: false,
      error: "A verified email session is required to spin the wheel. Please complete verification.",
    };
  }

  const token = authToken.trim();

  // Reject legacy client tokens
  if (token.startsWith("session_")) {
    return {
      isValid: false,
      error: "Invalid session token format. Please verify your email again.",
    };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return {
        isValid: false,
        error: "Invalid or expired session token. Please verify your email again.",
      };
    }

    const user = data.user;
    const rawUserEmail = user.email;
    if (!rawUserEmail) {
      return {
        isValid: false,
        error: "No email associated with this session.",
      };
    }

    const isConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
    if (!isConfirmed) {
      return {
        isValid: false,
        error: "Email address is not yet confirmed. Please verify your email.",
      };
    }

    return {
      isValid: true,
      email: normalizeEmail(rawUserEmail),
      userId: user.id,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: "Failed to verify participant session.",
    };
  }
}

// ─── In-Memory Fallback Store (If database table is not migrated yet) ─────────
const memorySpinEntries = new Map<string, SpinWheelEntry>();
const memorySpinOtps = new Map<
  string,
  { hash: string; expiresAt: string; attempts: number; createdAt: number }
>();

function spinTable(): any {
  return (supabaseAdmin as any).from("spin_wheel_entries");
}

function otpsTable(): any {
  return (supabaseAdmin as any).from("auth_otps");
}

function adminLogsTable(): any {
  return (supabaseAdmin as any).from("spin_admin_audit_logs");
}

function webhookLogsTable(): any {
  return (supabaseAdmin as any).from("spin_webhook_logs");
}

// ─── 1. Check If Email Has Already Spun (Safe, PII-Free) ───────────────────────

export async function checkEmailSpunCore(data: { email: string }): Promise<{
  alreadySpun: boolean;
  rewardTitle?: string;
}> {
  const email = normalizeEmail(data.email);

  try {
    const { data: dbEntry, error } = await (spinTable().select("reward_title") as any)
      .eq("email", email)
      .maybeSingle();

    if (!error && dbEntry) {
      return {
        alreadySpun: true,
        rewardTitle: dbEntry.reward_title,
      };
    }
  } catch {
    // Fallback to memory
  }

  const memEntry = memorySpinEntries.get(email);
  if (memEntry) {
    return {
      alreadySpun: true,
      rewardTitle: memEntry.rewardTitle,
    };
  }

  return { alreadySpun: false };
}

// ─── 2. Send Spin OTP to Email ──────────────────────────────────────────────────

export async function sendSpinOtpCore(data: { name: string; email: string }): Promise<{
  success: boolean;
  code?: string;
  message: string;
}> {
  // 0. Expiry Check (20 November 2026 cutoff)
  if (isSpinOfferExpired()) {
    return {
      success: false,
      code: "OFFER_EXPIRED",
      message: `This promotional offer expired on ${SPIN_EXPIRY_LABEL}.`,
    };
  }

  const { name, email: rawEmail } = data;
  const email = normalizeEmail(rawEmail);

  // 1. First check if this email already spun!
  try {
    const { data: existing } = await (spinTable().select("reward_title") as any)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        code: "ALREADY_SPUN",
        message: `This email has already participated! Your prize was: ${existing.reward_title}.`,
      };
    }
  } catch {
    if (memorySpinEntries.has(email)) {
      const prev = memorySpinEntries.get(email)!;
      return {
        success: false,
        code: "ALREADY_SPUN",
        message: `This email has already participated! Your prize was: ${prev.rewardTitle}.`,
      };
    }
  }

  // 2. Rate limiting check
  const memOtp = memorySpinOtps.get(email);
  if (memOtp) {
    const elapsed = (Date.now() - memOtp.createdAt) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed);
      return {
        success: false,
        code: "RATE_LIMITED",
        message: `Please wait ${remaining}s before requesting a new code.`,
      };
    }
  }

  // 3. Generate 6-digit OTP
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = getOtpExpiry();

  // Store in Supabase auth_otps or fallback memory
  let stored = false;
  try {
    await otpsTable().delete().eq("email", email).eq("purpose", "spin_wheel");
    const { error } = await otpsTable().insert({
      email,
      otp_hash: otpHash,
      purpose: "spin_wheel",
      expires_at: expiresAt,
      attempts: 0,
    });
    if (!error) stored = true;
  } catch {}

  if (!stored) {
    memorySpinOtps.set(email, {
      hash: otpHash,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });
  }

  // 4. Send email via Nodemailer
  try {
    const { transporter, ensureMailReady, getSenderAddress } = await import("@/lib/server/mail");
    await ensureMailReady();
    const recipient = name ? name.trim() : email.split("@")[0];

    await transporter.sendMail({
      from: getSenderAddress(),
      to: email,
      subject: `Your Micrylis Spin & Win Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #1f293d;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #06b6d4, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">MICRYLIS</span>
            <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Spin & Win Reward Verification</p>
            <p style="margin: 6px 0 0; font-size: 11px; color: #f59e0b; font-weight: 600;">⚡ Limited Offer Valid Until ${SPIN_EXPIRY_LABEL}</p>
          </div>

          <div style="background-color: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 24px; text-align: center;">
            <h2 style="font-size: 18px; margin-top: 0; color: #ffffff;">Hello ${recipient}!</h2>
            <p style="font-size: 14px; color: #9ca3af; line-height: 1.5; margin-bottom: 24px;">
              Enter the 6-digit verification code below to unlock your chance to spin the reward wheel.
            </p>

            <div style="display: inline-block; padding: 14px 32px; background: #1e293b; border: 2px dashed #06b6d4; border-radius: 8px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; font-family: monospace;">
              ${otp}
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              This code is valid for ${OTP_EXPIRY_MINUTES} minutes. Each verified participant is limited to exactly one spin before ${SPIN_EXPIRY_LABEL}.
            </p>
          </div>

          <p style="font-size: 11px; color: #475569; text-align: center; margin-top: 24px;">
            © ${new Date().getFullYear()} Micrylis Biotech. All rights reserved.
          </p>
        </div>
      `,
      text: `Your Micrylis Spin & Win Code is: ${otp}. Valid for 10 minutes. Offer ends ${SPIN_EXPIRY_LABEL}.`,
    });

    return {
      success: true,
      message: `Verification code sent to ${email}! Please check your inbox.`,
    };
  } catch (err: any) {
    console.error("[SPIN] Mail send error:", err);
    return {
      success: false,
      code: "MAIL_FAILED",
      message: `Unable to send email: ${err.message}. Please verify your Gmail App Password in .env.`,
    };
  }
}

// ─── 3. Verify Spin OTP ─────────────────────────────────────────────────────────

export async function handleVerifySpinOtp(data: { email: string; otp: string }): Promise<{
  success: boolean;
  verified?: boolean;
  token?: string;
  message?: string;
}> {
  if (isSpinOfferExpired()) {
    return {
      success: false,
      message: `This promotional offer expired on ${SPIN_EXPIRY_LABEL}.`,
    };
  }

  const { email: rawEmail, otp } = data;
  const email = normalizeEmail(rawEmail);
  const trimmedOtp = otp.trim();

  if (trimmedOtp.length !== 6) {
    return { success: false, message: "Please enter a valid 6-digit code." };
  }

  // Try Supabase first
  try {
    const { data: record, error } = await (otpsTable().select("*") as any)
      .eq("email", email)
      .eq("purpose", "spin_wheel")
      .maybeSingle();

    if (!error && record) {
      if (new Date(record.expires_at).getTime() < Date.now()) {
        return { success: false, message: "Verification code has expired. Please request a new one." };
      }
      if (record.attempts >= OTP_MAX_ATTEMPTS) {
        return { success: false, message: "Too many failed attempts. Please request a new code." };
      }

      const valid = verifyOtpHash(trimmedOtp, record.otp_hash);
      if (!valid) {
        await otpsTable().update({ attempts: record.attempts + 1 }).eq("id", record.id);
        return { success: false, message: "Incorrect verification code. Please try again." };
      }

      // Clean up OTP on success
      await otpsTable().delete().eq("id", record.id);
      return { success: true, verified: true };
    }
  } catch {}

  // Check memory fallback
  const mem = memorySpinOtps.get(email);
  if (!mem) {
    return { success: false, message: "No verification code found. Please request a new code." };
  }
  if (new Date(mem.expiresAt).getTime() < Date.now()) {
    return { success: false, message: "Code has expired. Please request a new one." };
  }

  const valid = verifyOtpHash(trimmedOtp, mem.hash);
  if (!valid) {
    mem.attempts += 1;
    return { success: false, message: "Incorrect verification code. Please try again." };
  }

  memorySpinOtps.delete(email);
  return { success: true, verified: true };
}

// ─── 4. Server-Authoritative Spin Roll & Record (Strict Zero-Trust Identity) ───

export async function executeSpinRollCore(data?: {
  authToken?: string;
  name?: string;
  email?: string;
}): Promise<{
  success: boolean;
  code?: string;
  message?: string;
  winningIndex?: number;
  reward?: any;
  voucherCode?: string;
  entry?: any;
}> {
  // 0. Expiry Check
  if (isSpinOfferExpired()) {
    return {
      success: false,
      code: "OFFER_EXPIRED",
      message: `This promotional event concluded on ${SPIN_EXPIRY_LABEL}.`,
    };
  }

  // 1. Strict zero-trust session authentication
  const authCheck = await verifyParticipantSession(data?.authToken);
  if (!authCheck.isValid || !authCheck.email) {
    return {
      success: false,
      code: "AUTH_REQUIRED",
      message:
        authCheck.error ||
        "A verified email session is required to spin the wheel. Please complete verification.",
    };
  }

  // Identity is derived strictly from verified session — NEVER trusted from client input!
  const email = authCheck.email;
  const name = (data?.name || email.split("@")[0]).trim();

  // 2. Guard against duplicate spin
  try {
    const { data: existing } = await (spinTable().select("*") as any)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        code: "ALREADY_SPUN",
        message: "You have already spun the wheel with this email address.",
        entry: {
          id: existing.id,
          name: existing.name,
          email: maskEmail(existing.email),
          rewardId: existing.reward_id,
          rewardTitle: existing.reward_title,
          voucherCode: existing.voucher_code,
          probabilityPct: Number(existing.probability_pct),
          status: existing.status,
          isClaimed: Boolean(existing.is_claimed),
          createdAt: existing.created_at,
        },
      };
    }
  } catch {}

  if (memorySpinEntries.has(email)) {
    const existing = memorySpinEntries.get(email)!;
    return {
      success: false,
      code: "ALREADY_SPUN",
      message: "You have already spun the wheel with this email address.",
      entry: {
        ...existing,
        email: maskEmail(existing.email),
      },
    };
  }

  // 3. Cryptographically secure weighted random roll (1 to 100)
  const rollOutOf100 = randomInt(1, 101);
  const { reward, index: winningIndex } = selectRewardByProbability(rollOutOf100);
  const voucherCode = generateVoucherCode(reward.id);

  const newEntry: SpinWheelEntry = {
    id: "spin-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    name,
    email,
    rewardId: reward.id,
    rewardTitle: reward.title,
    voucherCode,
    probabilityPct: reward.probability,
    status: "won",
    rewardStatus: "PENDING",
    formStatus: "NOT_APPLICABLE",
    isClaimed: false,
    createdAt: new Date().toISOString(),
  };

  // 4. Persist to Supabase
  let insertError: any = null;
  try {
    const { data: inserted, error } = await (spinTable().insert({
      name: newEntry.name,
      email: newEntry.email,
      reward_id: newEntry.rewardId,
      reward_title: newEntry.rewardTitle,
      voucher_code: newEntry.voucherCode,
      probability_pct: newEntry.probabilityPct,
      status: "won",
      reward_status: "PENDING",
      form_status: "NOT_APPLICABLE",
      is_claimed: false,
    }).select() as any).single();

    if (error) {
      insertError = error;
    } else if (inserted) {
      newEntry.id = inserted.id;
    }
  } catch (e: any) {
    insertError = e;
  }

  if (insertError) {
    // Check if this was a duplicate key race condition (unique constraint on email)
    const isDuplicate =
      insertError.code === "23505" ||
      String(insertError.message || "").toLowerCase().includes("duplicate key") ||
      String(insertError.message || "").toLowerCase().includes("unique constraint");

    if (isDuplicate) {
      try {
        const { data: existing } = await (spinTable().select("*") as any)
          .eq("email", email)
          .maybeSingle();

        if (existing) {
          return {
            success: false,
            code: "ALREADY_SPUN",
            message: "You have already spun the wheel with this email address.",
            entry: {
              id: existing.id,
              name: existing.name,
              email: maskEmail(existing.email),
              rewardId: existing.reward_id,
              rewardTitle: existing.reward_title,
              voucherCode: existing.voucher_code,
              probabilityPct: Number(existing.probability_pct),
              status: existing.status,
              isClaimed: Boolean(existing.is_claimed),
              createdAt: existing.created_at,
            },
          };
        }
      } catch {}

      if (memorySpinEntries.has(email)) {
        const existing = memorySpinEntries.get(email)!;
        return {
          success: false,
          code: "ALREADY_SPUN",
          message: "You have already spun the wheel with this email address.",
          entry: {
            ...existing,
            email: maskEmail(existing.email),
          },
        };
      }
    }

    // For any unresolvable insert error, abort safely — NEVER issue a phantom voucher!
    console.error("[SPIN] Database insertion failed:", insertError);
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Failed to record your spin. Please try again.",
    };
  }

  // Store in memory cache only upon successful persistence
  memorySpinEntries.set(email, newEntry);

  return {
    success: true,
    winningIndex,
    reward,
    voucherCode,
    entry: newEntry,
  };
}

// ─── 5. Claim Won Reward Form Submission ────────────────────────────────────────

export async function claimSpinRewardCore(data: {
  authToken?: string;
  phone: string;
  college?: string;
  claimNotes?: string;
  entryId?: string;
}): Promise<{ success: boolean; message: string; code?: string }> {
  if (!data?.authToken) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "A verified email session is required to claim a reward.",
    };
  }

  const auth = await verifyParticipantSession(data.authToken);
  if (!auth.isValid || !auth.email) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: auth.error || "A valid verified email session is required to claim a reward.",
    };
  }

  const verifiedEmail = auth.email;
  const { phone, college = "", claimNotes = "", entryId } = data;

  if (!phone || typeof phone !== "string" || phone.trim().length < 10) {
    return {
      success: false,
      code: "INVALID_PHONE",
      message: "A valid contact number is required to claim your reward.",
    };
  }

  // Confirm ownership of the spin reward entry
  let existingRecord: any = null;
  try {
    let query = (spinTable().select("id, email, is_claimed, status") as any).eq("email", verifiedEmail);
    if (entryId) {
      query = query.eq("id", entryId);
    }
    const { data: records, error: fetchErr } = await query;
    if (!fetchErr && records && records.length > 0) {
      existingRecord = records[0];
    }
  } catch {}

  if (!existingRecord && memorySpinEntries.has(verifiedEmail)) {
    const memEntry = memorySpinEntries.get(verifiedEmail);
    if (!entryId || memEntry?.id === entryId) {
      existingRecord = memEntry;
    }
  }

  if (!existingRecord) {
    return {
      success: false,
      code: "ENTRY_NOT_FOUND",
      message: "No spin reward record found for your verified account.",
    };
  }

  // Strict reward lifecycle: once rejected, a reward cannot be claimed!
  if (existingRecord.status === "rejected") {
    return {
      success: false,
      code: "REWARD_ALREADY_REJECTED",
      message: "This reward has already been rejected and cannot be claimed.",
    };
  }

  // Update persisted record
  try {
    let updateQuery = (spinTable().update({
      phone: phone.trim(),
      college: college.trim(),
      claim_notes: claimNotes.trim(),
      is_claimed: true,
      status: "claimed",
      claimed_at: new Date().toISOString(),
    }) as any).eq("email", verifiedEmail).in("status", ["won", "claimed"]);

    if (entryId) {
      updateQuery = updateQuery.eq("id", entryId);
    }
    await updateQuery;
  } catch (err: any) {
    console.warn("[SPIN] Supabase claim update note:", err.message);
  }

  const mem = memorySpinEntries.get(verifiedEmail);
  if (mem && (!entryId || mem.id === entryId)) {
    mem.phone = phone.trim();
    mem.college = college.trim();
    mem.claimNotes = claimNotes.trim();
    mem.isClaimed = true;
    mem.status = "claimed";
    mem.claimedAt = new Date().toISOString();
  }

  return { success: true, message: "Reward claim submitted successfully!" };
}

// ─── 6. Reject / Dismiss Reward ───────────────────────────────────────────────

export async function rejectSpinRewardCore(data?: {
  authToken?: string;
  entryId?: string;
}): Promise<{ success: boolean; message?: string; code?: string }> {
  if (!data?.authToken) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "A verified email session is required to dismiss or reject a reward.",
    };
  }

  const auth = await verifyParticipantSession(data.authToken);
  if (!auth.isValid || !auth.email) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: auth.error || "Invalid or expired session token.",
    };
  }

  const verifiedEmail = auth.email;
  const entryId = data.entryId;

  // Confirm ownership of the spin reward entry
  let existingRecord: any = null;
  try {
    let query = (spinTable().select("id, email, status") as any).eq("email", verifiedEmail);
    if (entryId) {
      query = query.eq("id", entryId);
    }
    const { data: records, error: fetchErr } = await query;
    if (!fetchErr && records && records.length > 0) {
      existingRecord = records[0];
    }
  } catch {}

  if (!existingRecord && memorySpinEntries.has(verifiedEmail)) {
    const memEntry = memorySpinEntries.get(verifiedEmail);
    if (!entryId || memEntry?.id === entryId) {
      existingRecord = memEntry;
    }
  }

  if (!existingRecord) {
    return {
      success: false,
      code: "ENTRY_NOT_FOUND",
      message: "No spin reward record found for your verified account.",
    };
  }

  // Strict reward lifecycle: once claimed or redeemed, a reward cannot be rejected!
  const currentRewardStatus = existingRecord.reward_status || existingRecord.rewardStatus;
  if (existingRecord.status === "claimed" || currentRewardStatus === "REDEEMED") {
    return {
      success: false,
      code: "REWARD_ALREADY_CLAIMED",
      message: "This reward has already been claimed and cannot be rejected.",
    };
  }

  // Idempotency: if already rejected, return success
  if (existingRecord.status === "rejected" || currentRewardStatus === "REJECTED") {
    return { success: true, message: "Reward offer dismissed." };
  }

  try {
    let updateQuery = (spinTable().update({
      status: "rejected",
      reward_status: "REJECTED",
      form_status: "NOT_APPLICABLE",
    }) as any).eq("email", verifiedEmail).eq("status", "won");

    if (entryId) {
      updateQuery = updateQuery.eq("id", entryId);
    }
    await updateQuery;
  } catch {}

  const mem = memorySpinEntries.get(verifiedEmail);
  if (mem && (!entryId || mem.id === entryId)) {
    mem.status = "rejected";
    mem.rewardStatus = "REJECTED";
    mem.formStatus = "NOT_APPLICABLE";
  }

  return { success: true, message: "Reward offer dismissed." };
}

// ─── 7. Accept Won Reward & Generate Google Form URL ──────────────────────────

export async function acceptSpinRewardCore(data: {
  authToken?: string;
  entryId?: string;
}): Promise<{
  success: boolean;
  code?: string;
  message: string;
  formUrl?: string;
  rewardStatus?: RewardStatus;
  formStatus?: FormStatus;
  voucherCode?: string;
}> {
  if (!data?.authToken) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: "A verified email session is required to accept a reward.",
    };
  }

  const auth = await verifyParticipantSession(data.authToken);
  if (!auth.isValid || !auth.email) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: auth.error || "A valid verified email session is required to accept a reward.",
    };
  }

  const verifiedEmail = auth.email;
  const entryId = data.entryId;

  // Deadline check
  if (isSpinOfferExpired()) {
    return {
      success: false,
      code: "CAMPAIGN_EXPIRED",
      message: `The campaign expired on ${SPIN_EXPIRY_LABEL}. Rewards can no longer be accepted.`,
    };
  }

  // Fetch record
  let entry: any = null;
  try {
    let query = (spinTable().select("*") as any).eq("email", verifiedEmail);
    if (entryId) {
      query = query.eq("id", entryId);
    }
    const { data: records } = await query;
    if (records && records.length > 0) {
      entry = records[0];
    }
  } catch {}

  if (!entry && memorySpinEntries.has(verifiedEmail)) {
    const mem = memorySpinEntries.get(verifiedEmail);
    if (!entryId || mem?.id === entryId) {
      entry = mem;
    }
  }

  if (!entry) {
    return {
      success: false,
      code: "ENTRY_NOT_FOUND",
      message: "No spin reward record found for your verified account.",
    };
  }

  const currentRewardStatus = entry.reward_status || entry.rewardStatus;
  if (currentRewardStatus === "REJECTED" || entry.status === "rejected") {
    return {
      success: false,
      code: "REWARD_ALREADY_REJECTED",
      message: "This reward has already been rejected and cannot be accepted.",
    };
  }

  if (currentRewardStatus === "REDEEMED") {
    return {
      success: false,
      code: "ALREADY_REDEEMED",
      message: "This reward has already been redeemed.",
    };
  }

  const rewardId = entry.reward_id || entry.rewardId;
  const voucherCode = entry.voucher_code || entry.voucherCode;
  const participantName = entry.name || "";

  // Build prefilled Google Form URL
  const { url: formUrl } = buildPrefilledGoogleFormUrl(rewardId, {
    voucherCode,
    email: verifiedEmail,
    name: participantName,
  });

  const nowIso = new Date().toISOString();

  // Persist update
  try {
    let updateQuery = (spinTable().update({
      reward_status: "ACCEPTED",
      form_status: "FORM_PENDING",
      form_url: formUrl,
      form_opened_at: nowIso,
    }) as any).eq("email", verifiedEmail);

    if (entryId) {
      updateQuery = updateQuery.eq("id", entryId);
    }
    await updateQuery;
  } catch (err: any) {
    console.warn("[SPIN] accept update note:", err.message);
  }

  // Update memory
  const mem = memorySpinEntries.get(verifiedEmail);
  if (mem && (!entryId || mem.id === entryId)) {
    mem.rewardStatus = "ACCEPTED";
    mem.formStatus = "FORM_PENDING";
    mem.formUrl = formUrl;
    mem.formOpenedAt = nowIso;
  }

  return {
    success: true,
    message: "Reward accepted! Please complete the form to verify your claim.",
    formUrl,
    rewardStatus: "ACCEPTED",
    formStatus: "FORM_PENDING",
    voucherCode,
  };
}

// ─── 8. Admin Redeem Reward ────────────────────────────────────────────────────

export async function redeemSpinRewardAdminCore(data: {
  authToken?: string;
  entryId: string;
  notes?: string;
}): Promise<{
  success: boolean;
  code?: string;
  message: string;
}> {
  const adminCheck = await verifyAdminSession(data?.authToken);
  if (!adminCheck.isValid || !adminCheck.email) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: adminCheck.error || "Admin authentication required.",
    };
  }

  if (isSpinOfferExpired()) {
    return {
      success: false,
      code: "CAMPAIGN_EXPIRED",
      message: `The campaign expired on ${SPIN_EXPIRY_LABEL}. Rewards can no longer be redeemed.`,
    };
  }

  if (!data?.entryId) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "entryId is required.",
    };
  }

  const adminEmail = adminCheck.email;

  // Execute atomic redemption via service_role RPC (Single PostgreSQL Transaction)
  // Acquires row lock (FOR UPDATE), validates status & form verification,
  // updates lifecycle & legacy columns, and records audit log atomically.
  try {
    const { data: rpcRes, error: rpcErr } = await (supabaseAdmin as any).rpc(
      "redeem_spin_reward_atomic",
      {
        p_entry_id: data.entryId,
        p_admin_email: adminEmail,
        p_notes: data.notes?.trim() || null,
      }
    );

    if (rpcErr) {
      console.warn("[SPIN REDEEM] Atomic RPC error:", rpcErr.message);
      return {
        success: false,
        code: "DATABASE_ERROR",
        message: "Failed to atomically redeem reward: " + rpcErr.message,
      };
    }

    if (rpcRes && typeof rpcRes === "object") {
      if (!rpcRes.success) {
        return {
          success: false,
          code: rpcRes.code || "REDEMPTION_FAILED",
          message: rpcRes.message || "Failed to redeem reward.",
        };
      }

      // Sync memory cache if present
      for (const mem of memorySpinEntries.values()) {
        if (mem.id === data.entryId) {
          mem.rewardStatus = "REDEEMED";
          mem.status = "claimed";
          mem.isClaimed = true;
          mem.redeemedAt = new Date().toISOString();
          mem.redeemedByAdmin = adminEmail;
          mem.redemptionNotes = data.notes?.trim() || undefined;
          break;
        }
      }

      return {
        success: true,
        message: rpcRes.message || "Reward marked as redeemed successfully.",
      };
    }

    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Unexpected response from atomic redemption RPC.",
    };
  } catch (err: any) {
    console.error("[SPIN REDEEM] Error executing atomic RPC:", err);
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Unexpected error during atomic redemption: " + err.message,
    };
  }
}

// ─── 9. Admin Manual Form Verification ─────────────────────────────────────────

export async function verifyFormManualAdminCore(data: {
  authToken?: string;
  entryId: string;
  notes?: string;
}): Promise<{
  success: boolean;
  code?: string;
  message: string;
}> {
  const adminCheck = await verifyAdminSession(data?.authToken);
  if (!adminCheck.isValid || !adminCheck.email) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      message: adminCheck.error || "Admin authentication required.",
    };
  }

  if (isSpinOfferExpired()) {
    return {
      success: false,
      code: "CAMPAIGN_EXPIRED",
      message: `The campaign expired on ${SPIN_EXPIRY_LABEL}.`,
    };
  }

  if (!data?.entryId) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "entryId is required.",
    };
  }

  // Fetch record
  let entry: any = null;
  try {
    const { data: record } = await (spinTable().select("*") as any)
      .eq("id", data.entryId)
      .maybeSingle();
    entry = record;
  } catch {}

  if (!entry) {
    for (const mem of memorySpinEntries.values()) {
      if (mem.id === data.entryId) {
        entry = mem;
        break;
      }
    }
  }

  if (!entry) {
    return {
      success: false,
      code: "ENTRY_NOT_FOUND",
      message: "Spin reward record not found.",
    };
  }

  const verifiedAt = new Date().toISOString();
  const adminEmail = adminCheck.email;

  try {
    await (spinTable().update({
      form_status: "FORM_VERIFIED",
      form_verified_at: verifiedAt,
    }) as any).eq("id", data.entryId);

    await adminLogsTable().insert({
      spin_entry_id: entry.id,
      admin_email: adminEmail,
      action: "MANUAL_VERIFY_FORM",
      previous_state: {
        form_status: entry.form_status || entry.formStatus,
      },
      new_state: {
        form_status: "FORM_VERIFIED",
        form_verified_at: verifiedAt,
      },
      notes: data.notes || "Manually verified by admin",
    });
  } catch (err: any) {
    console.warn("[SPIN MANUAL VERIFY] DB note:", err.message);
  }

  const entryEmail = normalizeEmail(entry.email);
  const mem = memorySpinEntries.get(entryEmail);
  if (mem && mem.id === data.entryId) {
    mem.formStatus = "FORM_VERIFIED";
    mem.formVerifiedAt = verifiedAt;
  }

  return {
    success: true,
    message: "Google Form submission verified manually by admin.",
  };
}

// ─── 10. Process Google Apps Script Submission Webhook ─────────────────────────

export async function processSpinWebhookCore(data: {
  rawBody: string;
  signature?: string | null;
  timestamp?: string | null;
}): Promise<{
  success: boolean;
  code?: string;
  message: string;
  voucherCode?: string;
  status?: "SUCCESS" | "DUPLICATE" | "REJECTED";
}> {
  const { rawBody, signature, timestamp } = data;

  // 1. Check campaign deadline
  if (isSpinOfferExpired()) {
    return {
      success: false,
      code: "CAMPAIGN_EXPIRED",
      message: `The campaign expired on ${SPIN_EXPIRY_LABEL}. Webhook submissions are closed.`,
    };
  }

  // 2. Validate presence of signature & timestamp headers
  if (!signature || !timestamp) {
    return {
      success: false,
      code: "MISSING_HEADERS",
      message: "Missing required webhook headers: X-Spin-Signature or X-Spin-Timestamp.",
    };
  }

  // 3. Timestamp Freshness & Replay Attack Protection (5-minute tolerance)
  const reqTime = parseInt(timestamp, 10);
  if (isNaN(reqTime)) {
    return {
      success: false,
      code: "INVALID_TIMESTAMP",
      message: "X-Spin-Timestamp header must be a valid epoch millisecond integer.",
    };
  }

  const now = Date.now();
  const timeDifference = Math.abs(now - reqTime);
  const MAX_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

  if (timeDifference > MAX_TOLERANCE_MS) {
    return {
      success: false,
      code: "EXPIRED_TIMESTAMP",
      message: `Webhook timestamp expired or out of bounds (difference: ${timeDifference}ms). Max allowed is ${MAX_TOLERANCE_MS}ms.`,
    };
  }

  // 4. HMAC-SHA256 Signature Verification (Constant-Time)
  let secret: string;
  try {
    secret = getSpinWebhookSecret();
  } catch (err: any) {
    console.error("[SPIN WEBHOOK] Secret configuration failure:", err.message);
    return {
      success: false,
      code: "CONFIGURATION_ERROR",
      message: "Server webhook configuration error: " + (err.message || "Invalid or missing secret."),
    };
  }

  const computedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");

  let signaturesMatch = false;
  try {
    const sigBuffer = Buffer.from(signature.toLowerCase(), "hex");
    const compBuffer = Buffer.from(computedSignature.toLowerCase(), "hex");

    if (sigBuffer.length === compBuffer.length && timingSafeEqual(sigBuffer, compBuffer)) {
      signaturesMatch = true;
    }
  } catch {
    signaturesMatch = false;
  }

  if (!signaturesMatch) {
    return {
      success: false,
      code: "INVALID_SIGNATURE",
      message: "HMAC signature verification failed.",
    };
  }

  // 5. Parse and Validate Payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return {
      success: false,
      code: "INVALID_JSON",
      message: "Malformed JSON payload.",
    };
  }

  const voucherCode = (payload?.voucher_code || "").trim();
  const email = normalizeEmail(payload?.email || "");
  const rewardId = (payload?.reward_id || "").trim();
  const formResponseId = (payload?.form_response_id || "").trim();

  if (!voucherCode || !email) {
    return {
      success: false,
      code: "MISSING_FIELDS",
      message: "voucher_code and email are required in the webhook payload.",
    };
  }

  // Compute payload hash for audit logging
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  // 6. Execute Atomic Webhook Verification via service_role RPC (Single PostgreSQL Transaction)
  // Acquires row lock (FOR UPDATE), checks ownership & duplicate state,
  // updates form_status to FORM_VERIFIED, and inserts SUCCESS log.
  // Partial unique index idx_spin_webhook_logs_unique_success prevents duplicate successes under concurrency.
  try {
    const { data: rpcRes, error: rpcErr } = await (supabaseAdmin as any).rpc(
      "verify_spin_webhook_atomic",
      {
        p_voucher_code: voucherCode,
        p_email: email,
        p_reward_id: rewardId || null,
        p_form_response_id: formResponseId || null,
        p_request_signature: signature,
        p_request_timestamp: reqTime,
        p_payload_hash: payloadHash,
      }
    );

    if (rpcErr) {
      // Gracefully handle unique index conflict (23505) under concurrent submission
      if (
        rpcErr.code === "23505" ||
        rpcErr.message?.includes("idx_spin_webhook_logs_unique_success") ||
        rpcErr.message?.includes("duplicate key")
      ) {
        return {
          success: true,
          status: "DUPLICATE",
          message: "Form submission already verified previously (concurrent idempotent replay).",
          voucherCode,
        };
      }

      console.warn("[SPIN WEBHOOK] Atomic RPC error:", rpcErr.message);
      return {
        success: false,
        code: "DATABASE_ERROR",
        message: "Webhook verification failed: " + rpcErr.message,
      };
    }

    if (rpcRes && typeof rpcRes === "object") {
      if (rpcRes.success) {
        // Sync in-memory cache
        const mem = memorySpinEntries.get(email);
        if (mem && mem.voucherCode === voucherCode) {
          mem.formStatus = "FORM_VERIFIED";
          mem.formVerifiedAt = new Date().toISOString();
          if (formResponseId) mem.formResponseId = formResponseId;
        }
      }

      return {
        success: Boolean(rpcRes.success),
        code: rpcRes.code,
        status: rpcRes.status || (rpcRes.success ? "SUCCESS" : "REJECTED"),
        message:
          rpcRes.message ||
          (rpcRes.success
            ? "Google Form submission verified successfully."
            : "Verification failed."),
        voucherCode,
      };
    }

    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Unexpected response from atomic webhook verification RPC.",
    };
  } catch (err: any) {
    console.error(
      "[SPIN WEBHOOK] Unexpected error during atomic webhook verification:",
      err
    );
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: "Internal error during webhook processing: " + err.message,
    };
  }
}

// ─── 11. Admin Fetch All Entries (Authenticated & PII-Masked) ───────────────────

export async function fetchAdminSpinEntriesCore(data?: {
  authToken?: string;
  unmask?: boolean;
}): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  entries: SpinWheelEntry[];
}> {
  const adminCheck = await verifyAdminSession(data?.authToken);
  if (!adminCheck.isValid) {
    return {
      success: false,
      code: "UNAUTHORIZED",
      error:
        adminCheck.error ||
        "Admin authentication required. Please sign in as an administrator.",
      entries: [] as SpinWheelEntry[],
    };
  }

  if (data?.unmask && adminCheck.email) {
    try {
      await adminLogsTable().insert({
        admin_email: adminCheck.email,
        action: "UNMASK_PII",
        notes: "Admin unmasked participant emails and phone numbers in dashboard.",
      });
    } catch {}
  }

  try {
    const { data: dbData, error } = await (spinTable().select("*") as any)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(dbData)) {
      return {
        success: true,
        entries: dbData.map((d: any) => ({
          id: d.id,
          name: d.name,
          email: data?.unmask ? d.email : maskEmail(d.email),
          phone: d.phone ? (data?.unmask ? d.phone : maskPhone(d.phone)) : undefined,
          college: d.college,
          rewardId: d.reward_id,
          rewardTitle: d.reward_title,
          voucherCode: d.voucher_code,
          probabilityPct: Number(d.probability_pct),
          status: d.status,
          rewardStatus: d.reward_status || (d.status === "claimed" ? "REDEEMED" : d.status === "rejected" ? "REJECTED" : "PENDING"),
          formStatus: d.form_status || (d.status === "claimed" ? "FORM_VERIFIED" : "NOT_APPLICABLE"),
          formUrl: d.form_url,
          formOpenedAt: d.form_opened_at,
          formSubmittedAt: d.form_submitted_at,
          formVerifiedAt: d.form_verified_at,
          formResponseId: d.form_response_id,
          isClaimed: Boolean(d.is_claimed),
          claimedAt: d.claimed_at,
          claimNotes: d.claim_notes,
          redeemedAt: d.redeemed_at,
          redeemedByAdmin: d.redeemed_by_admin,
          redemptionNotes: d.redemption_notes,
          createdAt: d.created_at,
        })) as SpinWheelEntry[],
      };
    }
  } catch {}

  return {
    success: true,
    entries: Array.from(memorySpinEntries.values()).map((e) => ({
      ...e,
      email: data?.unmask ? e.email : maskEmail(e.email),
      phone: e.phone ? (data?.unmask ? e.phone : maskPhone(e.phone)) : undefined,
    })),
  };
}

