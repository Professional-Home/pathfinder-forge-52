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

export const transporter = nodemailer.createTransport({
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

let isVerified = false;

export async function ensureMailReady(): Promise<boolean> {
  if (isVerified) return true;
  // Non-blocking verification check
  transporter.verify((err) => {
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
