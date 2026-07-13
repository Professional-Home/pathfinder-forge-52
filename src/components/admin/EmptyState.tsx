import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-elevated px-4 py-12 text-center sm:px-6 sm:py-16">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-background">
        <Icon className="h-5 w-5 text-student" />
      </div>
      <h3 className="mt-4 font-display text-2xl">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-6 bg-foreground text-background hover:bg-foreground/90"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
