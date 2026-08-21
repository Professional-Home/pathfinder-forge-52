/**
 * Professional HTML email templates for OTP delivery.
 * 
 * Matches the existing Micrylis dark-themed brand from the Supabase Edge Function.
 * Includes both HTML and plain-text versions.
 * 
 * NEVER import this file from frontend/client code.
 */

interface OtpEmailOptions {
  recipientName: string;
  otpCode: string;
  purpose: "signup" | "login" | "reset_password";
  expiryMinutes: number;
}

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildOtpEmail(options: OtpEmailOptions): EmailContent {
  const { recipientName, otpCode, purpose, expiryMinutes } = options;

  const purposeConfig = {
    signup: {
      subject: `Your Micrylis Verification Code: ${otpCode}`,
      title: "Welcome to Micrylis",
      bodyText:
        "Thanks for creating your account! Enter the 6-digit verification code below on the signup page to verify your account.",
      securityNote:
        "If you did not create a Micrylis account, you can safely ignore this email.",
    },
    login: {
      subject: `Sign in to Micrylis — Code: ${otpCode}`,
      title: "Sign in to Micrylis",
      bodyText:
        "Use the 6-digit verification code below to sign in to your Micrylis account.",
      securityNote:
        "If you didn't request this email, you can safely ignore it.",
    },
    reset_password: {
      subject: `Your Micrylis Password Reset Code: ${otpCode}`,
      title: "Reset Your Password",
      bodyText:
        "We received a request to reset your password. Use the 6-digit verification code below to proceed.",
      securityNote:
        "If you didn't request a password reset, please ignore this email. Your password will remain unchanged.",
    },
  };

  const config = purposeConfig[purpose];
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
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
                Hi ${recipientName},
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                ${config.bodyText}
              </p>

              <!-- 6-Digit OTP Code Box -->
              <div style="background-color: #161926; border: 1px dashed #3b82f6; border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 28px;">
                <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px;">
                  Your 6-Digit Verification Code
                </p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #38bdf8; font-family: 'Space Grotesk', Consolas, monospace;">
                  ${otpCode}
                </div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
                  This code expires in ${expiryMinutes} minutes.
                </p>
              </div>

              <!-- Security Note -->
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
                ${config.securityNote}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0d0f17; border-top: 1px solid #232738; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #4b5563;">
                &copy; ${year} Micrylis Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${config.title}

Hi ${recipientName},

${config.bodyText}

Your verification code: ${otpCode}

This code expires in ${expiryMinutes} minutes.

${config.securityNote}

© ${year} Micrylis Inc.`;

  return {
    subject: config.subject,
    html,
    text,
  };
}
