import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Supabase Auth Send Email Hook Edge Function (Resend Integration)
 *
 * Required Secrets in Supabase Dashboard (Edge Function Secrets):
 * - RESEND_API_KEY: Your Resend API key (re_xxxxxxxx)
 * - SEND_EMAIL_HOOK_SECRET: Secret for verifying requests from Supabase Auth
 * - SENDER_EMAIL: Verified sender email in Resend (e.g., "Micrylis <noreply@yourdomain.com>")
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SEND_EMAIL_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "Micrylis <noreply@micrylis.com>";

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

  try {
    // 1. Secrets Diagnostic Logging
    console.log("=== Send Email Hook Triggered ===");
    console.log("Secrets check:", {
      hasResendApiKey: !!RESEND_API_KEY,
      hasHookSecret: !!SEND_EMAIL_HOOK_SECRET,
      senderEmail: SENDER_EMAIL,
    });

    // 2. Hook Secret Signature Verification (if configured)
    if (SEND_EMAIL_HOOK_SECRET) {
      const incomingSecret =
        req.headers.get("x-supabase-auth-hook-secret") ||
        req.headers.get("authorization")?.replace("Bearer ", "").trim();

      if (!incomingSecret || incomingSecret !== SEND_EMAIL_HOOK_SECRET) {
        console.error("Hook authorization failed: Secret mismatch or missing header.");
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid or missing x-supabase-auth-hook-secret" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Parse and Log Incoming Payload
    const payload: EmailHookPayload = await req.json();
    console.log("Incoming Payload Summary:", {
      userEmail: payload?.user?.email,
      actionType: payload?.email_data?.email_action_type,
      hasToken: !!payload?.email_data?.token,
      redirectTo: payload?.email_data?.redirect_to,
    });

    const { user, email_data } = payload;

    if (!user || !email_data || !user.email || !email_data.token) {
      console.error("Invalid payload format:", JSON.stringify(payload));
      return new Response(JSON.stringify({ error: "Invalid payload format: missing user or email_data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY secret in Edge Function environment.");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: Missing RESEND_API_KEY secret" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const recipientEmail = user.email;
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || recipientEmail.split("@")[0];
    const actionType = email_data.email_action_type;

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

    console.log(`Delivering email via Resend to ${recipientEmail} from ${SENDER_EMAIL}...`);

    // Send via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: SENDER_EMAIL,
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
      }),
    });

    const resendResponseBody = await resendResponse.text();

    if (!resendResponse.ok) {
      console.error(`Resend API Failure [HTTP ${resendResponse.status}]:`, resendResponseBody);
      return new Response(
        JSON.stringify({
          error: "Failed to deliver email via Resend",
          status: resendResponse.status,
          details: resendResponseBody,
        }),
        {
          status: resendResponse.status >= 400 && resendResponse.status < 600 ? resendResponse.status : 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Email delivered successfully via Resend API to ${recipientEmail}. Response:`, resendResponseBody);

    // Return success to Supabase Auth Hook
    return new Response(JSON.stringify({ success: true, resendResponse: resendResponseBody }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Fatal Hook Handler Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 28px auto;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #ffffff;">
                    <a href="${buttonUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #090a0f; text-decoration: none; border-radius: 12px;">
                      ${buttonText} →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link Box -->
              <div style="background-color: #181b28; border: 1px solid #282d42; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; word-break: break-all;">
                <p style="margin: 0 0 6px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                  Or click this direct link:
                </p>
                <a href="${buttonUrl}" target="_blank" style="font-size: 12px; color: #60a5fa; text-decoration: underline;">
                  ${buttonUrl}
                </a>
              </div>

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
