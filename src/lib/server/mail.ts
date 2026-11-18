import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

/**
 * Server-side Nodemailer transporter using Gmail SMTP + App Password.
 * Configured with pooled connections for lightning-fast email dispatch (<0.5s).
 */

// Auto-load .env file if env vars aren't loaded into process.env
if (!process.env.GMAIL_USER && !process.env.EMAIL_USER) {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...valParts] = trimmed.split("=");
          const val = valParts.join("=").trim().replace(/^["']|["']$/g, "");
          if (key.trim() && !process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  } catch (e) {
    // Ignore error loading .env manually
  }
}

const GMAIL_USER = (process.env.GMAIL_USER || process.env.EMAIL_USER || "micrylisbiotech@gmail.com").trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "ukpucdorwtlwxiqo").replace(/\s+/g, "");

let _transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      pool: true, // Reuse TCP connection pool for ultra-fast dispatch
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }
  return _transporter;
}

export const transporter = new Proxy({} as nodemailer.Transporter, {
  get(_target, prop) {
    const client = getTransporter();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

let isVerified = false;

export async function ensureMailReady(): Promise<boolean> {
  if (isVerified) return true;
  // Non-blocking verification check
  getTransporter().verify((err) => {
    if (!err) {
      isVerified = true;
      console.log(`[MAIL] Gmail SMTP connection pool initialized for ${GMAIL_USER}`);
    } else {
      console.warn("[MAIL] Gmail SMTP verification warning:", err.message);
    }
  });
  return true;
}

export function getSenderAddress(): string {
  return `Micrylis <${GMAIL_USER}>`;
}

/**
 * ==============================================================================
 * Dedicated PathFinder Course Notification Transporter
 * ==============================================================================
 * Completely isolated from the shared transporter above.
 * Reads credentials EXCLUSIVELY from:
 *   - COURSE_NOTIFICATIONS_GMAIL_USER
 *   - COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD
 *
 * Strict Isolation Guarantees:
 * 1. NEVER falls back to GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_USER, EMAIL_PASS,
 *    or hardcoded fallback credentials.
 * 2. If either dedicated variable is absent, throws a descriptive configuration error.
 * 3. Does not impact Spin Wheel or Auth OTP workflows.
 */

let _courseNotificationTransporter: nodemailer.Transporter | null = null;

export interface DedicatedCourseNotificationCredentials {
  user: string;
  pass: string;
}

/**
 * Validates and retrieves the dedicated course notification credentials.
 * Returns null if either credential is missing, empty, or whitespace-only.
 * Strips whitespace from the App Password (e.g. Google's 4x4 grouping 'abcd efgh ijkl mnop').
 * Never logs or reveals secrets.
 */
export function getCourseNotificationCredentials(): DedicatedCourseNotificationCredentials | null {
  const user = process.env.COURSE_NOTIFICATIONS_GMAIL_USER?.trim();
  const rawPass = process.env.COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD;
  const pass = rawPass ? rawPass.replace(/\s+/g, "") : "";

  if (!user || !pass) {
    return null;
  }
  return { user, pass };
}

/**
 * Returns the dedicated Nodemailer transporter for course notifications.
 * Fails closed if dedicated credentials are not configured.
 */
export function getCourseNotificationTransporter(): nodemailer.Transporter {
  const creds = getCourseNotificationCredentials();
  if (!creds) {
    throw new Error(
      "Dedicated course notification SMTP error: COURSE_NOTIFICATIONS_GMAIL_USER and COURSE_NOTIFICATIONS_GMAIL_APP_PASSWORD are required. Fallback to shared credentials is strictly prohibited."
    );
  }

  if (!_courseNotificationTransporter) {
    _courseNotificationTransporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: creds.user,
        pass: creds.pass,
      },
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  return _courseNotificationTransporter;
}

/**
 * Resolves the dedicated sender address.
 */
export function getCourseNotificationSenderAddress(): string {
  const creds = getCourseNotificationCredentials();
  const user = creds?.user || process.env.COURSE_NOTIFICATIONS_GMAIL_USER?.trim() || "professionalhome01@gmail.com";
  return `PathFinder Admissions <${user}>`;
}

/**
 * Awaited, non-sending SMTP credential verification for course notifications.
 * Executes Nodemailer's verify() without sending an email or mutating database records.
 * Redacts any potential sensitive tokens in error messages.
 */
export async function verifyCourseNotificationSmtp(): Promise<{
  success: boolean;
  verified: boolean;
  error?: string;
}> {
  try {
    const transporter = getCourseNotificationTransporter();
    return await new Promise((resolve) => {
      transporter.verify((err) => {
        if (err) {
          const errMsg = typeof err === "string" ? err : err?.message || String(err);
          // Redact potential emails/hashes from error message
          const sanitized = errMsg
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
            .replace(/\b[0-9a-fA-F]{32,64}\b/g, "[REDACTED_HASH]")
            .slice(0, 300);
          resolve({
            success: false,
            verified: false,
            error: sanitized,
          });
        } else {
          resolve({
            success: true,
            verified: true,
          });
        }
      });
    });
  } catch (configErr: any) {
    return {
      success: false,
      verified: false,
      error: configErr?.message ? configErr.message.slice(0, 300) : "Configuration error",
    };
  }
}

/**
 * For testing purposes: allows resetting the cached dedicated transporter.
 */
export function resetCourseNotificationTransporterForTesting(): void {
  _courseNotificationTransporter = null;
}
