import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { isAdminLoggedIn } from "@/lib/adminAuth";

const LOGIN_PATH = "/admin/login";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      throw redirect({
        to: typeof window !== "undefined" && isAdminLoggedIn() ? "/admin/dashboard" : LOGIN_PATH,
      });
    }
    if (location.pathname === LOGIN_PATH) return;
    if (typeof window !== "undefined" && !isAdminLoggedIn()) {
      throw redirect({ to: LOGIN_PATH });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === LOGIN_PATH;

  useEffect(() => {
    if (!isLoginPage && !isAdminLoggedIn()) {
      navigate({ to: LOGIN_PATH });
    }
  }, [navigate, isLoginPage]);

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <div className="mx-auto flex flex-col lg:grid lg:max-w-[1400px] lg:grid-cols-[240px_1fr]">
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>
        <div className="flex min-h-screen flex-col border-l border-border/60 bg-background">
          <AdminTopbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:py-6 md:px-8 md:py-10 lg:pb-10">
            <Outlet />
          </main>
          <AdminMobileNav />
        </div>
      </div>
    </div>
  );
}
