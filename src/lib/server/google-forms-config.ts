/**
 * Google Forms & Webhook Server Configuration
 * Authoritative mapping for the 6 promotional rewards, prefilled URL generators,
 * and HMAC secret management.
 * 
 * NEVER expose this file or its secrets in client-side bundles!
 */

/**
 * Authoritative final published Google Form URLs for each of the 6 promotional reward categories.
 * 
 * IMPORTANT: forms.gle is an HTTP 302 short link. Query parameters appended to forms.gle
 * do NOT survive the redirect into the final viewform. Therefore, prefill parameters
 * are NOT appended to forms.gle URLs. When dedicated full viewform URLs are supplied via
 * GOOGLE_FORM_URL_* environment variables, prefill parameters are automatically attached.
 */
export const FINAL_GOOGLE_FORM_URLS: Record<string, string> = {
  "discount-25": "https://forms.gle/R35Bv3dhTtE2soDQA",
  "discount-50": "https://forms.gle/TkUCfTE3f7NvEumK9",
  "free-mentorship": "https://forms.gle/jcSeiXqBn2ePETKQ8",
  "live-call-founder": "https://forms.gle/zuYfD77siQYXHCSy5",
  "ielts-interview": "https://forms.gle/QiW1kPwENgyUNz4V9",
  "free-full-project": "https://forms.gle/qaSw1zMAG8LunGAU8",
};

export interface GoogleFormDefinition {
  rewardId: string;
  normalizedKey: string;
  rewardTitle: string;
  envVarUrlKey: string;
  fallbackUrl: string;
  description: string;
}

export const GOOGLE_FORM_DEFINITIONS: Record<string, GoogleFormDefinition> = {
  "discount-25": {
    rewardId: "discount-25",
    normalizedKey: "DISCOUNT_25",
    rewardTitle: "25% Discount",
    envVarUrlKey: "GOOGLE_FORM_URL_DISCOUNT_25",
    fallbackUrl: "https://forms.gle/R35Bv3dhTtE2soDQA",
    description: "25% off any certified research program or workshop",
  },
  "discount-50": {
    rewardId: "discount-50",
    normalizedKey: "DISCOUNT_50",
    rewardTitle: "50% Discount",
    envVarUrlKey: "GOOGLE_FORM_URL_DISCOUNT_50",
    fallbackUrl: "https://forms.gle/TkUCfTE3f7NvEumK9",
    description: "50% off flagship 30-day research internship",
  },
  "free-mentorship": {
    rewardId: "free-mentorship",
    normalizedKey: "FREE_MENTORSHIP",
    rewardTitle: "FREE Mentorship Session",
    envVarUrlKey: "GOOGLE_FORM_URL_FREE_MENTORSHIP",
    fallbackUrl: "https://forms.gle/jcSeiXqBn2ePETKQ8",
    description: "1-on-1 personalized academic and research career mentoring",
  },
  "live-call-founder": {
    rewardId: "live-call-founder",
    normalizedKey: "LIVE_CALL_FOUNDER",
    rewardTitle: "Live Call with the Founder",
    envVarUrlKey: "GOOGLE_FORM_URL_LIVE_CALL_FOUNDER",
    fallbackUrl: "https://forms.gle/zuYfD77siQYXHCSy5",
    description: "Exclusive 30-minute private call with the Founder of Micrylis Biotech",
  },
  "ielts-interview": {
    rewardId: "ielts-interview",
    normalizedKey: "IELTS_INTERVIEW",
    rewardTitle: "Free IELTS Interview Session",
    envVarUrlKey: "GOOGLE_FORM_URL_IELTS_INTERVIEW",
    fallbackUrl: "https://forms.gle/QiW1kPwENgyUNz4V9",
    description: "Full speaking mock interview and diagnostic feedback with an IELTS specialist",
  },
  "free-full-project": {
    rewardId: "free-full-project",
    normalizedKey: "FREE_FULL_PROJECT",
    rewardTitle: "Free Full Project (Any)",
    envVarUrlKey: "GOOGLE_FORM_URL_FREE_FULL_PROJECT",
    fallbackUrl: "https://forms.gle/qaSw1zMAG8LunGAU8",
    description: "Grand Prize: 100% scholarship for any full 30-day intensive research project",
  },
};

/**
 * Normalizes reward key to match either hyphen-case or UPPER_SNAKE_CASE.
 */
export function normalizeRewardId(rewardId: string): string | null {
  if (!rewardId) return null;
  const cleaned = rewardId.trim().toLowerCase().replace(/_/g, "-");
  if (GOOGLE_FORM_DEFINITIONS[cleaned]) {
    return cleaned;
  }
  // Check alternative alias
  if (cleaned === "founder-call") return "live-call-founder";
  return null;
}

