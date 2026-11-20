/**
 * Test Script for Supabase Auth Send Email Hook (Nodemailer Integration)
 *
 * STRICT SAFETY RULES:
 * - This script is for manual Staging / Local testing only.
 * - Loading .env (Production) is strictly prohibited; only .env.local (Staging) is supported.
 * - Targeting the Production Supabase project (knrmfpgwcdtpwcgkjrnk) is blocked.
 * - Dispatching an actual email requires explicit opt-in: ALLOW_EMAIL_HOOK_TEST=true.
 *
 * Usage with Node / tsx:
 *   $env:ALLOW_EMAIL_HOOK_TEST="true"; npx tsx scripts/test-email-hook.ts
 */

import fs from "node:fs";
import path from "node:path";

export const STAGING_PROJECT_REF = "neexbpcvedcfwjxpgede";
export const PRODUCTION_PROJECT_REF = "knrmfpgwcdtpwcgkjrnk";

/**
 * Loads .env.local exclusively from the workspace root.
 * Never loads or falls back to .env (Production).
 */
export function loadStagingEnvOnly(): Record<string, string> {
  const env: Record<string, string> = {};
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^['"]|['"]$/g, "");
        env[key] = val;
      }
    }
  }
  return env;
}

/**
 * Resolves and validates the target URL with strict environment boundaries.
 * Uses strict URL parsing to validate the actual hostname and protocol, eliminating path/query spoofing.
 */
export function resolveAndValidateTargetUrl(
  customUrl?: string,
  localEnv?: Record<string, string>,
): string {
  const urlCandidate =
    customUrl ||
    process.env.FUNCTION_URL ||
    (process.env.VITE_SUPABASE_URL
      ? `${process.env.VITE_SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/send-email-hook`
      : undefined) ||
    (localEnv?.VITE_SUPABASE_URL
      ? `${localEnv.VITE_SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/send-email-hook`
      : undefined);

  if (!urlCandidate) {
    throw new Error(
      "Missing target configuration: No target URL specified. Set FUNCTION_URL or configure VITE_SUPABASE_URL in .env.local pointing to Staging.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(urlCandidate);
  } catch {
    throw new Error(
      `SAFETY VIOLATION: Malformed target URL (${urlCandidate}). Valid absolute URL required.`,
    );
  }

  const protocol = parsed.protocol.toLowerCase();

  // 1. General Protocol Validation: only HTTP or HTTPS web schemes are permitted
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(
      `SAFETY VIOLATION: Target URL must use HTTP or HTTPS protocol (received ${parsed.protocol}). Unsupported schemes are strictly prohibited.`,
    );
  }

  // 2. Normalize hostname (URL parser produces lowercase; strip brackets for IPv6 like [::1])
  const normalizedHostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // 3. Explicitly reject Production Supabase project hostname or reference
  const expectedProdHostname = `${PRODUCTION_PROJECT_REF}.supabase.co`;
  if (
    normalizedHostname === expectedProdHostname ||
    normalizedHostname.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      `SAFETY VIOLATION: Target hostname (${parsed.hostname}) references Production Supabase project (${PRODUCTION_PROJECT_REF}). Execution strictly aborted.`,
    );
  }

  // 4. Validate exact allowed hostnames: Staging or local emulator
  const expectedStagingHostname = `${STAGING_PROJECT_REF}.supabase.co`;
  const isStaging = normalizedHostname === expectedStagingHostname;
  const isLocal =
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1";

  if (!isStaging && !isLocal) {
    throw new Error(
      `SAFETY VIOLATION: Target hostname (${parsed.hostname}) is neither Staging (${expectedStagingHostname}) nor local emulator (localhost / 127.0.0.1 / [::1]). Unknown remote hosts and spoofed URLs are strictly prohibited.`,
    );
  }

  // 5. Remote Staging must use secure HTTPS
  if (isStaging && protocol !== "https:") {
    throw new Error(
      `SAFETY VIOLATION: Staging Supabase target must use secure HTTPS protocol (received ${parsed.protocol}).`,
    );
  }

  return urlCandidate;
}

/**
 * Validates the mandatory email-dispatch opt-in safety flag.
 */
export function checkEmailDispatchOptIn(optInValue?: string): void {
  if (optInValue !== "true") {
    throw new Error(
      "DISPATCH BLOCKED: Sending emails via test script requires explicit authorization. Set ALLOW_EMAIL_HOOK_TEST=true to proceed.",
    );
  }
}

export const defaultTestPayload = {
  user: {
    id: "test-user-uuid-12345",
    email: process.env.TEST_EMAIL || "testuser@example.com",
    user_metadata: {
      full_name: "Test User",
    },
  },
  email_data: {
    token: "654321",
    token_hash: "dummy_token_hash_for_testing",
    redirect_to: "http://localhost:8080/auth/callback",
    email_action_type: "signup",
    site_url: "http://localhost:8080",
  },
};

export async function runTest() {
  const localEnv = loadStagingEnvOnly();
  const targetUrl = resolveAndValidateTargetUrl(process.env.FUNCTION_URL, localEnv);
  const hookSecret = process.env.SEND_EMAIL_HOOK_SECRET || localEnv.SEND_EMAIL_HOOK_SECRET || "";

  checkEmailDispatchOptIn(process.env.ALLOW_EMAIL_HOOK_TEST);

  console.log("🚀 Supabase Send Email Hook Test Mode: AUTHORIZED");
  console.log("Target Endpoint:", targetUrl);
  console.log("WARNING: An actual email dispatch will now be triggered via the edge function.");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (hookSecret) {
    headers["x-supabase-auth-hook-secret"] = hookSecret;
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(defaultTestPayload),
    });

    const responseText = await response.text();
    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    console.log("Response Body:", responseText);

    if (response.ok) {
      console.log("\n✅ SUCCESS: Edge Function executed and returned successful status.");
    } else {
      console.error("\n❌ FAILURE: Edge Function returned an error response.");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\n❌ Network/Fetch Error:", message);
  }
}

// Guard direct execution: only run if invoked directly from CLI, not when imported in test suites
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/test-email-hook.ts");

if (isDirectRun) {
  runTest().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Test execution aborted:", message);
    process.exit(1);
  });
}
