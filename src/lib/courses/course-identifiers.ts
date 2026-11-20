/**
 * ====================================================================
 * CENTRALIZED COURSE IDENTIFIERS & NORMALIZATION ARCHITECTURE
 * ====================================================================
 * Single source of truth for course identifiers across:
 * - Student Dashboard (access authorization & enrollment matching)
 * - Admin Dashboard (enrollment listing & title resolution)
 * - Course Applications Backend (guest applications & transition RPCs)
 * - Database Migrations & Historical Legacy Backwards Compatibility
 *
 * Guarantees:
 * - Preserves TEXT course ID architecture (DEC-01)
 * - Does NOT alter historical enrollment records in public.enrollments_users
 * - Bridges legacy IDs ('course-*'), slugs, and canonical RFC-4122 v4 UUIDs
 * ====================================================================
 */

export interface CourseIdentifierConfig {
  canonicalId: string;
  slug: string;
  title: string;
  legacyIds: string[];
}

export const CANONICAL_COURSES: readonly CourseIdentifierConfig[] = [
  {
    canonicalId: "d2756643-0b82-4ebe-a123-9fa3be97bd13",
    slug: "bioplastic-innovation",
    title: "BioPlastic Innovation",
    legacyIds: ["course-bioplastic-innovation", "bioplastic-innovation"],
  },
  {
    canonicalId: "d6a21b1f-2682-4cf2-a83d-2c030f476625",
    slug: "ai-in-drug-discovery",
    title: "AI in Drug Discovery",
    legacyIds: [
      "course-ai-drug-discovery",
      "course-ai-in-drug-discovery",
      "ai-in-drug-discovery",
    ],
  },
  {
    canonicalId: "840fed84-696d-458e-aeee-2df6b88d3428",
    slug: "bioinformatics",
    title: "Bioinformatics & Genomic Data Analysis",
    legacyIds: [
      "course-bioinformatics",
      "bioinformatics",
      "bioinformatics-frontend-seed",
    ],
  },
] as const;

/** Lookup map: any recognized alias (lowercase) -> canonical UUID */
const ALIAS_TO_CANONICAL = new Map<string, string>();

/** Lookup map: canonical UUID -> official course title */
const CANONICAL_TO_TITLE = new Map<string, string>();

// Initialize lookup maps
CANONICAL_COURSES.forEach((course) => {
  CANONICAL_TO_TITLE.set(course.canonicalId.toLowerCase(), course.title);
  ALIAS_TO_CANONICAL.set(course.canonicalId.toLowerCase(), course.canonicalId);
  ALIAS_TO_CANONICAL.set(course.slug.toLowerCase(), course.canonicalId);

  course.legacyIds.forEach((alias) => {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), course.canonicalId);
  });
});

/**
 * Normalizes any course identifier (UUID, legacy ID, slug) to its canonical UUID.
 * If the identifier is unrecognized, returns the trimmed lowercase string.
 */
export function normalizeCourseId(identifier: string | null | undefined): string {
  if (!identifier) return "";
  const key = identifier.trim().toLowerCase();
  return ALIAS_TO_CANONICAL.get(key) || key;
}

/**
 * Resolves the display title for any course identifier (UUID, legacy ID, slug).
 * If unknown, falls back to the provided fallback or the identifier itself.
 */
export function resolveCourseTitle(
  identifier: string | null | undefined,
  fallback?: string
): string {
  if (!identifier) return fallback || "—";
  const normalized = normalizeCourseId(identifier);
  const title = CANONICAL_TO_TITLE.get(normalized.toLowerCase());
  if (title) return title;
  return fallback || identifier || "—";
}

/**
 * Checks if a student's list of enrolled course IDs matches a given course,
 * taking into account legacy IDs, slugs, and canonical UUIDs.
 */
export function isStudentEnrolledInCourse(
  studentEnrolledIds: string[],
  targetCourseId: string,
  targetCourseSlug?: string
): boolean {
  if (!studentEnrolledIds || studentEnrolledIds.length === 0) return false;

  const normalizedTarget = normalizeCourseId(targetCourseId);
  const normalizedSlugTarget = targetCourseSlug
    ? normalizeCourseId(targetCourseSlug)
    : "";

  return studentEnrolledIds.some((enrolledId) => {
    const normalizedEnrolled = normalizeCourseId(enrolledId);
    return (
      normalizedEnrolled === normalizedTarget ||
      (normalizedSlugTarget !== "" && normalizedEnrolled === normalizedSlugTarget)
    );
  });
}
