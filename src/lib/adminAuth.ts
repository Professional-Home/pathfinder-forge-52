const ADMIN_AUTH_KEY = "mf_admin_auth";
const ADMIN_USER_KEY = "mf_admin_user";

export const ADMIN_CREDENTIALS = {
  email: "admin@admin.com",
  password: "manthan@gmail",
} as const;

export type AdminUser = {
  email: string;
  name: string;
};

export function isAdminLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_AUTH_KEY) === "true";
}

export function adminLogin(email: string, password: string): boolean {
  if (
    email.trim() === ADMIN_CREDENTIALS.email &&
    password === ADMIN_CREDENTIALS.password
  ) {
    localStorage.setItem(ADMIN_AUTH_KEY, "true");
    localStorage.setItem(
      ADMIN_USER_KEY,
      JSON.stringify({ email: ADMIN_CREDENTIALS.email, name: "Admin" }),
    );
    return true;
  }
  return false;
}

export function adminLogout(): void {
  localStorage.removeItem(ADMIN_AUTH_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function getAdminUser(): AdminUser {
  if (typeof window === "undefined") {
    return { email: ADMIN_CREDENTIALS.email, name: "Admin" };
  }
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (raw) return JSON.parse(raw) as AdminUser;
  return { email: ADMIN_CREDENTIALS.email, name: "Admin" };
}
