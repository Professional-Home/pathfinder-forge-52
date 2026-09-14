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

export const BIOPLASTIC_APPLY_URL = "https://forms.gle/fo6EevAbEipmnyRg8";
export const DRUG_DISCOVERY_APPLY_URL = "https://forms.gle/kavwpp29u38LkgDB6";
export const BIOINFORMATICS_APPLY_URL = "https://forms.gle/pg4VPMaLw5awygzJ9";
export const COMMON_COURSE_APPLY_URL = BIOINFORMATICS_APPLY_URL;

export const COURSE_APPLY_URLS: Record<string, string> = {
  "bioplastic-innovation": BIOPLASTIC_APPLY_URL,
  "ai-in-drug-discovery": DRUG_DISCOVERY_APPLY_URL,
  "bioinformatics": BIOINFORMATICS_APPLY_URL,
};

export function getCourseApplyUrl(course?: {
  applyUrl?: string;
  apply_url?: string;
  slug?: string;
  name?: string;
  title?: string;
}): string {
  const identifier = (
    course?.slug ||
    course?.title ||
    course?.name ||
    ""
  ).toLowerCase();

  if (identifier.includes("bioplastic")) {
    return BIOPLASTIC_APPLY_URL;
  }
  if (identifier.includes("drug")) {
    return DRUG_DISCOVERY_APPLY_URL;
  }
  if (identifier.includes("bioinformatics") || identifier.includes("bio")) {
    return BIOINFORMATICS_APPLY_URL;
  }

  const explicitUrl = (course?.apply_url || course?.applyUrl || "").trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  return BIOINFORMATICS_APPLY_URL;
}
