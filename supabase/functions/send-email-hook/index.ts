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
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "Micrylis <onboarding@resend.dev>";

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
    // Optional Hook Secret verification
    const hookSecret = req.headers.get("x-supabase-auth-hook-secret");
    if (SEND_EMAIL_HOOK_SECRET && hookSecret !== SEND_EMAIL_HOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized hook request" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY secret");
      return new Response(JSON.stringify({ error: "Server misconfiguration: Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload: EmailHookPayload = await req.json();
    const { user, email_data } = payload;
    const recipientEmail = user.email;
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || recipientEmail.split("@")[0];
    const actionType = email_data.email_action_type;

    // Build Confirmation Link
    const confirmationUrl = `${email_data.site_url}/auth/callback?token_hash=${email_data.token_hash}&type=${actionType}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

    let subject = "";
    let htmlContent = "";

    if (actionType === "signup") {
      subject = "Verify your email address — Micrylis";
      htmlContent = buildEmailTemplate({
        title: "Welcome to Micrylis",
        heading: `Hi ${fullName},`,
        bodyText: "Thanks for creating your account! Please verify your email address to get started with your personalized growth journey.",
        buttonText: "Verify Email Address",
        buttonUrl: confirmationUrl,
        securityNote: "If you did not create a Micrylis account, you can safely ignore this email.",
      });
    } else if (actionType === "recovery") {
      subject = "Reset your password — Micrylis";
      htmlContent = buildEmailTemplate({
        title: "Reset Your Password",
        heading: `Hi ${fullName},`,
        bodyText: "We received a request to reset your password. Click the button below to choose a new password.",
        buttonText: "Reset Password",
        buttonUrl: confirmationUrl,
        securityNote: "If you didn't request a password reset, please ignore this email. Your password will remain unchanged.",
      });
    } else if (actionType === "email_change") {
      subject = "Confirm email change — Micrylis";
      htmlContent = buildEmailTemplate({
        title: "Confirm Email Change",
        heading: `Hi ${fullName},`,
        bodyText: "Please confirm your new email address by clicking the button below.",
        buttonText: "Confirm Email Change",
        buttonUrl: confirmationUrl,
        securityNote: "If you did not request this change, please contact support immediately.",
      });
    } else {
      subject = "Sign in to Micrylis";
      htmlContent = buildEmailTemplate({
        title: "Sign in link",
        heading: `Hi ${fullName},`,
        bodyText: "Click the link below to sign in to your Micrylis account.",
        buttonText: "Sign In to Micrylis",
        buttonUrl: confirmationUrl,
        securityNote: "If you didn't request this email, you can safely ignore it.",
      });
    }

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

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Resend API error:", resendError);
      return new Response(JSON.stringify({ error: "Failed to deliver email via Resend" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return success to Supabase Auth Hook
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Hook handler error:", err);
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
}

function buildEmailTemplate({ title, heading, bodyText, buttonText, buttonUrl, securityNote }: TemplateOptions): string {
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
              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                ${bodyText}
              </p>

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
                  If the button above doesn't work, copy and paste this link:
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
