import React from "react";
import { DOMAINS, type Domain } from "@/lib/domain";

export function Card({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface-elevated p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function Greeting({ domain, title, sub }: { domain: Domain; title: string; sub: string }) {
  const d = DOMAINS[domain];
  return (
    <div className="mb-8">
      <div className={`inline-flex items-center gap-2 text-xs ${d.accentClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${d.dotClass}`} />
        <span className="font-mono uppercase tracking-widest">{d.label} lane</span>
      </div>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{sub}</p>
    </div>
  );
}

export function MentorRow({ name, tag, price, domain }: { name: string; tag: string; price: string; domain: Domain }) {
  const d = DOMAINS[domain];
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-full ${d.softBgClass} grid place-items-center font-display ${d.accentClass}`}>
          {name[0]}
        </div>
        <div>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{tag}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm">{price}</span>
        <button className="rounded-md bg-foreground px-2.5 py-1 text-xs text-background">Book</button>
      </div>
    </div>
  );
}

export function GuidanceRow({ tag, title, read }: { tag: string; title: string; read: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div>
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{tag}</div>
        <div className="mt-0.5 text-sm font-medium">{title}</div>
      </div>
      <div className="whitespace-nowrap text-xs text-muted-foreground">{read}</div>
    </div>
  );
}
