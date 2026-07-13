import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface-elevated p-6",
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
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-background">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="mt-4 font-display text-3xl">{value}</div>
      {trend && (
        <div className="mt-1 text-xs text-muted-foreground">{trend}</div>
      )}
    </div>
  );
}
