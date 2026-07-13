import { cn } from "@/lib/utils";

type StatusVariant =
  | "published"
  | "draft"
  | "active"
  | "inactive"
  | "completed"
  | "pending"
  | "cancelled"
  | "upcoming"
  | "beginner"
  | "intermediate"
  | "advanced";

const variantStyles: Record<StatusVariant, string> = {
  published: "bg-student-soft text-student border-student/20",
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-student-soft text-student border-student/20",
  inactive: "bg-muted text-muted-foreground border-border",
  completed: "bg-researcher-soft text-researcher border-researcher/20",
  pending: "bg-startup-soft text-startup border-startup/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  upcoming: "bg-startup-soft text-startup border-startup/20",
  beginner: "bg-researcher-soft text-researcher border-researcher/20",
  intermediate: "bg-startup-soft text-startup border-startup/20",
  advanced: "bg-student-soft text-student border-student/20",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase() as StatusVariant;
  const style = variantStyles[key] ?? variantStyles.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        style,
        className,
      )}
    >
      {status}
    </span>
  );
}
