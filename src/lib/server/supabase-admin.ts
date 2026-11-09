import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

/**
 * Dynamically loads environment variables from .env.local (higher priority) then .env
 * without overwriting variables already populated in process.env.
 */
function loadEnvFromFile() {
  try {
    for (const filename of [".env.local", ".env"]) {
      const envPath = path.resolve(process.cwd(), filename);
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        for (const line of envContent.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...valParts] = trimmed.split("=");
            const val = valParts.join("=").trim().replace(/^["']|["']$/g, "");
            const cleanKey = key.trim();
            if (cleanKey && !process.env[cleanKey]) {
              process.env[cleanKey] = val;
            }
          }
        }
      }
    }
  } catch {
    // Ignore error reading env files
  }
}

/**
 * Resolves the Supabase project URL for server-side administration.
 * Fails closed if neither SUPABASE_URL nor VITE_SUPABASE_URL is configured.
 * Strictly forbids automatic fallback to production.
 */
export function getSupabaseAdminUrl(): string {
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    loadEnvFromFile();
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: Supabase URL is not configured. " +
      "Set SUPABASE_URL or VITE_SUPABASE_URL in your environment (e.g. .env.local). " +
      "Automatic fallback to production is strictly forbidden."
    );
  }

  const url = rawUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(
      `CRITICAL CONFIGURATION ERROR: Invalid Supabase URL: "${url}". Must start with https:// or http://.`
    );
  }

  return url;
}

/**
 * Resolves the Supabase service-role secret key.
 * Fails closed if missing, empty, or placeholder.
 * Strictly forbids substituting with an anonymous/publishable key.
 */
export function getServiceRoleKey(): string {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY.includes("your_supabase_service_role_key")
  ) {
    loadEnvFromFile();
  }

  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key || key.includes("your_supabase_service_role_key")) {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or contains placeholder. " +
      "Server administrative operations require an authentic service-role key. " +
      "Substituting with an anonymous/publishable key is strictly prohibited for security and RLS integrity."
    );
  }

  return key;
}

let cachedAdminClient: ReturnType<typeof createClient> | null = null;
let lastKey = "";
let lastUrl = "";

/**
 * Resets the cached singleton admin client. Primarily for test isolation.
 */
export function resetCachedAdminClient(): void {
  cachedAdminClient = null;
  lastKey = "";
  lastUrl = "";
}

export function getSupabaseAdmin() {
  const url = getSupabaseAdminUrl();
  const key = getServiceRoleKey();

  if (!cachedAdminClient || lastKey !== key || lastUrl !== url) {
    cachedAdminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    lastKey = key;
    lastUrl = url;
  }

  return cachedAdminClient;
}

/**
 * Proxy object that forwards all property accesses to a singleton Supabase admin client.
 */
const proxyTarget: Record<string, any> = {
  auth: null,
  from: null,
  rpc: null,
};

export const supabaseAdmin: ReturnType<typeof createClient> = new Proxy(proxyTarget as any, {
  get(target, prop) {
    if (typeof prop === "string" && target[prop]) {
      return target[prop];
    }
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
  set(target, prop, value) {
    target[prop as any] = value;
    return true;
  },
  has(target, prop) {
    if (prop in target) return true;
    const client = getSupabaseAdmin();
    return prop in client;
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === "string" && prop in target) {
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value: target[prop] || (() => {}),
      };
    }
    const client = getSupabaseAdmin();
    return Object.getOwnPropertyDescriptor(client, prop);
  },
});
