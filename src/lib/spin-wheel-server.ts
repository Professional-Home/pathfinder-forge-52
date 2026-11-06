import { createServerFn } from "@tanstack/react-start";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { transporter, ensureMailReady, getSenderAddress } from "@/lib/server/mail";
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
} from "./spin-wheel/config";
import type { SpinWheelEntry } from "./spin-wheel/types";

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

// ─── 1. Check If Email Has Already Spun ─────────────────────────────────────────

export const checkEmailSpun = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => {
    if (!input.email || !isValidEmail(input.email)) {
      throw new Error("Valid email is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);

    try {
      const { data: dbEntry, error } = await (spinTable().select("*") as any)
        .eq("email", email)
        .maybeSingle();

      if (!error && dbEntry) {
        return {
          alreadySpun: true,
          entry: {
            id: dbEntry.id,
            name: dbEntry.name,
            email: dbEntry.email,
            phone: dbEntry.phone,
            college: dbEntry.college,
            rewardId: dbEntry.reward_id,
            rewardTitle: dbEntry.reward_title,
            voucherCode: dbEntry.voucher_code,
            probabilityPct: Number(dbEntry.probability_pct),
            status: dbEntry.status,
            isClaimed: Boolean(dbEntry.is_claimed),
            claimedAt: dbEntry.claimed_at,
            createdAt: dbEntry.created_at,
          } as SpinWheelEntry,
        };
      }
    } catch {
      // Fallback to memory
    }

    const memEntry = memorySpinEntries.get(email);
    if (memEntry) {
      return { alreadySpun: true, entry: memEntry };
    }

    return { alreadySpun: false };
  });

// ─── 2. Send Spin OTP to Email ──────────────────────────────────────────────────

export const sendSpinOtp = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string }) => {
    if (!input.email || !isValidEmail(input.email)) {
      throw new Error("Valid email is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
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
      const { data: existing } = await (spinTable().select("reward_title, voucher_code") as any)
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          code: "ALREADY_SPUN",
          message: `This email has already participated! Your prize was: ${existing.reward_title} (${existing.voucher_code}).`,
        };
      }
    } catch {
      if (memorySpinEntries.has(email)) {
        const prev = memorySpinEntries.get(email)!;
        return {
          success: false,
          code: "ALREADY_SPUN",
          message: `This email has already participated! Your prize was: ${prev.rewardTitle} (${prev.voucherCode}).`,
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
        sentToEmail: true,
        message: "Verification code sent! Please check your email inbox.",
      };
    } catch (err: any) {
      console.warn(
        `[SPIN] Mail send failed (${err.message}). Falling back to dev OTP code. OTP for ${email} is: ${otp}`
      );
      // Fallback allows user to test immediately even if Gmail SMTP password is not configured/expired
      return {
        success: true,
        sentToEmail: false,
        devOtp: otp,
        message: `Code: ${otp} (Email server warning: ${err.message})`,
      };
    }
  });

// ─── 3. Verify Spin OTP ─────────────────────────────────────────────────────────

export const verifySpinOtp = createServerFn({ method: "POST" })
  .validator((input: { email: string; otp: string }) => {
    if (!input.email || !input.otp) {
      throw new Error("Email and OTP are required");
    }
    return input;
  })
  .handler(async ({ data }) => {
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
  });

// ─── 4. Server-Authoritative Spin Roll & Record ────────────────────────────────

