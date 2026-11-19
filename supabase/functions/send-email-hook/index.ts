import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.13";

/**
 * Supabase Auth Send Email Hook Edge Function (Nodemailer Integration)
 *
 * Required Secrets in Supabase Dashboard (Edge Function Secrets):
 * - SMTP_HOST: SMTP host (e.g., "smtp.gmail.com")
 * - SMTP_PORT: SMTP port (e.g., 587 or 465)
 * - SMTP_USER: SMTP username / email address
 * - SMTP_PASS: SMTP password / App password
 * - SEND_EMAIL_HOOK_SECRET: Secret for verifying requests from Supabase Auth
 * - SENDER_EMAIL: Optional verified sender email (defaults to "Micrylis <SMTP_USER>")
 * - SMTP_SECURE: Optional boolean string ("true" or "false")
 * - SMTP_IGNORE_TLS: Optional boolean string ("true" or "false")
 */

interface EmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: "signup" | "recovery" | "email_change" | "magiclink" | string;
    site_url: string;
  };
}

/**
 * Constant-time string comparison to prevent timing attacks on authorization secrets.
 */
async function timingSafeStringCompare(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const encoder = new TextEncoder();
  const aHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(a)));
  const bHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(b)));
  let diff = 0;
  for (let i = 0; i < aHash.length; i++) {
    diff |= aHash[i] ^ bHash[i];
  }
  return diff === 0;
}

