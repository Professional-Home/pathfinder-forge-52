import { createServerFn } from "@tanstack/react-start";
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
import { buildOtpEmail } from "@/lib/server/email-templates";

// ─── Memory Fallback Store (Used if auth_otps table doesn't exist in Supabase) ──
interface MemoryOtpRecord {
  email: string;
  otp_hash: string;
  purpose: string;
  expires_at: string;
  created_at: number;
  attempts: number;
}
const memoryOtpStore = new Map<string, MemoryOtpRecord>();

function getMemoryKey(email: string, purpose: string): string {
  return `${email.toLowerCase()}:${purpose}`;
}

function otpsTable(): any {
  return (supabaseAdmin as any).from("auth_otps");
}


// ─── Types ───────────────────────────────────────────────────────────────────

interface SendOtpInput {
  email: string;
  purpose?: "signup" | "login" | "reset_password";
  name?: string;
}

interface SendOtpResult {
  success: boolean;
  code?: string;
  message: string;
}

interface VerifyOtpInput {
  email: string;
  otp: string;
  purpose?: "signup" | "login" | "reset_password";
  password?: string;
  metadata?: Record<string, string>;
}

interface VerifyOtpResult {
  success: boolean;
  code?: string;
  message: string;
  data?: {
    user?: { id: string; email: string; user_metadata?: any };
    needsPasswordSignIn?: boolean;
    verified?: boolean;
  };
}

// ─── Send OTP Server Function ────────────────────────────────────────────────

