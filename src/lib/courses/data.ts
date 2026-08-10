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
