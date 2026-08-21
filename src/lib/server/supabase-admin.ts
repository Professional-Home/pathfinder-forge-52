import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

/**
 * Dynamically re-reads `.env` if process.env.SUPABASE_SERVICE_ROLE_KEY is missing or placeholder.
 */
function loadEnvFromFile() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...valParts] = trimmed.split("=");
          const val = valParts.join("=").trim().replace(/^["']|["']$/g, "");
          if (key.trim()) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  } catch (e) {
    // Ignore error reading .env
  }
}

export function getServiceRoleKey(): string {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY.includes("your_supabase_service_role_key")
  ) {
    loadEnvFromFile();
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (key && !key.includes("your_supabase_service_role_key")) {
    return key;
  }

  return (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_mEpvsAW9z6SpMPhLL6DMOw_-leXOoRi"
  );
}

export function getSupabaseAdmin() {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://knrmfpgwcdtpwcgkjrnk.supabase.co";

  const key = getServiceRoleKey();

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Proxy object that forwards all property accesses to a freshly resolved Supabase client.
 * This prevents stale cached clients when `.env` is modified at runtime.
 */
export const supabaseAdmin: ReturnType<typeof createClient> = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
