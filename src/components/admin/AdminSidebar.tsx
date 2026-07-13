import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
  Shield,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/admin/dashboard" },
  { icon: BookOpen, label: "Course Management", to: "/admin/courses" },
  { icon: GraduationCap, label: "Course Enrollments", to: "/admin/enrollments" },
  { icon: Users, label: "Mentor Management", to: "/admin/mentors" },
  { icon: Calendar, label: "Guidance Management", to: "/admin/guidance" },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <aside className="flex h-full flex-col gap-8 bg-surface p-6">
      <Wordmark />
      <div className="rounded-xl border border-border bg-surface-elevated p-3">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-student" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Admin access
          </span>
        </div>
        <div className="mt-1 font-display text-lg">Control Center</div>
      </div>
      <nav className="flex flex-col gap-0.5 text-sm">
        {navItems.map((item) => {
          const active =
            path === item.to || (item.to !== "/admin/dashboard" && path.startsWith(item.to));
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-left transition",
                active
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-lg border border-border bg-surface-elevated p-3 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">Frontend preview</div>
        <div className="mt-1">Mock data only — backend integration pending.</div>
      </div>
    </aside>
  );
}

export { navItems as adminNavItems };
