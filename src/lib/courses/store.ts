import { SEED_COURSES } from "./data";
import type { CourseFormData, CourseRecord, CourseSortOption } from "./types";

const STORAGE_KEY = "micrylis-course-records";

function syncSeedMedia(courses: CourseRecord[]): CourseRecord[] {
  let changed = false;
  const synced = courses.map((course) => {
    const seed = SEED_COURSES.find((s) => s.id === course.id);
    if (!seed) return course;

    const needsThumbnail = course.thumbnail !== seed.thumbnail;
    const needsCover = course.coverImage !== seed.coverImage;
    const needsHeroCover = course.content.hero.coverImage !== seed.content.hero.coverImage;

    if (!needsThumbnail && !needsCover && !needsHeroCover) return course;

    changed = true;
    return {
      ...course,
      thumbnail: seed.thumbnail,
      coverImage: seed.coverImage,
      content: {
        ...course.content,
        hero: {
          ...course.content.hero,
          coverImage: seed.content.hero.coverImage,
        },
      },
    };
  });

  if (changed) writeStorage(synced);
  return synced;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readStorage(): CourseRecord[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CourseRecord[];
  } catch {
    return null;
  }
}

function writeStorage(courses: CourseRecord[]) {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

export function initializeCourseStore(): CourseRecord[] {
  const existing = readStorage();
  if (existing && existing.length > 0) return syncSeedMedia(existing);
  writeStorage(SEED_COURSES);
  return SEED_COURSES;
}

export function getAllCourses(): CourseRecord[] {
  const courses = readStorage() ?? SEED_COURSES;
  return syncSeedMedia(courses);
}

export function getCourseById(id: string): CourseRecord | undefined {
  return getAllCourses().find((c) => c.id === id);
}

export function getCourseBySlug(slug: string): CourseRecord | undefined {
  return getAllCourses().find((c) => c.slug === slug);
}

export function saveCourse(data: CourseFormData, id?: string): CourseRecord {
  const courses = getAllCourses();
  const now = new Date().toISOString().slice(0, 10);

  if (id) {
    const index = courses.findIndex((c) => c.id === id);
    if (index >= 0) {
      const updated: CourseRecord = { ...data, id, lastUpdated: now };
      courses[index] = updated;
      writeStorage(courses);
      return updated;
    }
  }

  const newCourse: CourseRecord = {
    ...data,
    id: `course-${Date.now()}`,
    lastUpdated: now,
  };
  courses.unshift(newCourse);
  writeStorage(courses);
  return newCourse;
}

export function deleteCourse(id: string): boolean {
  const courses = getAllCourses();
  const filtered = courses.filter((c) => c.id !== id);
  if (filtered.length === courses.length) return false;
  writeStorage(filtered);
  return true;
}

export function duplicateCourse(id: string): CourseRecord | null {
  const original = getCourseById(id);
  if (!original) return null;

  const copy: CourseRecord = {
    ...structuredClone(original),
    id: `course-${Date.now()}`,
    name: `${original.name} (Copy)`,
    slug: `${original.slug}-copy-${Date.now()}`,
    status: "draft",
    featured: false,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  const courses = getAllCourses();
  courses.unshift(copy);
  writeStorage(courses);
  return copy;
}

export function toggleCourseStatus(id: string): CourseRecord | null {
  const courses = getAllCourses();
  const index = courses.findIndex((c) => c.id === id);
  if (index < 0) return null;

  courses[index] = {
    ...courses[index],
    status: courses[index].status === "published" ? "draft" : "published",
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
  writeStorage(courses);
  return courses[index];
}

export function filterAndSortCourses(
  courses: CourseRecord[],
  options: {
    search?: string;
    status?: string;
    category?: string;
    sort?: CourseSortOption;
  },
): CourseRecord[] {
  let result = [...courses];

  if (options.search) {
    const q = options.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortDescription.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q),
    );
  }

  if (options.status && options.status !== "all") {
    result = result.filter((c) => c.status === options.status);
  }

  if (options.category && options.category !== "all") {
    result = result.filter((c) => c.category === options.category);
  }

  switch (options.sort) {
    case "name-asc":
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "updated-asc":
      result.sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated));
      break;
    case "fee-asc":
      result.sort(
        (a, b) =>
          parseInt(a.programFee.replace(/\D/g, ""), 10) -
          parseInt(b.programFee.replace(/\D/g, ""), 10),
      );
      break;
    case "fee-desc":
      result.sort(
        (a, b) =>
          parseInt(b.programFee.replace(/\D/g, ""), 10) -
          parseInt(a.programFee.replace(/\D/g, ""), 10),
      );
      break;
    case "updated-desc":
    default:
      result.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
      break;
  }

  return result;
}

export function resetCourseStore() {
  if (!isBrowser()) return;
  writeStorage(SEED_COURSES);
}

export function courseToFormData(course: CourseRecord): CourseFormData {
  const { id: _id, lastUpdated: _lastUpdated, ...form } = course;
  return form;
}

export function createEmptyCourseForm(): CourseFormData {
  return {
    slug: "",
    name: "",
    shortDescription: "",
    fullDescription: "",
    thumbnail: "",
    coverImage: "",
    duration: "30 Days",
    mode: "Online",
    programFee: "₹1999",
    category: "",
    difficulty: "intermediate",
    certificate: "",
    learningOutcomes: [],
    curriculum: "",
    requirements: "",
    whoShouldJoin: "",
    faqs: "",
    seoTitle: "",
    seoDescription: "",
    featured: false,
    status: "draft",
    content: SEED_COURSES[0].content,
  };
}
