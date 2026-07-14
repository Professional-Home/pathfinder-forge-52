import { Link } from "@tanstack/react-router";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src="/logo.png"
        alt="Micrylis"
        className="h-8 w-auto object-contain sm:h-9"
      />
      <span className="font-display text-xl leading-none tracking-tight sm:text-[1.35rem]">
        Micrylis
      </span>
    </Link>
  );
}
