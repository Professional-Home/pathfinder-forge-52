export type Domain = "student" | "startup" | "researcher";

export const DOMAINS: Record<
  Domain,
  {
    id: Domain;
    label: string;
    tagline: string;
    subtitle: string;
    color: string; // for inline hex uses (charts)
    accentClass: string; // text-*
    softBgClass: string; // bg-*
    borderClass: string;
    dotClass: string;
  }
> = {
  student: {
    id: "student",
    label: "Student",
    tagline: "Learn a skill. Pick a path.",
    subtitle: "A clear roadmap plus affordable mentor check-ins.",
    color: "#2F55E0",
    accentClass: "text-student",
    softBgClass: "bg-student-soft",
    borderClass: "border-student/40",
    dotClass: "bg-student",
  },
  startup: {
    id: "startup",
    label: "Startup",
    tagline: "Validate. Ship. Raise.",
    subtitle: "On-demand access to operators who've done it before.",
    color: "#E8823A",
    accentClass: "text-startup",
    softBgClass: "bg-startup-soft",
    borderClass: "border-startup/40",
    dotClass: "bg-startup",
  },
  researcher: {
    id: "researcher",
    label: "Researcher",
    tagline: "Review. Publish. Collaborate.",
    subtitle: "Method guidance, tool mastery, and expert peer review.",
    color: "#1F7A5F",
    accentClass: "text-researcher",
    softBgClass: "bg-researcher-soft",
    borderClass: "border-researcher/40",
    dotClass: "bg-researcher",
  },
};

export function isDomain(v: string | null | undefined): v is Domain {
  return v === "student" || v === "startup" || v === "researcher";
}