serve(async (req: Request) => {
  // CORS & Method Check
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth-hook-secret",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { http_code: 405, message: "Method not allowed" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Resolve environment configuration (Fail closed if secrets are missing)
    const SMTP_HOST = Deno.env.get("SMTP_HOST")?.trim() || "";
    const rawPort = Deno.env.get("SMTP_PORT")?.trim();
    const SMTP_PORT = rawPort ? Number(rawPort) : 0;
    const SMTP_USER = Deno.env.get("SMTP_USER")?.trim() || "";
    const SMTP_PASS = (Deno.env.get("SMTP_PASS") || "").replace(/\s+/g, "");
    const SEND_EMAIL_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET")?.trim() || "";
    const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL")?.trim() || (SMTP_USER ? `Micrylis <${SMTP_USER}>` : "");
    const SMTP_SECURE = Deno.env.get("SMTP_SECURE") === "true" || SMTP_PORT === 465;

    // 2. Mandatory Authorization Check (Fail closed)
    if (!SEND_EMAIL_HOOK_SECRET) {
      console.error("Server misconfiguration: SEND_EMAIL_HOOK_SECRET is not configured in Edge Function environment.");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "Server misconfiguration: Authentication hook secret missing" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const incomingSecret =
      req.headers.get("x-supabase-auth-hook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      "";

    if (!incomingSecret) {
      console.error("Hook authorization failed: Missing authorization header.");
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Unauthorized" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const isAuthorized = await timingSafeStringCompare(incomingSecret, SEND_EMAIL_HOOK_SECRET);
    if (!isAuthorized) {
      console.error("Hook authorization failed: Invalid authorization secret.");
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Unauthorized" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Mandatory SMTP Credential Validation (Fail closed)
    if (!SMTP_HOST || !SMTP_PORT || isNaN(SMTP_PORT) || !SMTP_USER || !SMTP_PASS) {
      console.error("Server misconfiguration: Incomplete SMTP credentials in Edge Function environment.");
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: "Server misconfiguration: Missing SMTP credentials" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Parse and Validate Incoming Payload
    let payload: EmailHookPayload;
    try {
      payload = await req.json();
    } catch {
      console.error("Invalid payload format: Unable to parse JSON.");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload format: Malformed JSON" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { user, email_data } = payload || {};

    if (!user || !email_data || !user.email || !email_data.token) {
      console.error("Invalid payload format: missing required user or email_data fields.");
      return new Response(
        JSON.stringify({ error: { http_code: 400, message: "Invalid payload format: missing user or email_data" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const recipientEmail = user.email;
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || recipientEmail.split("@")[0];
    const actionType = email_data.email_action_type;

    // Log diagnostic summary without sensitive data
    console.log("=== Send Email Hook Processing ===", {
      actionType,
      hasRecipient: !!recipientEmail,
      hasToken: !!email_data.token,
      hasRedirectTo: !!email_data.redirect_to,
      smtpHost: SMTP_HOST,
      smtpPort: SMTP_PORT,
      secure: SMTP_SECURE,
    });

    // Build Confirmation Link
    const confirmationUrl = `${email_data.site_url}/auth/callback?token_hash=${email_data.token_hash}&type=${actionType}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

    let subject = "";
    let htmlContent = "";

    const otpCode = email_data.token;

    if (actionType === "signup") {
      subject = "Your Micrylis Verification Code: " + otpCode;
      htmlContent = buildEmailTemplate({
        title: "Welcome to Micrylis",
        heading: `Hi ${fullName},`,
        bodyText: "Thanks for creating your account! Enter the 6-digit verification code below on the signup page to verify your account.",
        buttonText: "Verify Email Address",
        buttonUrl: confirmationUrl,
        otpCode: otpCode,
        securityNote: "If you did not create a Micrylis account, you can safely ignore this email.",
      });
    } else if (actionType === "recovery") {
      subject = "Your Micrylis Password Reset Code: " + otpCode;
      htmlContent = buildEmailTemplate({
        title: "Reset Your Password",
        heading: `Hi ${fullName},`,
        bodyText: "We received a request to reset your password. Use the 6-digit verification code below or click the button to proceed.",
        buttonText: "Reset Password",
        buttonUrl: confirmationUrl,
        otpCode: otpCode,
        securityNote: "If you didn't request a password reset, please ignore this email. Your password will remain unchanged.",
      });
    } else if (actionType === "email_change") {
      subject = "Confirm email change — Micrylis";
      htmlContent = buildEmailTemplate({
        title: "Confirm Email Change",
        heading: `Hi ${fullName},`,
        bodyText: "Please confirm your new email address using the verification code below or click the button.",
        buttonText: "Confirm Email Change",
        buttonUrl: confirmationUrl,
        otpCode: otpCode,
        securityNote: "If you did not request this change, please contact support immediately.",
      });
    } else {
      subject = "Sign in to Micrylis — Your Code: " + otpCode;
      htmlContent = buildEmailTemplate({
        title: "Sign in to Micrylis",
        heading: `Hi ${fullName},`,
        bodyText: "Use the 6-digit verification code below to sign in to your Micrylis account.",
        buttonText: "Sign In to Micrylis",
        buttonUrl: confirmationUrl,
        otpCode: otpCode,
        securityNote: "If you didn't request this email, you can safely ignore it.",
      });
    }

    console.log(`Delivering email via Nodemailer (SMTP: ${SMTP_HOST}:${SMTP_PORT}) for action: ${actionType}...`);

    // Create Nodemailer Transporter with connection timeout
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: Deno.env.get("SMTP_IGNORE_TLS") !== "true",
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const mailOptions = {
      from: SENDER_EMAIL,
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    };

    const mailInfo = await transporter.sendMail(mailOptions);

    console.log("Email delivered successfully via Nodemailer. MessageId:", mailInfo.messageId);

    // CRITICAL: Supabase Auth Send Email Hook expects an empty JSON object on success.
    // Returning anything else (e.g. { success: true }) causes Supabase to treat it as a hook failure
    // and silently block the email from being processed, which breaks OTP for new signups.
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Fatal Hook Handler Error (Nodemailer):", err?.message || err);
    // Supabase Auth hooks must return HTTP 200 even on error, with the error in the body.
    // Returning non-200 causes Supabase to retry and eventually block the auth flow.
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: err?.message || "Internal server error" } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});

interface TemplateOptions {
  title: string;
  heading: string;
  bodyText: string;
  buttonText: string;
  buttonUrl: string;
  securityNote: string;
  otpCode?: string;
}

function buildEmailTemplate({ title, heading, bodyText, buttonText, buttonUrl, securityNote, otpCode }: TemplateOptions): string {
  const otpBox = otpCode ? `
              <!-- 6-Digit OTP Code Box -->
              <div style="background-color: #161926; border: 1px dashed #3b82f6; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px;">
                  Your 6-Digit Verification Code (OTP)
                </p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #38bdf8; font-family: 'Space Grotesk', Consolas, monospace;">
                  ${otpCode}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
                  Enter this code on the website to complete verification.
                </p>
              </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090a0f; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #11131c; border: 1px solid #232738; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Header Branding -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #232738; text-align: center;">
              <span style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff; font-family: 'Space Grotesk', sans-serif;">
                Micrylis
              </span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                ${heading}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                ${bodyText}
              </p>

              ${otpBox}

              <!-- Security Note -->
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
                ${securityNote}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0d0f17; border-top: 1px solid #232738; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #4b5563;">
                © ${new Date().getFullYear()} Micrylis Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
