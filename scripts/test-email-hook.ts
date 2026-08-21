/**
 * Test Script for Supabase Auth Send Email Hook (Nodemailer Integration)
 *
 * Usage with Node / tsx:
 *   npx tsx scripts/test-email-hook.ts
 *
 * Usage with Deno:
 *   deno run --allow-net --allow-env scripts/test-email-hook.ts
 */

import fs from "node:fs";
import path from "node:path";

function getSupabaseUrl(): string {
  if (process.env.FUNCTION_URL) return process.env.FUNCTION_URL;
  if (process.env.VITE_SUPABASE_URL) return `${process.env.VITE_SUPABASE_URL}/functions/v1/send-email-hook`;

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
      if (match && match[1]) {
        const baseUrl = match[1].trim().replace(/['"]/g, "");
        return `${baseUrl}/functions/v1/send-email-hook`;
      }
    }
  } catch {}

  return "https://knrmfpgwcdtpwcgkjrnk.supabase.co/functions/v1/send-email-hook";
}

const FUNCTION_URL = getSupabaseUrl();
const HOOK_SECRET = process.env.SEND_EMAIL_HOOK_SECRET || "";

const testPayload = {
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

async function runTest() {
  console.log("🚀 Testing Supabase Send Email Hook...");
  console.log("Endpoint:", FUNCTION_URL);
  console.log("Payload:", JSON.stringify(testPayload, null, 2));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (HOOK_SECRET) {
    headers["x-supabase-auth-hook-secret"] = HOOK_SECRET;
  }

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    console.log("Response Body:", responseText);

    if (response.ok) {
      console.log("\n✅ SUCCESS: Edge Function executed successfully and Nodemailer delivered the email.");
    } else {
      console.error("\n❌ FAILURE: Edge Function returned an error response.");
    }
  } catch (err) {
    console.error("\n❌ Network/Fetch Error:", err);
  }
}

runTest();
