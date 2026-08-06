import { SEED_COURSES } from "./data";

export interface DashboardCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  thumbnail?: string;
  applyUrl?: string;
  apply_url?: string;
}

/** Published seed courses mapped for the user dashboard (until Supabase is synced). */
export function getSeedDashboardCourses(): DashboardCourse[] {
  return SEED_COURSES.filter((c) => c.status === "published").map((c) => ({
    id: c.id,
    title: c.name,
    description: c.shortDescription,
    category: c.category,
    duration: c.duration,
    thumbnail: c.thumbnail,
    applyUrl: c.applyUrl,
  }));
}

/** Merge Supabase courses with local seed courses (dedupe by title). */
export function mergeDashboardCourses(supabaseCourses: any[]): DashboardCourse[] {
  const normalizedSupabase: DashboardCourse[] = supabaseCourses.map((c) => ({
    id: String(c.id),
    title: c.title || c.name || "Untitled Course",
    description: c.description || c.shortDescription || "",
    category: c.category || "General",
    duration: c.duration || "Self-paced",
    thumbnail: c.thumbnail || c.coverImage || "",
    applyUrl: c.applyUrl || c.apply_url || "",
  }));

  const merged = [...normalizedSupabase];
  const existingTitles = new Set(normalizedSupabase.map((c) => c.title.trim().toLowerCase()));

  for (const seed of getSeedDashboardCourses()) {
    if (!existingTitles.has(seed.title.trim().toLowerCase())) {
      merged.push(seed);
    }
  }

  return merged;
}
