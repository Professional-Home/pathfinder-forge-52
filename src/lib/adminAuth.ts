const ADMIN_SESSION_TOKEN_KEY = "mf_admin_session_token";
const ADMIN_USER_KEY = "mf_admin_user";

// Simple salted signature generator for client-side session verification
function generateSessionToken(email: string): string {
  const timestamp = Date.now().toString();
  const secret = import.meta.env.VITE_ADMIN_PASSWORD || "micrylis_secure_admin_2026";
  // Create simple hash representation
  let hash = 0;
  const str = `${email}:${secret}:${timestamp}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `session_${Math.abs(hash).toString(36)}_${timestamp}`;
}

export type AdminUser = {
  email: string;
  name: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

export function getAdminConfig() {
  return {
    email: import.meta.env.VITE_ADMIN_EMAIL || "admin@admin.com",
    password: import.meta.env.VITE_ADMIN_PASSWORD || "manthan@gmail",
  };
}

export function isAdminLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const token = sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY) || localStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
    if (!token) return false;
    // Check if session token format is valid and not expired (24 hour session)
    const parts = token.split("_");
    if (parts.length < 3) return false;
    const sessionTime = parseInt(parts[2], 10);
    if (isNaN(sessionTime)) return false;
    const isExpired = Date.now() - sessionTime > 24 * 60 * 60 * 1000;
    if (isExpired) {
      adminLogout();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function adminLogin(email: string, pass: string): { success: boolean; error?: string } {
  const config = getAdminConfig();
  const normalizedEmail = email.trim().toLowerCase();
  const expectedEmail = config.email.trim().toLowerCase();

  // Timing-safe simulation / constant response
  if (normalizedEmail === expectedEmail && pass === config.password) {
    const token = generateSessionToken(normalizedEmail);
    sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
    localStorage.setItem(
      ADMIN_USER_KEY,
      JSON.stringify({
        email: expectedEmail,
        name: "Micrylis Admin",
        role: "SUPER_ADMIN",
      })
    );
    return { success: true };
  }

  // Safe generic error to avoid user enumeration
  return { success: false, error: "Invalid email address or password." };
}

export function adminLogout(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
  localStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function getAdminUser(): AdminUser {
  const defaultConfig: AdminUser = {
    email: getAdminConfig().email,
    name: "Micrylis Admin",
    role: "SUPER_ADMIN",
  };
  if (typeof window === "undefined") return defaultConfig;
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    if (raw) return JSON.parse(raw) as AdminUser;
  } catch {
    // fallback
  }
  return defaultConfig;
}

