import { supabase } from "@/utils/supabase";

const ADMIN_USER_KEY = "mf_admin_user";

export type AdminUser = {
  email: string;
  name: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

/**
 * Client admin login via native Supabase Auth password authentication.
 * Eliminates client-side hash tokens and hardcoded credentials.
 */
export async function adminLogin(
  email: string,
  pass: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass,
    });

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message || "Invalid email address or password.",
      };
    }

    const user = data.user;
    const appRole = (user.app_metadata?.role || "").toUpperCase();

    const adminUser: AdminUser = {
      email: user.email || normalizedEmail,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Micrylis Admin",
      role: appRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
      // Clean up any legacy tokens
      sessionStorage.removeItem("mf_admin_session_token");
      localStorage.removeItem("mf_admin_session_token");
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "An unexpected error occurred during admin sign-in.",
    };
  }
}

/**
 * Synchronous client check for admin route guarding.
 * Checks whether an active Supabase Auth token and admin record exist.
 */
export function isAdminLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const rawUser = localStorage.getItem(ADMIN_USER_KEY);
    if (!rawUser) return false;

    // Check if Supabase client has an active stored auth token
    const hasSbToken = Object.keys(localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    return hasSbToken;
  } catch {
    return false;
  }
}

/**
 * Get current admin access token for authenticated server function calls.
 */
export async function getAdminAccessToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Admin sign out: terminates Supabase Auth session and removes cached state.
 */
export async function adminLogout(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_USER_KEY);
    sessionStorage.removeItem("mf_admin_session_token");
    localStorage.removeItem("mf_admin_session_token");
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("[AdminAuth] Sign-out warning:", err);
  }
}

/**
 * Get currently authenticated admin user details from local cache.
 */
export function getAdminUser(): AdminUser {
  const fallback: AdminUser = {
    email: "admin@micrylis.com",
    name: "Micrylis Admin",
    role: "ADMIN",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    if (raw) return JSON.parse(raw) as AdminUser;
  } catch {
    // fallback
  }
  return fallback;
}