export const executeSpinRoll = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string }) => {
    if (!input.email || !isValidEmail(input.email)) {
      throw new Error("Valid email is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    if (isSpinOfferExpired()) {
      return {
        success: false,
        code: "OFFER_EXPIRED",
        message: `This promotional event concluded on ${SPIN_EXPIRY_LABEL}.`,
      };
    }

    const { name, email: rawEmail } = data;
    const email = normalizeEmail(rawEmail);

    // 1. Guard against duplicate spin
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
            email: existing.email,
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
      return {
        success: false,
        code: "ALREADY_SPUN",
        message: "You have already spun the wheel with this email address.",
        entry: memorySpinEntries.get(email),
      };
    }

    // 2. Cryptographically secure weighted random roll (1 to 100)
    const rollOutOf100 = randomInt(1, 101);
    const { reward, index: winningIndex } = selectRewardByProbability(rollOutOf100);
    const voucherCode = generateVoucherCode(reward.id);

    const newEntry: SpinWheelEntry = {
      id: "spin-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      email,
      rewardId: reward.id,
      rewardTitle: reward.title,
      voucherCode,
      probabilityPct: reward.probability,
      status: "won",
      isClaimed: false,
      createdAt: new Date().toISOString(),
    };

    // 3. Persist to Supabase
    try {
      const { data: inserted, error } = await (spinTable().insert({
        name: newEntry.name,
        email: newEntry.email,
        reward_id: newEntry.rewardId,
        reward_title: newEntry.rewardTitle,
        voucher_code: newEntry.voucherCode,
        probability_pct: newEntry.probabilityPct,
        status: "won",
        is_claimed: false,
      }).select() as any).single();

      if (!error && inserted) {
        newEntry.id = inserted.id;
      }
    } catch (e: any) {
      console.warn("[SPIN] Supabase save note:", e.message);
    }

    // Store in memory cache
    memorySpinEntries.set(email, newEntry);

    return {
      success: true,
      winningIndex,
      reward,
      voucherCode,
      entry: newEntry,
    };
  });

// ─── 5. Claim Won Reward Form Submission ────────────────────────────────────────

export const claimSpinReward = createServerFn({ method: "POST" })
  .validator((input: {
    email: string;
    phone: string;
    college?: string;
    claimNotes?: string;
  }) => {
    if (!input.email || !input.phone) {
      throw new Error("Email and phone number are required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { email: rawEmail, phone, college = "", claimNotes = "" } = data;
    const email = normalizeEmail(rawEmail);

    try {
      await (spinTable().update({
        phone: phone.trim(),
        college: college.trim(),
        claim_notes: claimNotes.trim(),
        is_claimed: true,
        status: "claimed",
        claimed_at: new Date().toISOString(),
      }) as any).eq("email", email);
    } catch {}

    const mem = memorySpinEntries.get(email);
    if (mem) {
      mem.phone = phone.trim();
      mem.college = college.trim();
      mem.claimNotes = claimNotes.trim();
      mem.isClaimed = true;
      mem.status = "claimed";
      mem.claimedAt = new Date().toISOString();
    }

    return { success: true, message: "Reward claim submitted successfully!" };
  });

// ─── 6. Reject / Dismiss Reward ───────────────────────────────────────────────

export const rejectSpinReward = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => {
    if (!input.email) throw new Error("Email is required");
    return input;
  })
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);

    try {
      await (spinTable().update({
        status: "rejected",
      }) as any).eq("email", email);
    } catch {}

    const mem = memorySpinEntries.get(email);
    if (mem) {
      mem.status = "rejected";
    }

    return { success: true };
  });

// ─── 7. Admin Fetch All Entries ────────────────────────────────────────────────

export const fetchAdminSpinEntries = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { data, error } = await (spinTable().select("*") as any)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        return {
          entries: data.map((d: any) => ({
            id: d.id,
            name: d.name,
            email: d.email,
            phone: d.phone,
            college: d.college,
            rewardId: d.reward_id,
            rewardTitle: d.reward_title,
            voucherCode: d.voucher_code,
            probabilityPct: Number(d.probability_pct),
            status: d.status,
            isClaimed: Boolean(d.is_claimed),
            claimedAt: d.claimed_at,
            claimNotes: d.claim_notes,
            createdAt: d.created_at,
          })) as SpinWheelEntry[],
        };
      }
    } catch {}

    return {
      entries: Array.from(memorySpinEntries.values()),
    };
  });

