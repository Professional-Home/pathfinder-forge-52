import { SEED_COURSES } from "./data";

export interface DashboardCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  thumbnail?: string;
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
  }));
}

/** Merge Supabase courses with local seed courses (dedupe by title). */
export function mergeDashboardCourses(supabaseCourses: DashboardCourse[]): DashboardCourse[] {
  const merged = [...supabaseCourses];
  const existingTitles = new Set(supabaseCourses.map((c) => c.title.trim().toLowerCase()));

  for (const seed of getSeedDashboardCourses()) {
    if (!existingTitles.has(seed.title.trim().toLowerCase())) {
      merged.push(seed);
    }
  }

  return merged;
}
