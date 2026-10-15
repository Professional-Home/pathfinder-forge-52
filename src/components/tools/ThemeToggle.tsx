import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "outline" | "ghost" | "secondary";
}

export function ThemeToggle({
  className,
  size = "sm",
  variant = "outline",
}: ThemeToggleProps) {
  const [isDark, setIsDark] = React.useState<boolean>(false);
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialDark = stored === "dark" || (!stored && prefersDark);
    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("h-8 gap-1.5 px-2.5 text-xs font-medium border-border/80", className)}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">Theme</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn(
        "h-9 sm:h-8 min-h-[36px] gap-1.5 px-3 text-xs font-semibold rounded-lg border border-border bg-surface-elevated/90 text-foreground transition-all hover:bg-surface hover:border-researcher/60 shadow-2xs",
        className,
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      data-testid="lab-theme-toggle"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span className="font-mono text-[11px] font-medium">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300 shrink-0" aria-hidden="true" />
          <span className="font-mono text-[11px] font-medium">Dark</span>
        </>
      )}
    </Button>
  );
}
