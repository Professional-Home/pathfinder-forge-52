import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Search, User } from "lucide-react";
import { Wordmark } from "@/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminLogout, getAdminUser } from "@/lib/adminAuth";

export function AdminTopbar() {
  const navigate = useNavigate();
  const user = getAdminUser();

  function handleLogout() {
    adminLogout();
    navigate({ to: "/admin/login" });
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/80 px-3 py-3 backdrop-blur sm:px-4 sm:py-4 md:px-8">
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="hidden lg:inline-flex items-center gap-2 rounded-full bg-student-soft px-3 py-1 text-xs text-student">
          <span className="h-1.5 w-1.5 rounded-full bg-student" />
          <span>Micrylis Admin · Control Center</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" /> Search courses, mentors, students
        </div>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2 text-sm transition hover:bg-accent"
            >
              <div className="grid h-6 w-6 place-items-center rounded-full bg-foreground font-display text-xs text-background">
                {user.name.charAt(0)}
              </div>
              <span className="hidden text-xs md:inline">{user.name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 border-border bg-background">
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Profile (preview)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
