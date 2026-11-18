import { supabaseAdmin } from "./supabase-admin";
import { transporter, getSenderAddress } from "./mail";
import { resolveCourseTitle } from "../courses/course-identifiers";

const db = supabaseAdmin as any;

export interface OutboxNotification {
  id: string;
  application_id: string;
  recipient_email: string;
  recipient_name?: string;
  template_name: string;
  payload: Record<string, any>;
  status: "pending" | "processing" | "sent" | "failed";
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  locked_until: string | null;
  created_at: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Sanitizes and redacts sensitive applicant data from error messages before
 * writing to notification_outbox.last_error or logging to console.
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  let message = typeof err === "string" ? err : (err as any)?.message || String(err);
  // Redact emails
  message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
  // Redact auth tokens / Bearer headers
  message = message.replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED_TOKEN]");
  // Redact long hex/uuid strings that may be tokens or secrets
  message = message.replace(/\b[0-9a-fA-F]{32,64}\b/g, "[REDACTED_HASH]");
  // Truncate to avoid database field blowup
  return message.slice(0, 500);
}

/**
 * Calculates exponential backoff delay in milliseconds based on attempt count.
 * Formula: 2^retry_count * 60 seconds (60s, 120s, 240s, 480s, etc.)
 */
export function calculateExponentialBackoffMs(retryCount: number): number {
  return Math.pow(2, Math.max(0, retryCount)) * 60 * 1000;
}

/**
 * Renders HTML and plain text email content for the course application lifecycle.
 */
