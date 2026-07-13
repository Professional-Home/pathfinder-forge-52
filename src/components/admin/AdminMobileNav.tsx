import { Link, useLocation } from "@tanstack/react-router";
import { adminNavItems } from "@/components/admin/AdminSidebar";
import { cn } from "@/lib/utils";

export function AdminMobileNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border/60 bg-background/90 px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      {adminNavItems.map((item) => {
        const active =
          path === item.to ||
          (item.to !== "/admin/dashboard" && path.startsWith(item.to));
        return (
          <Link
            key={item.label}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[9px] font-medium transition",
              active
                ? "bg-surface text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className={cn("h-4 w-4", active ? "text-student" : "opacity-80")} />
            <span className="truncate">{item.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
