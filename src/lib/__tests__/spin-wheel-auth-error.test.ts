import { describe, it, expect } from "vitest";
import { formatAuthErrorMessage } from "../spin-wheel/auth-error";

describe("formatAuthErrorMessage — Participant-Facing Sanitization", () => {
  it("never returns raw empty JSON '{}' or '[]'", () => {
    const errorEmptyObjMsg = { message: "{}" };
    const res1 = formatAuthErrorMessage(errorEmptyObjMsg, "Fallback message");
    expect(res1).not.toBe("{}");
    expect(res1).toBe("Fallback message");

    const errorEmptyArrayMsg = { message: "[]" };
    const res2 = formatAuthErrorMessage(errorEmptyArrayMsg, "Fallback message");
    expect(res2).not.toBe("[]");
    expect(res2).toBe("Fallback message");
  });

  it("handles HTTP 500 server and SMTP failures gracefully without displaying '{}'", () => {
    const error500Empty = { status: 500, message: "{}" };
    const res = formatAuthErrorMessage(error500Empty);
    expect(res).toBe(
      "Verification email service is temporarily unavailable. Please try again shortly or contact support."
    );

    const error500RawJson = { status: 500, message: '{"code":500}' };
    const res2 = formatAuthErrorMessage(error500RawJson);
    expect(res2).toBe(
      "Verification email service is temporarily unavailable. Please try again shortly or contact support."
    );

    const error500SmtpCode = { code: "smtp_error" };
    const res3 = formatAuthErrorMessage(error500SmtpCode);
    expect(res3).toBe(
      "Verification email service is temporarily unavailable. Please try again shortly or contact support."
    );
  });

  it("handles HTTP 429 rate-limiting with actionable waiting guidance", () => {
    const error429 = {
      status: 429,
      message: "For security purposes, you can only request this once every 60 seconds",
    };
    const res = formatAuthErrorMessage(error429);
    expect(res).toBe(
      "Verification email rate limit reached. Please wait a few minutes before requesting another code."
    );

    const errorRateLimitCode = {
      code: "over_email_send_rate_limit",
      message: "rate limit exceeded",
    };
    const res2 = formatAuthErrorMessage(errorRateLimitCode);
    expect(res2).toBe(
      "Verification email rate limit reached. Please wait a few minutes before requesting another code."
    );
  });

  it("handles network connection and fetch abort failures", () => {
    const fetchError = new Error("Failed to fetch");
    const res = formatAuthErrorMessage(fetchError);
    expect(res).toBe("Network connection issue. Please check your internet connection and try again.");

    const statusZeroError = { status: 0, message: "" };
    const res2 = formatAuthErrorMessage(statusZeroError);
    expect(res2).toBe("Network connection issue. Please check your internet connection and try again.");
  });

  it("handles OTP expiration and invalid code scenarios", () => {
    const expiredError = { code: "otp_expired", message: "Code expired" };
    const res = formatAuthErrorMessage(expiredError);
    expect(res).toBe("This verification code has expired. Please request a new code.");

    const invalidError = { message: "Token has expired or is invalid" };
    const res2 = formatAuthErrorMessage(invalidError);
    expect(res2).toBe(
      "Invalid or expired verification code. Please check your inbox and enter the 6-digit code again."
    );
  });

  it("redacts tokens, bearer headers, and email addresses from raw messages", () => {
    const tokenError = {
      message:
        "Failed at bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID for user john.doe@example.com with key sb_publishable_secret_key_12345",
    };
    const res = formatAuthErrorMessage(tokenError);
    expect(res).not.toContain("john.doe@example.com");
    expect(res).not.toContain("eyJhbGci");
    expect(res).not.toContain("sb_publishable_secret_key_12345");
    expect(res).toContain("[REDACTED]");
    expect(res).toContain("[EMAIL]");
  });

  it("falls back safely when error is null, undefined, or empty", () => {
    expect(formatAuthErrorMessage(null, "Default message")).toBe("Default message");
    expect(formatAuthErrorMessage(undefined, "Default message")).toBe("Default message");
    expect(formatAuthErrorMessage("", "Default message")).toBe("Default message");
  });

  it("preserves legitimate human-readable error messages", () => {
    const cleanError = {
      message: "Signups not allowed for this organization.",
    };
    expect(formatAuthErrorMessage(cleanError)).toBe("Signups not allowed for this organization.");
  });
});