/**
 * Gets server-configured Google Form URL for a given reward.
 * Environment variables override the fallback URL.
 */
export function getBaseGoogleFormUrl(rewardId: string): {
  url: string;
  isPlaceholder: boolean;
  isTemporaryFallback: boolean;
  definition: GoogleFormDefinition;
} {
  const normalized = normalizeRewardId(rewardId);
  if (!normalized) {
    throw new Error(`Invalid reward ID: "${rewardId}". Must match one of the 6 defined rewards.`);
  }

  const def = GOOGLE_FORM_DEFINITIONS[normalized];
  // Check primary envVarUrlKey, supporting legacy/alias GOOGLE_FORM_URL_FOUNDER_CALL for live-call-founder
  const envUrl =
    process.env[def.envVarUrlKey] ||
    (normalized === "live-call-founder" ? process.env.GOOGLE_FORM_URL_FOUNDER_CALL : undefined);

  if (envUrl && envUrl.trim().startsWith("http")) {
    return {
      url: envUrl.trim(),
      isPlaceholder: false,
      isTemporaryFallback: false,
      definition: def,
    };
  }

  // Final published Google Form URL for this reward category
  return {
    url: def.fallbackUrl,
    isPlaceholder: false,
    isTemporaryFallback: false,
    definition: def,
  };
}

/**
 * Builds prefilled Google Form URL with voucher code, email, and name query parameters.
 * 
 * NOTE: If the URL is a shortened URL (e.g. forms.gle), prefill parameters cannot survive
 * the HTTP 302 redirect. It returns the clean shortened URL directly without broken query params.
 * When individual viewform URLs are set, prefill parameters are appended.
 */
export function buildPrefilledGoogleFormUrl(
  rewardId: string,
  params: {
    voucherCode: string;
    email: string;
    name?: string;
  }
): {
  url: string;
  isPlaceholder: boolean;
  isTemporaryFallback: boolean;
  definition: GoogleFormDefinition;
} {
  const { url: baseUrl, isPlaceholder, isTemporaryFallback, definition } = getBaseGoogleFormUrl(rewardId);

  // Shortened URLs (such as forms.gle) cannot forward prefill query parameters across HTTP 302 redirects.
  const isShortenedUrl = baseUrl.includes("forms.gle");
  if (isShortenedUrl) {
    return {
      url: baseUrl,
      isPlaceholder,
      isTemporaryFallback,
      definition,
    };
  }

  // Field entry query keys (can be configured in .env or fallback to standard placeholders)
  const voucherEntry = process.env.GOOGLE_FORM_ENTRY_VOUCHER || "entry.1000001";
  const emailEntry = process.env.GOOGLE_FORM_ENTRY_EMAIL || "entry.1000002";
  const nameEntry = process.env.GOOGLE_FORM_ENTRY_NAME || "entry.1000003";

  const queryParams = new URLSearchParams();
  queryParams.set("usp", "pp_url");
  queryParams.set(voucherEntry, params.voucherCode);
  queryParams.set(emailEntry, params.email.trim().toLowerCase());
  if (params.name) {
    queryParams.set(nameEntry, params.name.trim());
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  const fullUrl = `${baseUrl}${separator}${queryParams.toString()}`;

  return {
    url: fullUrl,
    isPlaceholder,
    isTemporaryFallback,
    definition,
  };
}

/**
 * Retrieves the secret used to sign and verify Google Apps Script webhooks.
 * 
 * Security rules:
 * - In production (NODE_ENV=production or VERCEL_ENV=production), MUST fail closed if missing or < 32 bytes.
 * - In development/test, provides an explicit safe fallback if not set.
 */
export function getSpinWebhookSecret(): string {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NETLIFY_ENV === "production";

  const secret = process.env.SPIN_WEBHOOK_SECRET;

  if (isProduction) {
    if (!secret || !secret.trim()) {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: SPIN_WEBHOOK_SECRET environment variable is missing in production. Webhooks cannot be validated."
      );
    }
    const trimmed = secret.trim();
    if (Buffer.byteLength(trimmed, "utf8") < 32) {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: SPIN_WEBHOOK_SECRET is too weak. Production secret must be at least 32 bytes (256 bits)."
      );
    }
    return trimmed;
  }

  // Development and test mode
  if (secret && Buffer.byteLength(secret.trim(), "utf8") >= 32) {
    return secret.trim();
  }

  // Explicit safe development fallback key (minimum 32 bytes)
  return "dev_spin_webhook_hmac_secret_key_32_bytes_min";
}

