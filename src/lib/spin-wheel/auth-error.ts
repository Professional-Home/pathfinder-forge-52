/**
 * Shared, typed, and sanitized error formatter for Supabase Auth participant flows.
 * Ensures participants never see raw JSON, "{}", internal server payloads, or leaked credentials.
 */

export interface AuthErrorLike {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
}

/**
 * Checks whether a raw message looks like raw JSON, an empty object, or invalid artifact.
 */
function isGarbageOrJsonPayload(msg: string): boolean {
  const trimmed = msg.trim();
  if (
    !trimmed ||
    trimmed === "{}" ||
    trimmed === "[]" ||
    trimmed === "null" ||
    trimmed === "undefined"
  ) {
    return true;
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return true;
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return true;
  }
  return false;
}

/**
 * Sanitizes an error message by stripping accidental tokens, bearer credentials, and emails.
 */
function sanitizeMessageContent(msg: string): string {
  const clean = msg
    .replace(/bearer\s+[a-zA-Z0-9_\-.]+/gi, "[REDACTED]")
    .replace(/ey[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]*/g, "[REDACTED]")
    .replace(/sb_publishable_[a-zA-Z0-9_-]+/g, "[REDACTED]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  return clean.trim();
}

/**
 * Formats a Supabase Auth error into a clean, human-readable participant message.
 *
 * - Never returns "{}", "[]", empty strings, or raw JSON.
 * - Maps HTTP 429 to clear rate-limit guidance.
 * - Maps HTTP 500/502/503/504 to a temporary service unavailable notification.
 * - Maps network / fetch failures to connectivity advice.
 * - Uses a provided safe fallback message if the error cannot be meaningfully categorized.
 */
export function formatAuthErrorMessage(
  error: unknown,
  fallbackMessage: string = "Failed to send verification email. Please try again."
): string {
  if (!error) return fallbackMessage;

  const errObj = (typeof error === "object" && error !== null ? error : {}) as AuthErrorLike;
  const rawStatus = typeof errObj.status === "number" ? errObj.status : undefined;
  const rawCode = typeof errObj.code === "string" ? errObj.code.trim().toLowerCase() : "";

  let rawMessage = "";
  if (typeof errObj.message === "string") {
    rawMessage = errObj.message;
  } else if (typeof error === "string") {
    rawMessage = error;
  }

  // Attempt extraction if rawMessage is a JSON string
  let extractedMessage = rawMessage.trim();
  if (extractedMessage.startsWith("{") && extractedMessage.endsWith("}")) {
    try {
      const parsed = JSON.parse(extractedMessage);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.msg === "string") extractedMessage = parsed.msg;
        else if (typeof parsed.message === "string") extractedMessage = parsed.message;
        else if (typeof parsed.error_description === "string") extractedMessage = parsed.error_description;
        else if (typeof parsed.error === "string") extractedMessage = parsed.error;
        else extractedMessage = ""; // Empty or purely numerical fields like {"code":500}
      }
    } catch {
      extractedMessage = "";
    }
  }

  const isGarbage = isGarbageOrJsonPayload(extractedMessage);
  const cleanMsg = isGarbage ? "" : sanitizeMessageContent(extractedMessage);

  // 1. Rate Limiting (HTTP 429 or rate limit codes)
  if (
    rawStatus === 429 ||
    rawCode.includes("rate_limit") ||
    rawCode === "over_email_send_rate_limit" ||
    cleanMsg.toLowerCase().includes("rate limit") ||
    cleanMsg.toLowerCase().includes("too many requests")
  ) {
    return "Verification email rate limit reached. Please wait a few minutes before requesting another code.";
  }

  // 2. Server & Email Infrastructure Errors (HTTP 500, 502, 503, 504, or smtp_error)
  if (
    rawStatus === 500 ||
    rawStatus === 502 ||
    rawStatus === 503 ||
    rawStatus === 504 ||
    rawCode.includes("smtp") ||
    rawCode.includes("unexpected_failure")
  ) {
    return "Verification email service is temporarily unavailable. Please try again shortly or contact support.";
  }

  // 3. Network / Connection Failures
  if (
    rawStatus === 0 ||
    cleanMsg.toLowerCase().includes("failed to fetch") ||
    cleanMsg.toLowerCase().includes("networkerror") ||
    cleanMsg.toLowerCase().includes("network request failed")
  ) {
    return "Network connection issue. Please check your internet connection and try again.";
  }

  // 4. Specific Auth & OTP Verification Codes
  if (
    rawCode === "invalid_otp" ||
    cleanMsg.toLowerCase().includes("token has expired or is invalid") ||
    cleanMsg.toLowerCase().includes("token is invalid") ||
    cleanMsg.toLowerCase().includes("invalid token")
  ) {
    return "Invalid or expired verification code. Please check your inbox and enter the 6-digit code again.";
  }
  if (rawCode === "otp_expired" || cleanMsg.toLowerCase().includes("expired")) {
    return "This verification code has expired. Please request a new code.";
  }
  if (rawCode.includes("provider_disabled")) {
    return "Email verification is temporarily disabled. Please contact support.";
  }

  // 5. If we have a clean, non-garbage message, return it
  if (cleanMsg) {
    return cleanMsg;
  }

  // 6. Otherwise use the safe contextual fallback
  return fallbackMessage;
}
