import { Link } from "@tanstack/react-router";

type WordmarkProps = {
  className?: string;
  inverted?: boolean;
  compact?: boolean;
};

export function Wordmark({ className = "", inverted = false, compact = false }: WordmarkProps) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src="/logo.png"
        alt="Micrylis"
        className={`w-auto object-contain transition-[filter] duration-300 ${
          compact ? "h-6 sm:h-7" : "h-8 sm:h-9"
        } ${inverted ? "brightness-0 invert" : ""}`}
      />
      <span
        className={`font-semibold leading-none tracking-tight transition-colors duration-300 ${
          compact ? "text-base sm:text-lg" : "text-xl sm:text-[1.35rem]"
        } ${inverted ? "text-white" : "text-foreground"}`}
      >
        micrylis
      </span>
    </Link>
  );
}