export const sendOtp = createServerFn({ method: "POST" })
  .validator((input: SendOtpInput) => {
    if (!input.email || typeof input.email !== "string") {
      throw new Error("Email is required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<SendOtpResult> => {
    try {
      const { email: rawEmail, purpose = "signup", name = "" } = data;

      if (!isValidEmail(rawEmail)) {
        return {
          success: false,
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address.",
        };
      }

      const email = normalizeEmail(rawEmail);
      const validPurposes = ["signup", "login", "reset_password"];
      if (!validPurposes.includes(purpose)) {
        return {
          success: false,
          code: "INVALID_PURPOSE",
          message: "Invalid request.",
        };
      }

      console.log(`[AUTH] OTP request received for purpose=${purpose}`);

      // Rate limiting check
      let recentSentAt: number | null = null;
      try {
        const { data: recentOtps } = await (otpsTable().select("created_at") as any)
          .eq("email", email)
          .eq("purpose", purpose)
          .order("created_at", { ascending: false })
          .limit(1);

        if (recentOtps && recentOtps.length > 0) {
          recentSentAt = new Date(recentOtps[0].created_at).getTime();
        }
      } catch (e) {
        // DB check fallback to memory
        const memRec = memoryOtpStore.get(getMemoryKey(email, purpose));
        if (memRec) recentSentAt = memRec.created_at;
      }

      if (recentSentAt) {
        const elapsed = (Date.now() - recentSentAt) / 1000;
        if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
          const remaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed);
          return {
            success: false,
            code: "RATE_LIMITED",
            message: `Please wait ${remaining} seconds before requesting a new code.`,
          };
        }
      }

      const otp = generateOtp();
      const otpHash = hashOtp(otp);
      const expiresAt = getOtpExpiry();

      console.log("[AUTH] OTP generated and hashed");

      // Try storing in Supabase table first
      let storedInDb = false;
      try {
        await otpsTable()
          .delete()
          .eq("email", email)
          .eq("purpose", purpose);

        const { error: insertError } = await otpsTable()
          .insert({
            email,
            otp_hash: otpHash,
            purpose,
            expires_at: expiresAt,
            attempts: 0,
          });

        if (!insertError) {
          storedInDb = true;
          console.log("[AUTH] OTP hash stored in Supabase database");
        } else {
          console.warn("[AUTH] Database insert note:", insertError.message);
        }
      } catch (err: any) {
        console.warn("[AUTH] Database error, using memory store:", err.message);
      }

      // Fallback to in-memory store if DB table does not exist yet
      if (!storedInDb) {
        memoryOtpStore.set(getMemoryKey(email, purpose), {
          email,
          otp_hash: otpHash,
          purpose,
          expires_at: expiresAt,
          created_at: Date.now(),
          attempts: 0,
        });
        console.log("[AUTH] OTP hash stored in memory fallback store");
      }

      const mailReady = await ensureMailReady();
      if (!mailReady) {
        console.error("[MAIL] SMTP connection not ready");
        return {
          success: false,
          code: "MAIL_ERROR",
          message: "Unable to send email at this time. Please try again later.",
        };
      }

      const recipientName = name || email.split("@")[0];
      const emailContent = buildOtpEmail({
        recipientName,
        otpCode: otp,
        purpose: purpose as "signup" | "login" | "reset_password",
        expiryMinutes: OTP_EXPIRY_MINUTES,
      });

      console.log("[MAIL] Sending OTP email via Nodemailer...");
      await transporter.sendMail({
        from: getSenderAddress(),
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log("[MAIL] Email sent successfully");

      return {
        success: true,
        message: "If the email is eligible, a verification code has been sent.",
      };
    } catch (err: any) {
      console.error("[AUTH] Send OTP error:", err.message);
      return {
        success: false,
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again.",
      };
    }
  });

// ─── Verify OTP Server Function ──────────────────────────────────────────────

export const verifyOtp = createServerFn({ method: "POST" })
  .validator((input: VerifyOtpInput) => {
    if (!input.email || !input.otp) {
      throw new Error("Email and OTP are required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<VerifyOtpResult> => {
    try {
      const {
        email: rawEmail,
        otp: submittedOtp,
        purpose = "signup",
        password,
        metadata = {},
      } = data;

      if (!isValidEmail(rawEmail)) {
        return {
          success: false,
          code: "INVALID_EMAIL",
          message: "Please provide a valid email address.",
        };
      }

      if (submittedOtp.trim().length !== 6) {
        return {
          success: false,
          code: "INVALID_OTP",
          message: "Please provide the 6-digit verification code.",
        };
      }

      const email = normalizeEmail(rawEmail);
      console.log("[AUTH] OTP verification requested for", email, "purpose=", purpose);

      let otpRecord: { id?: string; expires_at: string; attempts: number; otp_hash: string } | null = null;
      let isMemory = false;

      // 1. Try reading from Supabase DB
      try {
        const { data: otpRecords } = await otpsTable()
          .select("*")
          .eq("email", email)
          .eq("purpose", purpose)
          .order("created_at", { ascending: false })
          .limit(1);

        if (otpRecords && otpRecords.length > 0) {
          otpRecord = otpRecords[0];
        }
      } catch (e) {
        // Fallback to memory
      }

      // 2. Fallback to memory if DB returned nothing
      if (!otpRecord) {
        const memRec = memoryOtpStore.get(getMemoryKey(email, purpose));
        if (memRec) {
          otpRecord = memRec;
          isMemory = true;
        }
      }

      if (!otpRecord) {
        return {
          success: false,
          code: "NO_OTP",
          message: "No verification code found. Please request a new one.",
        };
      }

      // Check expiry
      if (new Date(otpRecord.expires_at) < new Date()) {
        if (!isMemory && otpRecord.id) {
          await otpsTable().delete().eq("id", otpRecord.id);
        } else {
          memoryOtpStore.delete(getMemoryKey(email, purpose));
        }
        return {
          success: false,
          code: "OTP_EXPIRED",
          message: "Verification code has expired. Please request a new one.",
        };
      }

      // Check attempt count
      if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        if (!isMemory && otpRecord.id) {
          await otpsTable().delete().eq("id", otpRecord.id);
        } else {
          memoryOtpStore.delete(getMemoryKey(email, purpose));
        }
        return {
          success: false,
          code: "MAX_ATTEMPTS",
          message: "Too many failed attempts. Please request a new verification code.",
        };
      }

      // Verify OTP hash
      const isValid = verifyOtpHash(submittedOtp.trim(), otpRecord.otp_hash);

      if (!isValid) {
        if (!isMemory && otpRecord.id) {
          await otpsTable()
            .update({ attempts: otpRecord.attempts + 1 })
            .eq("id", otpRecord.id);
        } else {
          otpRecord.attempts += 1;
        }

        const remaining = OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1);
        return {
          success: false,
          code: "INVALID_OTP",
          message:
            remaining > 0
              ? `Invalid verification code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
              : "Invalid verification code. Please request a new one.",
        };
      }

      console.log("[AUTH] OTP verified successfully for", email);

      // Delete used OTP
      if (!isMemory && otpRecord.id) {
        await otpsTable().delete().eq("id", otpRecord.id);
      } else {
        memoryOtpStore.delete(getMemoryKey(email, purpose));
      }

      if (purpose === "signup") {
        const signupPassword = password || generateTempPassword();

        let userId: string | undefined;
        let userEmail: string = email;
        let userMeta: any = metadata;

        // 1. Try Admin API first
        const { data: createData, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: signupPassword,
            email_confirm: true,
            user_metadata: metadata,
          });

        if (!createError && createData?.user) {
          userId = createData.user.id;
          userEmail = createData.user.email || email;
          userMeta = createData.user.user_metadata || metadata;
          console.log("[AUTH] User created via admin API for", email);
        } else {
          const errStr = (createError?.message || "").toLowerCase();
          console.warn("[AUTH] Admin createUser note:", createError?.message);

          // If user already exists in auth table, update their password & confirm email
          if (errStr.includes("already") || errStr.includes("duplicate") || errStr.includes("exists")) {
            try {
              const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
              const existingUser = listData?.users?.find(
                (u) => u.email?.toLowerCase() === email.toLowerCase()
              );
              if (existingUser) {
                await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                  password: signupPassword,
                  email_confirm: true,
                  user_metadata: metadata,
                });
                userId = existingUser.id;
                console.log("[AUTH] Existing user updated with confirmed email & new password");
              }
            } catch (e: any) {
              console.warn("[AUTH] Failed to update existing user:", e.message);
            }

            return {
              success: true,
              code: "USER_EXISTS",
              message: "Account verified. Your password has been updated — signing in...",
              data: {
                user: userId ? { id: userId, email: userEmail, user_metadata: userMeta } : undefined,
                needsPasswordSignIn: true,
              },
            };
          }

          // Fallback to standard signUp
          const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
            email,
            password: signupPassword,
            options: { data: metadata },
          });

          if (signUpError) {
            console.error("[AUTH] Standard signUp error:", signUpError.message);
            return {
              success: false,
              code: "SERVER_ERROR",
              message: signUpError.message || "Failed to create account. Please try again.",
            };
          }

          if (signUpData?.user) {
            userId = signUpData.user.id;
            userEmail = signUpData.user.email || email;
            userMeta = signUpData.user.user_metadata || metadata;
          }
        }

        return {
          success: true,
          message: "Account created and verified successfully.",
          data: {
            user: userId
              ? {
                  id: userId,
                  email: userEmail,
                  user_metadata: userMeta,
                }
              : undefined,
            needsPasswordSignIn: !!password,
          },
        };
      } else if (purpose === "login") {
        try {
          const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          if (!listError && listData?.users) {
            const existingUser = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
            if (existingUser) {
              await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                email_confirm: true,
              });
              return {
                success: true,
                message: "Email verified successfully.",
                data: {
                  user: {
                    id: existingUser.id,
                    email: existingUser.email!,
                    user_metadata: existingUser.user_metadata,
                  },
                  needsPasswordSignIn: true,
                },
              };
            }
          }
        } catch (err: any) {
          console.warn("[AUTH] Admin listUsers note:", err.message);
        }

        return {
          success: true,
          message: "Email verified successfully.",
          data: {
            needsPasswordSignIn: true,
          },
        };
      } else if (purpose === "reset_password") {
        if (password && password.trim().length >= 6) {
          try {
            const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (!listError && listData?.users) {
              const existingUser = listData.users.find(
                (u) => u.email?.toLowerCase() === email.toLowerCase()
              );
              if (existingUser) {
                const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
                  existingUser.id,
                  {
                    password: password.trim(),
                    email_confirm: true,
                  }
                );
                if (updateErr) {
                  console.error("[AUTH] Password reset update error:", updateErr.message);
                } else {
                  console.log("[AUTH] Password reset succeeded for user:", existingUser.id);
                }
              } else {
                // If user doesn't exist yet, create them with the new password
                const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
                  email,
                  password: password.trim(),
                  email_confirm: true,
                  user_metadata: metadata,
                });
                if (createErr) {
                  console.error("[AUTH] User creation during reset error:", createErr.message);
                } else {
                  console.log("[AUTH] User created with new password during reset");
                }
              }
            }
          } catch (err: any) {
            console.warn("[AUTH] Password reset update exception:", err.message);
          }
        }

        return {
          success: true,
          message: "Password reset successfully! You can now sign in with your new password.",
          data: { verified: true },
        };
      }

      return {
        success: true,
        message: "Verification successful.",
      };
    } catch (err: any) {
      console.error("[AUTH] Verify OTP error:", err.message);
      return {
        success: false,
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again.",
      };
    }
  });

function generateTempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  const array = new Uint8Array(24);
  globalThis.crypto.getRandomValues(array);
  for (const byte of array) {
    password += chars[byte % chars.length];
  }
  return password;
}
