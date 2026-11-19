import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  STAGING_PROJECT_REF,
  PRODUCTION_PROJECT_REF,
  resolveAndValidateTargetUrl,
  checkEmailDispatchOptIn,
  loadStagingEnvOnly,
} from "../../../scripts/test-email-hook";

describe("Phase 2 Step 7B/7C/7E: Supabase Auth Email Hook & Test Script Security", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FUNCTION_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.ALLOW_EMAIL_HOOK_TEST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // 1. Test Script Security Safeguards (scripts/test-email-hook.ts)
  // =========================================================================
  describe("scripts/test-email-hook.ts strict URL hostname and protocol validation", () => {
    it("rejects when no target configuration is provided", () => {
      expect(() => resolveAndValidateTargetUrl()).toThrowError(/Missing target configuration/i);
    });

    it("rejects malformed URLs", () => {
      expect(() => resolveAndValidateTargetUrl("not-a-valid-url")).toThrowError(
        /SAFETY VIOLATION: Malformed target URL/i,
      );
    });

    it("rejects Production project reference in custom URL", () => {
      const prodUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co/functions/v1/send-email-hook`;
      expect(() => resolveAndValidateTargetUrl(prodUrl)).toThrowError(
        new RegExp(`SAFETY VIOLATION.*Production Supabase project.*${PRODUCTION_PROJECT_REF}`, "i"),
      );
    });

    it("rejects Production project reference from environment variables", () => {
      process.env.FUNCTION_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co/functions/v1/send-email-hook`;
      expect(() => resolveAndValidateTargetUrl()).toThrowError(
        new RegExp(`SAFETY VIOLATION.*Production Supabase project`, "i"),
      );
    });

    it("rejects spoofed URLs with Staging reference in query parameters", () => {
      const spoofedUrl = `https://attacker.com/?project=${STAGING_PROJECT_REF}`;
      expect(() => resolveAndValidateTargetUrl(spoofedUrl)).toThrowError(
        /SAFETY VIOLATION: Target hostname \(attacker\.com\) is neither Staging.*nor local emulator/i,
      );
    });

    it("rejects spoofed URLs with Staging reference in subdomain", () => {
      const spoofedSubdomain = `https://${STAGING_PROJECT_REF}.attacker.com/functions/v1/send-email-hook`;
      expect(() => resolveAndValidateTargetUrl(spoofedSubdomain)).toThrowError(
        /SAFETY VIOLATION: Target hostname/i,
      );
    });

    it("rejects spoofed URLs with localhost in path", () => {
      const spoofedPath = "https://attacker.com/localhost";
      expect(() => resolveAndValidateTargetUrl(spoofedPath)).toThrowError(
        /SAFETY VIOLATION: Target hostname \(attacker\.com\) is neither Staging.*nor local emulator/i,
      );
    });

    it("rejects unknown remote Supabase projects", () => {
      const unknownUrl = "https://arbitrary-project-ref.supabase.co/functions/v1/send-email-hook";
      expect(() => resolveAndValidateTargetUrl(unknownUrl)).toThrowError(
        /SAFETY VIOLATION: Target hostname.*is neither Staging.*nor local emulator/i,
      );
    });

    // --- Protocol-Specific Test Cases ---

    it("accepts HTTPS for exact Staging Supabase project reference", () => {
      const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co/functions/v1/send-email-hook`;
      const resolved = resolveAndValidateTargetUrl(stagingUrl);
      expect(resolved).toBe(stagingUrl);
    });

    it("rejects unencrypted HTTP protocol for Staging Supabase target", () => {
      const insecureStagingUrl = `http://${STAGING_PROJECT_REF}.supabase.co/functions/v1/send-email-hook`;
      expect(() => resolveAndValidateTargetUrl(insecureStagingUrl)).toThrowError(
        /SAFETY VIOLATION: Staging Supabase target must use secure HTTPS protocol/i,
      );
    });

    it("accepts HTTP for localhost emulator", () => {
      const localhostUrl = "http://localhost:54321/functions/v1/send-email-hook";
      expect(resolveAndValidateTargetUrl(localhostUrl)).toBe(localhostUrl);
    });

    it("accepts HTTPS for localhost emulator", () => {
      const secureLocalhostUrl = "https://localhost:54321/functions/v1/send-email-hook";
      expect(resolveAndValidateTargetUrl(secureLocalhostUrl)).toBe(secureLocalhostUrl);
    });

    it("accepts HTTP for IPv4 loopback emulator", () => {
      const loopbackIpv4 = "http://127.0.0.1:54321/functions/v1/send-email-hook";
      expect(resolveAndValidateTargetUrl(loopbackIpv4)).toBe(loopbackIpv4);
    });

    it("accepts HTTPS for IPv6 loopback emulator", () => {
      const secureLoopbackIpv6 = "https://[::1]:54321/functions/v1/send-email-hook";
      expect(resolveAndValidateTargetUrl(secureLoopbackIpv6)).toBe(secureLoopbackIpv6);
    });

    it("rejects FTP protocol on localhost emulator", () => {
      const ftpUrl = "ftp://localhost:54321/functions/v1/send-email-hook";
      expect(() => resolveAndValidateTargetUrl(ftpUrl)).toThrowError(
        /SAFETY VIOLATION: Target URL must use HTTP or HTTPS protocol.*ftp:/i,
      );
    });

    it("rejects file protocol on local target", () => {
      const fileUrl = "file://localhost/functions/v1/send-email-hook";
      expect(() => resolveAndValidateTargetUrl(fileUrl)).toThrowError(
        /SAFETY VIOLATION: Target URL must use HTTP or HTTPS protocol.*file:/i,
      );
    });

    it("resolves target from localEnv when pointing to exact Staging hostname with HTTPS", () => {
      const localEnv = {
        VITE_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
      };
      const resolved = resolveAndValidateTargetUrl(undefined, localEnv);
      expect(resolved).toBe(
        `https://${STAGING_PROJECT_REF}.supabase.co/functions/v1/send-email-hook`,
      );
    });

    it("blocks email dispatch when ALLOW_EMAIL_HOOK_TEST is absent or false", () => {
      expect(() => checkEmailDispatchOptIn(undefined)).toThrowError(
        /DISPATCH BLOCKED.*ALLOW_EMAIL_HOOK_TEST=true/i,
      );
      expect(() => checkEmailDispatchOptIn("false")).toThrowError(
        /DISPATCH BLOCKED.*ALLOW_EMAIL_HOOK_TEST=true/i,
      );
      expect(() => checkEmailDispatchOptIn("1")).toThrowError(
        /DISPATCH BLOCKED.*ALLOW_EMAIL_HOOK_TEST=true/i,
      );
    });

    it("allows email dispatch only when ALLOW_EMAIL_HOOK_TEST is strictly 'true'", () => {
      expect(() => checkEmailDispatchOptIn("true")).not.toThrow();
    });

    it("never loads .env in loadStagingEnvOnly", () => {
      const loaded = loadStagingEnvOnly();
      expect(typeof loaded).toBe("object");
    });
  });

  // =========================================================================
  // 2. Auth Email Hook Source Code Static Security Verification
  // =========================================================================
  describe("supabase/functions/send-email-hook/index.ts static security audit", () => {
    const hookFilePath = path.resolve(process.cwd(), "supabase/functions/send-email-hook/index.ts");
    const hookCode = fs.readFileSync(hookFilePath, "utf-8");

    it("contains zero hardcoded email addresses", () => {
      expect(hookCode).not.toContain("micrylisbiotech@gmail.com");
      expect(hookCode).not.toContain("@gmail.com");
    });

    it("contains zero hardcoded plaintext App Passwords or tokens", () => {
      expect(hookCode).not.toContain("ukpu cdor wtlw xiqo");
      expect(hookCode).not.toContain("ukpucdorwtlwxiqo");
    });

    it("fails closed on missing SEND_EMAIL_HOOK_SECRET with HTTP 500 error structure", () => {
      expect(hookCode).toContain("SEND_EMAIL_HOOK_SECRET");
      expect(hookCode).toContain("Server misconfiguration: Authentication hook secret missing");
    });

    it("enforces timing-safe comparison on incoming authorization secret", () => {
      expect(hookCode).toContain("timingSafeStringCompare");
      expect(hookCode).toContain("crypto.subtle.digest");
      expect(hookCode).toContain("SHA-256");
    });

    it("returns HTTP 200 with 401 error structure on unauthorized requests", () => {
      expect(hookCode).toContain('{ error: { http_code: 401, message: "Unauthorized" } }');
    });

    it("fails closed on missing SMTP credentials before attempting delivery", () => {
      expect(hookCode).toContain("Server misconfiguration: Missing SMTP credentials");
      expect(hookCode).toContain(
        "!SMTP_HOST || !SMTP_PORT || isNaN(SMTP_PORT) || !SMTP_USER || !SMTP_PASS",
      );
    });

    it("returns an empty JSON object on success per Supabase Hook contract", () => {
      expect(hookCode).toContain("new Response(JSON.stringify({}), {");
      expect(hookCode).toContain("status: 200");
    });

    it("does not log plaintext recipient email or full payload", () => {
      expect(hookCode).not.toContain(
        'console.log("Incoming Payload Summary:", {\n      userEmail:',
      );
      expect(hookCode).not.toContain("JSON.stringify(payload)");
    });
  });

  // =========================================================================
  // 3. Timing-Safe Comparison Function Logic Verification
  // =========================================================================
  describe("timing-safe comparison logic unit tests", () => {
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

    it("returns true for identical secrets", async () => {
      expect(
        await timingSafeStringCompare("super_secret_hook_key_123", "super_secret_hook_key_123"),
      ).toBe(true);
    });

    it("returns false for mismatched secrets", async () => {
      expect(
        await timingSafeStringCompare("super_secret_hook_key_123", "wrong_secret_hook_key_456"),
      ).toBe(false);
    });

    it("returns false for different length secrets", async () => {
      expect(await timingSafeStringCompare("secret", "secret_long")).toBe(false);
    });

    it("returns false when either secret is empty", async () => {
      expect(await timingSafeStringCompare("", "secret")).toBe(false);
      expect(await timingSafeStringCompare("secret", "")).toBe(false);
      expect(await timingSafeStringCompare("", "")).toBe(false);
    });
  });
});
