import { supabaseAdmin } from "@/lib/server/supabase-admin";

export interface AdminAuthResult {
  isValid: boolean;
  userId?: string;
  email?: string;
  role?: string;
  error?: string;
}

/**
 * Server-only authoritative admin authentication guard.
 * Validates Supabase Auth JWT against Supabase Auth service.
 *
 * Rules:
 * - Reject any token starting with 'session_' (legacy client token).
 * - Must validate token against supabaseAdmin.auth.getUser(token).
 * - Trust ONLY app_metadata.role ('admin' or 'super_admin') or server-configured ADMIN_EMAILS.
 * - NEVER check or trust user_metadata.role (user-mutable).
 * - NO hardcoded fallback to admin@admin.com.
 * - Fails closed on any error or missing credential.
 */
export async function verifyAdminSession(authToken?: string): Promise<AdminAuthResult> {
  if (!authToken || typeof authToken !== "string" || !authToken.trim()) {
    return {
      isValid: false,
      error: "Admin authentication required. Please sign in as an administrator.",
    };
  }

  const token = authToken.trim();

  // Explicitly reject legacy client-generated tokens
  if (token.startsWith("session_")) {
    return {
      isValid: false,
      error: "Legacy client-generated admin tokens are rejected. Please sign in using Supabase Auth.",
    };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return {
        isValid: false,
        error: "Invalid or expired admin session token. Please sign in again.",
      };
    }

    const user = data.user;
    const userEmail = (user.email || "").trim().toLowerCase();

    // 1. Check authoritative app_metadata.role (managed exclusively by server/service_role)
    const appRole = (user.app_metadata?.role || "").toString().toLowerCase();
    const isAppAdmin = appRole === "admin" || appRole === "super_admin";

    // 2. Check server-configured ADMIN_EMAILS allowlist
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isConfiguredAdmin = Boolean(userEmail && configuredAdminEmails.includes(userEmail));

    // Reject if neither app_metadata nor ADMIN_EMAILS grants privilege
    // (Explicitly ignoring user_metadata.role and avoiding any default email fallback)
    if (!isAppAdmin && !isConfiguredAdmin) {
      return {
        isValid: false,
        error: "Access denied. Your account does not have administrative privileges.",
      };
    }

    return {
      isValid: true,
      userId: user.id,
      email: userEmail,
      role: isAppAdmin ? appRole : "admin",
    };
  } catch (err: any) {
    console.error("[ADMIN_GUARD] Exception validating admin session:", err.message);
    return {
      isValid: false,
      error: "An unexpected error occurred while verifying administrative authorization.",
    };
  }
}

export const requireAdminSession = verifyAdminSession;

// ─── Delete User Admin Core Implementation ───────────────────────────────────

export async function deleteUserAdminCore(data: {
  userId: string;
  authToken?: string;
}): Promise<{ success: boolean; message: string; code?: string }> {
  try {
    const adminCheck = await requireAdminSession(data.authToken);
    if (!adminCheck.isValid) {
      return {
        success: false,
        code: "UNAUTHORIZED",
        message:
          adminCheck.error ||
          "Admin authentication required. Please sign in as an administrator.",
      };
    }

    const { userId } = data;
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return {
        success: false,
        code: "INVALID_USER_ID",
        message: "User ID is required for deletion.",
      };
    }

    console.log("[ADMIN] Authorized admin deletion for user ID:", userId);

    // 1. Delete from Supabase Auth via Admin API
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.warn("[ADMIN] Supabase auth.admin.deleteUser note:", authError.message);
    } else {
      console.log("[ADMIN] User successfully deleted from Supabase Auth:", userId);
    }

    // 2. Explicitly delete from public.users and public.profile tables
    try {
      await supabaseAdmin.from("users").delete().eq("id", userId);
    } catch (e: any) {
      console.warn("[ADMIN] Delete from public.users note:", e.message);
    }

    try {
      await supabaseAdmin.from("profile").delete().eq("id", userId);
    } catch (e: any) {
      console.warn("[ADMIN] Delete from public.profile note:", e.message);
    }

    return {
      success: true,
      message: "User deleted successfully from Supabase.",
    };
  } catch (err: any) {
    console.error("[ADMIN] Delete user error:", err.message);
    return {
      success: false,
      message: err.message || "Failed to delete user.",
    };
  }
}

// ─── List Users Admin Core Implementation ─────────────────────────────────────

export async function listUsersAdminCore(data?: {
  authToken?: string;
}): Promise<{ success: boolean; users: any[]; error?: string; code?: string }> {
  try {
    const adminCheck = await requireAdminSession(data?.authToken);
    if (!adminCheck.isValid) {
      return {
        success: false,
        code: "UNAUTHORIZED",
        users: [],
        error:
          adminCheck.error ||
          "Admin authentication required. Please sign in as an administrator.",
      };
    }

    // 1. Try listing users via Supabase Admin API
    const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers();
    if (!error && authData?.users) {
      const mappedUsers = authData.users.map((u: any) => ({
        id: u.id,
        email: u.email || "",
        full_name:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email?.split("@")[0] ||
          "User",
        provider:
          u.app_metadata?.provider ||
          (u.identities && u.identities[0]?.provider) ||
          "email",
        created_at: u.created_at || new Date().toISOString(),
      }));
      return { success: true, users: mappedUsers };
    }

    // 2. Fallback to public.profile or public.users table
    const { data: profiles, error: profileErr } = await supabaseAdmin
      .from("profile")
      .select("*");
    if (!profileErr && profiles) {
      const mapped = profiles.map((p: any) => ({
        id: p.id,
        email: p.email || "",
        full_name: p.name || "User",
        provider: "email",
        created_at: p.created_at || new Date().toISOString(),
      }));
      return { success: true, users: mapped };
    }

    return {
      success: false,
      users: [],
      error: error?.message || profileErr?.message,
    };
  } catch (err: any) {
    console.error("[ADMIN] List users error:", err.message);
    return { success: false, users: [], error: err.message };
  }
}
