import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className={cn("rounded-2xl border border-border bg-surface-elevated p-6", className)}>
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

export function AdminGreeting({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-8">
      <div className="inline-flex items-center gap-2 text-xs text-student">
        <span className="h-1.5 w-1.5 rounded-full bg-student" />
        <span className="font-mono uppercase tracking-widest">Admin Panel</span>
      </div>
      <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">{sub}</p>
    </div>
  );
}

export function AdminListRow({
  primary,
  secondary,
  trailing,
}: {
  primary: string;
  secondary?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{primary}</div>
        {secondary && (
          <div className="truncate text-xs text-muted-foreground">{secondary}</div>
        )}
      </div>
      {trailing}
    </div>
  );
}

export function AdminLinkRow({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="mt-4 inline-flex items-center gap-1 text-xs text-foreground transition hover:opacity-80"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export function AdminDataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_20px_60px_-30px_rgba(0,0,0,0.08)]">
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <div className="min-w-[640px]">{children}</div>
      </div>
    </div>
  );
}

export function AdminToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm sm:flex-row sm:items-center">
      {children}
    </div>
  );
}
