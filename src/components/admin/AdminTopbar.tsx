import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { adminLogout, getAdminUser } from "@/lib/adminAuth";
import { useState } from "react";

export function AdminTopbar() {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const user = getAdminUser();

  function handleLogout() {
    adminLogout();
    navigate({ to: "/admin/login" });
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-4 md:px-8">
      <div className="flex items-center gap-3">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] border-border bg-surface p-0">
            <AdminSidebar onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="inline-flex items-center gap-2 rounded-full bg-student-soft px-3 py-1 text-xs text-student">
          <span className="h-1.5 w-1.5 rounded-full bg-student" />
          <span className="hidden sm:inline">Micrylis Admin</span>
          <span className="sm:hidden">Admin</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
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
          <DropdownMenuContent align="end" className="w-48 border-border">
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
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