export function renderNotificationEmail(
  templateName: string,
  recipientName: string,
  payload: Record<string, any>
): RenderedEmail {
  const appNumber = payload.application_number || "Application";
  const courseTitle =
    payload.course_title ||
    resolveCourseTitle(payload.course_id) ||
    "Course Program";
  const portalUrl = (process.env.APP_URL || "https://project.micrylisbiotech.com").replace(/\/+$/, "");
  const trackingUrl = `${portalUrl}/application/${appNumber}`;
  const claimUrl = payload.claim_token ? `${portalUrl}/claim-application?token=${payload.claim_token}` : null;
  const safeName = recipientName || payload.student_name || "Applicant";

  let subject = `Course Application Update: ${appNumber}`;
  let headline = "Course Application Update";
  let messageBody = "";
  let actionButtonLabel = "View Application Status";
  let actionButtonUrl = trackingUrl;

  switch (templateName) {
    case "application_received":
      subject = `Application Received: ${appNumber} — ${courseTitle}`;
      headline = "We Received Your Application";
      messageBody = `
        <p>Thank you for applying to <strong>${courseTitle}</strong>.</p>
        <p>Your unique application reference number is <strong>${appNumber}</strong>. Our admissions team has received your submission and will begin the academic review shortly.</p>
        ${
          claimUrl
            ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #166534; font-weight: 600;">Guest Application Claim Token</p>
                <p style="margin: 0; color: #15803d; font-size: 14px;">You applied as a guest. To link this application to your student account, click the button below to claim it:</p>
                <p style="margin: 12px 0 0 0;"><a href="${claimUrl}" style="background-color: #16a34a; color: #ffffff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; display: inline-block;">Claim Application Now</a></p>
              </div>`
            : ""
        }
        <p>You can monitor the status of your application and any requested documentation at any time using our status tracker.</p>
      `;
      break;

    case "review_started":
      subject = `Application Under Review: ${appNumber} — ${courseTitle}`;
      headline = "Academic Review in Progress";
      messageBody = `
        <p>Your application <strong>${appNumber}</strong> for <strong>${courseTitle}</strong> is now actively under review by our admissions evaluation committee.</p>
        <p>We are verifying your academic background, prerequisites, and statement of purpose. You will receive an update as soon as the evaluation is complete.</p>
      `;
      break;

    case "resubmission_required":
      subject = `Action Required: Additional Documents Requested for ${appNumber}`;
      headline = "Document Resubmission Required";
      const notes = payload.notes || payload.resubmission_notes || "One or more documents require clearer scans or updated details.";
      messageBody = `
        <p>During the review of your application <strong>${appNumber}</strong> for <strong>${courseTitle}</strong>, our committee identified items that require your attention:</p>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: 600; color: #92400e;">Reviewer Notes:</p>
          <p style="margin: 8px 0 0 0; color: #78350f;">${notes}</p>
        </div>
        <p>Please upload the requested replacement documents promptly through your application portal so we can finalize your review.</p>
      `;
      actionButtonLabel = "Upload Replacement Documents";
      break;

    case "application_approved":
      subject = `Congratulations! Academic Approval for ${courseTitle} (${appNumber})`;
      headline = "Application Approved!";
      messageBody = `
        <p>We are delighted to inform you that your application <strong>${appNumber}</strong> for <strong>${courseTitle}</strong> has been <strong>academically approved</strong>!</p>
        <p>Your qualifications and background meet all program criteria. To secure your seat and finalize enrollment, please complete the tuition payment or verification step through the student portal.</p>
        <p>Once payment verification is recorded, your formal enrollment and learning platform access will be activated immediately.</p>
      `;
      actionButtonLabel = "Proceed to Enrollment & Payment";
      break;

    case "application_rejected":
      subject = `Decision Update: Application ${appNumber} — ${courseTitle}`;
      headline = "Application Decision";
      const rejectionReason = payload.rejection_reason || payload.reason || "Admissions criteria were not fully satisfied for the current cohort.";
      messageBody = `
        <p>Thank you for your interest in <strong>${courseTitle}</strong> and for the time invested in your application <strong>${appNumber}</strong>.</p>
        <p>After careful evaluation of all applications, we regret to inform you that we are unable to offer you admission for the upcoming cohort.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; color: #475569; font-size: 14px;"><strong>Feedback:</strong> ${rejectionReason}</p>
        </div>
        <p>We encourage you to apply for future sessions or explore our open workshops and community initiatives.</p>
      `;
      break;

    case "enrollment_confirmed":
      subject = `Enrollment Confirmed: Welcome to ${courseTitle}! (${appNumber})`;
      headline = "Welcome to PathFinder!";
      messageBody = `
        <p>Congratulations! Your enrollment in <strong>${courseTitle}</strong> is officially confirmed.</p>
        <p>Your student seat has been activated under application reference <strong>${appNumber}</strong>. You now have full access to course curriculum materials, mentor schedules, and research project resources.</p>
        <p>Please log in to your student dashboard to access your schedule and onboarding guide.</p>
      `;
      actionButtonLabel = "Open Student Dashboard";
      actionButtonUrl = `${portalUrl}/dashboard`;
      break;

    case "enrollment_revoked":
      subject = `Notice: Enrollment Revocation — ${courseTitle} (${appNumber})`;
      headline = "Enrollment Revoked";
      const revocationReason = payload.notes || payload.reason || "Enrollment was revoked due to administrative or compliance requirements.";
      messageBody = `
        <p>This is an official notification that your enrollment for <strong>${courseTitle}</strong> (Application <strong>${appNumber}</strong>) has been revoked.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: 600; color: #991b1b;">Administrative Reason:</p>
          <p style="margin: 8px 0 0 0; color: #7f1d1d;">${revocationReason}</p>
        </div>
        <p>If you believe this action was taken in error or if you have questions regarding refunds or appeals, please contact our student support team immediately.</p>
      `;
      actionButtonLabel = "Contact Support";
      actionButtonUrl = `${portalUrl}/about`;
      break;

    default:
      messageBody = `
        <p>There is an update regarding your application <strong>${appNumber}</strong> for <strong>${courseTitle}</strong>.</p>
        <p>Please visit the status tracker for complete details.</p>
      `;
      break;
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 32px 40px; text-align: left;">
              <span style="font-size: 20px; font-weight: 700; color: #38bdf8; letter-spacing: -0.5px;">PathFinder</span>
              <span style="font-size: 14px; color: #94a3b8; margin-left: 8px;">| Micrylis Biotech</span>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 16px 0 0 0; line-height: 1.3;">${headline}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px; line-height: 1.6; font-size: 15px;">
              <p style="margin-top: 0; font-size: 16px;">Dear <strong>${safeName}</strong>,</p>
              ${messageBody}
              <div style="margin: 32px 0 24px 0; text-align: center;">
                <a href="${actionButtonUrl}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);">${actionButtonLabel}</a>
              </div>
              <p style="font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                Direct link: <a href="${actionButtonUrl}" style="color: #0284c7;">${actionButtonUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 40px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0;">PathFinder Course Application System &bull; Micrylis Biotech</p>
              <p style="margin: 0;">This is an automated notification. For support, reply or visit <a href="${portalUrl}" style="color: #0284c7; text-decoration: none;">project.micrylisbiotech.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
PathFinder Course Application Update
====================================
${headline}

Dear ${safeName},

Application Number: ${appNumber}
Course: ${courseTitle}

${messageBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}

View Application Status: ${actionButtonUrl}

------------------------------------
PathFinder &bull; Micrylis Biotech
  `.trim();

  return { subject, html, text };
}

