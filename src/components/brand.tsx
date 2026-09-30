import { Link } from "@tanstack/react-router";

type WordmarkProps = {
  className?: string;
  inverted?: boolean;
  compact?: boolean;
  theme?: "light" | "dark";
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function Wordmark({
  className = "",
  inverted = false,
  compact = false,
  theme = "light",
  onClick,
}: WordmarkProps) {
  const isDark = theme === "dark" || inverted;

  return (
    <Link
      to="/"
      onClick={onClick}
      className={`inline-flex items-center gap-2 transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden
        decoding="async"
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

export function GooglePlayIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#00C3FF"
        d="M57.6 28.8c-7.2 7.7-11.5 19.3-11.5 33.7v387c0 14.4 4.3 26 11.5 33.7l1.9 1.8 217.1-217.1v-5.2L59.5 27z"
      />
      <path
        fill="#FFD400"
        d="M349.3 328.7l-72.7-72.7v-5.2l72.7-72.7 1.6 0.9 86.2 49c24.6 14 24.6 36.8 0 50.8l-86.2 49z"
      />
      <path
        fill="#FF334B"
        d="M276.6 250.8L57.6 469.8c8.1 8.6 21.6 9.6 36.8 1l254.9-144.8-72.7-75.2z"
      />
      <path
        fill="#00E676"
        d="M276.6 261.2l72.7-72.7L94.4 43.7c-15.2-8.6-28.7-7.6-36.8 1l219 216.5z"
      />
    </svg>
  );
}
