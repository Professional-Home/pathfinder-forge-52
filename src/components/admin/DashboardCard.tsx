import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const accentMap = {
  default: "bg-student-soft text-student border-student/20",
  startup: "bg-startup-soft text-startup border-startup/20",
  researcher: "bg-researcher-soft text-researcher border-researcher/20",
} as const;

export function DashboardCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  accent = "default",
  className,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: string;
  accent?: keyof typeof accentMap;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-border bg-surface-elevated p-6 transition hover:border-border-strong hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {title}
          </div>
          {hint && (
            <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg border",
              accentMap[accent],
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-4 font-display text-3xl md:text-4xl">{value}</div>
      {trend && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {trend}
        </div>
      )}
    </div>
  );
}