export interface ProcessNotificationOptions {
  dryRun?: boolean;
}

export interface SimulatedNotificationItem {
  id: number | string;
  recipient_email: string;
  template_name: string;
  subject: string;
  current_status: string;
  simulated_outcome: "would_send" | "template_error";
  error?: string;
}

export interface ProcessNotificationResult {
  processed: number;
  sent: number;
  failed: number;
  simulated: number;
  dryRun: boolean;
  simulatedDeliveries?: SimulatedNotificationItem[];
}

/**
 * Processes a single batch of pending notifications from notification_outbox.
 * In dry-run mode (default when ENABLE_REAL_SMTP is not 'true'), simulates processing
 * in a read-only manner: never calls SMTP, never mutates notification status to 'sent',
 * never increments attempts or touches outbox history.
 */
export async function processNotificationBatch(
  batchSize: number = 10,
  lockSeconds: number = 60,
  options?: ProcessNotificationOptions
): Promise<ProcessNotificationResult> {
  const isDryRun =
    Boolean(options?.dryRun) ||
    process.env.NOTIFICATION_DRY_RUN === "true" ||
    process.env.ENABLE_REAL_SMTP !== "true"; // Keeps actual SMTP disabled throughout this task

  if (isDryRun) {
    // ─── DRY-RUN EXECUTION (Read-only simulation) ───
    // Does NOT invoke rpc_dequeue_notification_batch (which would mutate status to 'processing' and increment attempts).
    // Does NOT invoke Nodemailer transporter.sendMail().
    // Does NOT mutate status to 'sent', does NOT touch attempts, sent_at, or outbox history.
    try {
      const sanitizedBatchSize = Math.min(Math.max(1, batchSize), 100);
      const { data: candidates, error: fetchErr } = await db
        .from("notification_outbox")
        .select("*")
        .in("status", ["pending", "failed"])
        .lte("next_attempt_at", new Date().toISOString())
        .order("next_attempt_at", { ascending: true })
        .limit(sanitizedBatchSize);

      if (fetchErr) {
        console.error("[Notification Worker - Dry Run] Fetch error:", fetchErr);
        return { processed: 0, sent: 0, failed: 0, simulated: 0, dryRun: true };
      }

      const items = candidates || [];
      const simulatedDeliveries: SimulatedNotificationItem[] = [];

      for (const item of items) {
        try {
          const { subject } = renderNotificationEmail(
            item.template_name,
            item.recipient_name,
            item.payload || {}
          );

          simulatedDeliveries.push({
            id: item.id,
            recipient_email: item.recipient_email,
            template_name: item.template_name,
            subject,
            current_status: item.status,
            simulated_outcome: "would_send",
          });
        } catch (renderErr: any) {
          simulatedDeliveries.push({
            id: item.id,
            recipient_email: item.recipient_email,
            template_name: item.template_name,
            subject: "Render Error",
            current_status: item.status,
            simulated_outcome: "template_error",
            error: sanitizeErrorMessage(renderErr),
          });
        }
      }

      return {
        processed: items.length,
        sent: 0, // Explicitly 0: never marked as sent in dry-run
        failed: 0,
        simulated: simulatedDeliveries.length,
        dryRun: true,
        simulatedDeliveries,
      };
    } catch (err: any) {
      console.error("[Notification Worker - Dry Run] Error:", err);
      return { processed: 0, sent: 0, failed: 0, simulated: 0, dryRun: true };
    }
  }

  // ─── LIVE DISPATCH EXECUTION (Enabled only if ENABLE_REAL_SMTP === 'true') ───
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    const { data: batch, error: dequeueErr } = await db.rpc(
      "rpc_dequeue_notification_batch",
      {
        p_batch_size: batchSize,
        p_lock_seconds: lockSeconds,
      }
    );

    if (dequeueErr) {
      console.error("[Notification Worker] Error dequeuing batch:", dequeueErr);
      return { processed: 0, sent: 0, failed: 0, simulated: 0, dryRun: false };
    }

    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      return { processed: 0, sent: 0, failed: 0, simulated: 0, dryRun: false };
    }

    processed = batch.length;

    for (const item of batch) {
      try {
        const { subject, html, text } = renderNotificationEmail(
          item.template_name,
          item.recipient_name,
          item.payload || {}
        );

        // Dispatch email via Nodemailer connection pool
        await transporter.sendMail({
          from: getSenderAddress(),
          to: item.recipient_email,
          subject,
          html,
          text,
        });

        // Mark as sent
        await db
          .from("notification_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
            locked_until: null,
            payload: {
              ...(item.payload || {}),
              delivery_mode: "smtp",
              smtp_dispatched_at: new Date().toISOString(),
            },
          })
          .eq("id", item.id);

        sent++;
      } catch (err: any) {
        failed++;
        const newRetryCount = (item.retry_count || 0) + 1;
        const maxRetries = item.max_retries || 5;
        const isPermanentlyFailed = newRetryCount >= maxRetries;

        const nextRetryDate = new Date(
          Date.now() + calculateExponentialBackoffMs(newRetryCount)
        ).toISOString();

        const sanitizedError = sanitizeErrorMessage(err);

        await db
          .from("notification_outbox")
          .update({
            status: isPermanentlyFailed ? "failed" : "pending",
            retry_count: newRetryCount,
            last_error: sanitizedError,
            locked_until: isPermanentlyFailed ? null : nextRetryDate,
          })
          .eq("id", item.id);

        console.error(
          `[Notification Worker] Failed sending notification ${item.id} (template: ${item.template_name}): ${sanitizedError}`
        );
      }
    }
  } catch (globalErr) {
    console.error("[Notification Worker] Unexpected error during batch execution:", globalErr);
  }

  return { processed, sent, failed, simulated: 0, dryRun: false };
}

/**
 * Optional periodic worker runner for background environments.
 */
export function startNotificationWorker(intervalMs: number = 10_000): NodeJS.Timeout {
  console.log(`[Notification Worker] Started background polling every ${intervalMs}ms`);
  const interval = setInterval(async () => {
    try {
      const result = await processNotificationBatch(10, 60);
      if (result.processed > 0) {
        console.log(
          `[Notification Worker] Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}`
        );
      }
    } catch (e) {
      console.error("[Notification Worker] Periodic run error:", e);
    }
  }, intervalMs);

  return interval;
}
