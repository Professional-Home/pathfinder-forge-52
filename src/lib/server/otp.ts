import { createHash, randomInt } from "crypto";

/**
 * Server-side OTP utility functions.
 * 
 * - Generates cryptographically secure 6-digit OTP codes
 * - Hashes OTPs with SHA-256 (never stores plaintext)
 * - Provides timing-safe comparison
 * 
 * NEVER import this file from frontend/client code.
 */

/** OTP validity duration in minutes */
export const OTP_EXPIRY_MINUTES = 10;

/** Maximum allowed verification attempts per OTP */
export const OTP_MAX_ATTEMPTS = 5;

/** Minimum seconds between resend requests for the same email */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Generate a cryptographically secure 6-digit OTP code.
 * Uses crypto.randomInt which is CSPRNG-backed.
 */
export function generateOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

/**
 * Hash an OTP code using SHA-256.
 * We never store plaintext OTPs in the database.
 */
export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp.trim()).digest("hex");
}

/**
 * Verify an OTP by comparing hashes.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyOtpHash(submittedOtp: string, storedHash: string): boolean {
  const submittedHash = hashOtp(submittedOtp);
  // Constant-length comparison (both are always 64 hex chars from SHA-256)
  if (submittedHash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < submittedHash.length; i++) {
    result |= submittedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Calculate OTP expiry timestamp from now.
 */
export function getOtpExpiry(): string {
  const expiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  return expiry.toISOString();
}

/**
 * Normalize email address for consistent lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
