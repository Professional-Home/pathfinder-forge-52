import { Link } from "@tanstack/react-router";

type WordmarkProps = {
  className?: string;
  inverted?: boolean;
  compact?: boolean;
  theme?: "light" | "dark";
};

export function Wordmark({
  className = "",
  inverted = false,
  compact = false,
  theme = "light",
}: WordmarkProps) {
  const isDark = theme === "dark" || inverted;

  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden
        className={`w-auto object-contain transition-[height] duration-300 ${
          compact ? "h-8 sm:h-9" : "h-9 sm:h-10"
        }`}
      />
      <span
        className={`font-semibold leading-none tracking-tight transition-[font-size,color] duration-300 ${
          compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
        } ${isDark ? "text-white" : "text-foreground"}`}
      >
        micrylis
      </span>
    </Link>
  );
}
