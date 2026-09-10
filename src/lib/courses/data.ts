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

export const COMMON_COURSE_APPLY_URL = "https://forms.gle/pg4VPMaLw5awygzJ9";

export const LEGACY_COURSE_APPLY_URLS = [
  "https://forms.gle/2dHi7iyXxoPFX8aL8",
  "https://forms.gle/83HAsS9PwXmLXiox6",
  "https://forms.gle/JiUaRVJYRuFtgtBc6",
];

export function getCourseApplyUrl(course?: {
  applyUrl?: string;
  apply_url?: string;
  slug?: string;
  name?: string;
  title?: string;
}): string {
  const rawUrl = (course?.applyUrl || course?.apply_url || "").trim();

  // If the course explicitly has an external URL that is NOT one of the legacy course Google Forms, preserve it.
  if (rawUrl && !LEGACY_COURSE_APPLY_URLS.includes(rawUrl)) {
    return rawUrl;
  }

  // All course applications funnel to the common Google Form
  return COMMON_COURSE_APPLY_URL;
}
