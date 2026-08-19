import { getAllCourses } from "./store";

export interface DashboardCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  thumbnail?: string;
  applyUrl?: string;
  apply_url?: string;
  status?: string;
}

/** Centralized image resolver for all 3 courses */
function getDashboardCourseImage(identifier: string): string {
  const lower = (identifier || "").toLowerCase();
  if (lower.includes("drug")) return "/Photos/ai-drug-discovery-card.jpeg";
  if (lower.includes("bioinformatics")) return "/Photos/bio-cover.jpeg";
  return "/Photos/bioplastic-card.jpeg";
}

/** Published store courses mapped for the user dashboard. */
export function getSeedDashboardCourses(): DashboardCourse[] {
  return getAllCourses()
    .filter((c) => c.status === "published" || !c.status)
    .map((c) => ({
      id: c.id,
      title: c.name,
      description: c.shortDescription,
      category: c.category,
      duration: c.duration,
      thumbnail: getDashboardCourseImage(c.slug || c.name || ""),
      applyUrl: c.applyUrl,
      status: c.status,
    }));
}

/** Frontend-only Bioinformatics seed for dashboard/admin */
const BIOINFORMATICS_DASHBOARD_SEED: DashboardCourse = {
  id: "bioinformatics-frontend-seed",
  title: "Bioinformatics",
  description: "A 30-Day Research Project in Bioinformatics, Computational Biology & Genomic Data Analysis",
  category: "Biotechnology",
  duration: "30 Days",
  thumbnail: "/Photos/bio-cover.jpeg",
  applyUrl: "",
  status: "published",
};

/** Merge Supabase courses with local store courses (dedupe by title or slug). */
export function mergeDashboardCourses(supabaseCourses: any[]): DashboardCourse[] {
  const normalizedSupabase: DashboardCourse[] = (supabaseCourses || [])
    .filter((c) => c.status === "published" || !c.status)
    .map((c) => ({
      id: String(c.id || c.slug),
      title: c.title || c.name || "Untitled Course",
      description: c.short_description || c.description || c.shortDescription || "",
      category: c.category || "General",
      duration: c.duration || "Self-paced",
      thumbnail: getDashboardCourseImage(c.slug || c.title || c.name || ""),
      applyUrl: c.apply_url || c.applyUrl || "",
      status: c.status || "published",
    }));

  if (normalizedSupabase.length > 0) {
    // Merge bioinformatics seed if not already present in Supabase results
    const hasBioinformatics = normalizedSupabase.some(
      (c) => c.title.toLowerCase().includes("bioinformatics") || c.id === "bioinformatics-frontend-seed"
    );
    if (!hasBioinformatics) {
      normalizedSupabase.push(BIOINFORMATICS_DASHBOARD_SEED);
    }
    return normalizedSupabase;
  }

  return getSeedDashboardCourses();
}
