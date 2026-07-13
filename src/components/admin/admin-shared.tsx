import React from "react";

export function AdminCard({
  title,
  hint,
  children,
  className = "",
  action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface-elevated p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {title}
          </div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
