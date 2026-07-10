import { Link } from "@tanstack/react-router";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/logo.png" alt="Micrylis Logo" className="h-15 w-auto object-contain" />
      <span className="font-display text-xl leading-none">Micrylis</span>
    </Link>
  );
}
