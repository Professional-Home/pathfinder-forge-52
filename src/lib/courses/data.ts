import type { CourseRecord } from "./types";

/** Seed courses array — empty by default so all course data is fetched dynamically from Supabase. */
export const SEED_COURSES: CourseRecord[] = [];

export function getCourseBySlug(slug: string, courses: CourseRecord[]): CourseRecord | undefined {
  return courses.find((c) => c.slug === slug);
}

export function getPublishedCourses(courses: CourseRecord[]): CourseRecord[] {
  return courses.filter((c) => c.status === "published");
}

export function getCourseStats(courses: CourseRecord[]) {
  return {
    total: courses.length,
    published: courses.filter((c) => c.status === "published").length,
    draft: courses.filter((c) => c.status === "draft").length,
    featured: courses.filter((c) => c.featured).length,
  };
}

export function getCourseApplyUrl(course: {
  applyUrl?: string;
  apply_url?: string;
  slug?: string;
  name?: string;
  title?: string;
}): string {
  if (course.applyUrl) return course.applyUrl;
  if (course.apply_url) return course.apply_url;

  const id = (course.slug || course.name || course.title || "").toLowerCase();
  if (id.includes("bioinformatics")) {
    return "https://forms.gle/Xuyta8tE1GW47d838";
  }
  if (id.includes("drug")) {
    return "https://forms.gle/83HAsS9PwXmLXiox6";
  }
  return "https://forms.gle/JiUaRVJYRuFtgtBc6";
}

