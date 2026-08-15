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
      thumbnail: (c.slug || c.name || "").toLowerCase().includes("drug")
        ? "/Photos/ai-drug-discovery-card.jpeg"
        : "/Photos/bioplastic-card.jpeg",
      applyUrl: c.applyUrl,
      status: c.status,
    }));
}

/** Merge Supabase courses with local store courses (dedupe by title or slug). */
export function mergeDashboardCourses(supabaseCourses: any[]): DashboardCourse[] {
  const normalizedSupabase: DashboardCourse[] = supabaseCourses
    .filter((c) => c.status === "published" || !c.status)
    .map((c) => {
      const defaultImage = (c.slug || c.title || c.name || "").toLowerCase().includes("drug")
        ? "/Photos/ai-drug-discovery-card.jpeg"
        : "/Photos/bioplastic-card.jpeg";
      return {
        id: String(c.id || c.slug),
        title: c.title || c.name || "Untitled Course",
        description: c.short_description || c.description || c.shortDescription || "",
        category: c.category || "General",
        duration: c.duration || "Self-paced",
        thumbnail: defaultImage,
        applyUrl: c.apply_url || c.applyUrl || "",
        status: c.status || "published",
      };
    });

  const merged = [...normalizedSupabase];
  const existingTitles = new Set(normalizedSupabase.map((c) => (c.title || "").trim().toLowerCase()));

  for (const storeCourse of getSeedDashboardCourses()) {
    if (!existingTitles.has((storeCourse.title || "").trim().toLowerCase())) {
      merged.push(storeCourse);
    }
  }

  return merged;
}
