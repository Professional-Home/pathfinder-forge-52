import { Link } from "@tanstack/react-router";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
        <span className="font-display text-[15px] leading-none">M</span>
      </span>
      <span className="font-display text-xl leading-none">MentorForge</span>
    </Link>
  );
}
