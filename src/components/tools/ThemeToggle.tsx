import * as React from "react";

export interface ThemeToggleProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "outline" | "ghost" | "secondary";
}

/**
 * Disabled theme toggle: preserves component interface without modifying DOM classes or localStorage.
 */
export function ThemeToggle(_props: ThemeToggleProps = {}) {
  return null;
}
