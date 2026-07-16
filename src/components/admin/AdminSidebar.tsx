import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Shield } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  Calendar,
} from "lucide-react";

export const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", shortLabel: "Home", to: "/admin/dashboard" },
  { icon: BookOpen, label: "Course Management", shortLabel: "Courses", to: "/admin/courses" },
  { icon: GraduationCap, label: "Course Enrollments", shortLabel: "Students", to: "/admin/enrollments" },
  { icon: Users, label: "Users", shortLabel: "Users", to: "/admin/users" },
  { icon: Users, label: "Mentor Management", shortLabel: "Mentors", to: "/admin/mentors" },
  { icon: Calendar, label: "Guidance Management", shortLabel: "Guidance", to: "/admin/guidance" },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const path = location.pathname;

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-8 bg-surface p-6">
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
        {adminNavItems.map((item) => {
          const active =
            path === item.to ||
            (item.to !== "/admin/dashboard" && path.startsWith(item.to));
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-left transition",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 text-xs text-muted-foreground">
        <div className="rounded-lg border border-border bg-surface-elevated p-3">
          <div className="font-medium text-foreground">Back to website</div>
          <div className="mt-1">Return to the public Micrylis site.</div>
          <Link
            to="/"
            onClick={onNavigate}
            className="mt-3 inline-flex items-center gap-1 text-foreground"
          >
            Go home <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
