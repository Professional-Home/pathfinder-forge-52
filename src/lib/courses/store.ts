import { SEED_COURSES } from "./data";
import type { CourseFormData, CourseRecord, CourseSortOption } from "./types";
import { supabase } from "@/utils/supabase";

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

export async function fetchCoursesFromSupabase(): Promise<CourseRecord[]> {
  try {
    const { data: dbCourses, error } = await supabase.from("courses").select("*");
    if (error || !dbCourses || dbCourses.length === 0) {
      return getAllCourses();
    }

    const dbMapped: CourseRecord[] = dbCourses.map((db) => {
      const seed = SEED_COURSES.find(
        (s) => s.slug.toLowerCase() === (db.slug || "").toLowerCase() || s.id === String(db.id)
      );
      return {
        id: String(db.id || db.slug),
        slug: db.slug || seed?.slug || "course-slug",
        name: db.title || db.name || seed?.name || "Untitled Course",
        shortDescription: db.short_description || db.shortDescription || seed?.shortDescription || "",
        fullDescription: db.full_description || db.fullDescription || seed?.fullDescription || "",
        thumbnail: db.thumbnail || seed?.thumbnail || "",
        coverImage: db.cover_image || db.coverImage || seed?.coverImage || "",
        duration: db.duration || seed?.duration || "30 Days",
        mode: db.mode || seed?.mode || "Online",
        programFee: db.program_fee || db.programFee || seed?.programFee || "₹1999",
        category: db.category || seed?.category || "Biotechnology",
        difficulty: db.difficulty || seed?.difficulty || "intermediate",
        certificate: db.certificate || seed?.certificate || "Certificate of Completion",
        learningOutcomes: db.learning_outcomes || seed?.learningOutcomes || [],
        curriculum: db.curriculum || seed?.curriculum || "",
        requirements: db.requirements || seed?.requirements || "",
        whoShouldJoin: db.who_should_join || seed?.whoShouldJoin || "",
        faqs: db.faqs || seed?.faqs || "",
        seoTitle: db.seo_title || seed?.seoTitle || db.title || "",
        seoDescription: db.seo_description || seed?.seoDescription || db.short_description || "",
        featured: db.featured ?? seed?.featured ?? true,
        status: db.status || seed?.status || "published",
        lastUpdated: db.updated_at ? String(db.updated_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        applyUrl: db.apply_url || db.applyUrl || seed?.applyUrl || "",
        content: seed?.content || SEED_COURSES[0].content,
      };
    });

    const dbSlugs = new Set(dbMapped.map((c) => c.slug.toLowerCase()));
    const finalCourses = [...dbMapped];

    for (const seed of SEED_COURSES) {
      if (!dbSlugs.has(seed.slug.toLowerCase())) {
        finalCourses.push(seed);
      }
    }

    writeStorage(finalCourses);
    return finalCourses;
  } catch (err) {
    console.error("Error fetching courses from Supabase:", err);
    return getAllCourses();
  }
}

async function syncCourseToSupabase(course: CourseRecord) {
  try {
    await supabase.from("courses").upsert(
      {
        slug: course.slug,
        title: course.name,
        short_description: course.shortDescription,
        full_description: course.fullDescription,
        thumbnail: course.thumbnail,
        cover_image: course.coverImage,
        duration: course.duration,
        mode: course.mode,
        program_fee: course.programFee,
        category: course.category,
        difficulty: course.difficulty,
        certificate: course.certificate,
        status: course.status,
        featured: course.featured,
        apply_url: course.applyUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    );
  } catch (e) {
    console.warn("[Store] Supabase sync note:", e);
  }
}

export function saveCourse(data: CourseFormData, id?: string): CourseRecord {
  const courses = getAllCourses();
  const now = new Date().toISOString().slice(0, 10);

  let targetCourse: CourseRecord;

  if (id) {
    const index = courses.findIndex((c) => c.id === id);
    if (index >= 0) {
      targetCourse = { ...data, id, lastUpdated: now };
      courses[index] = targetCourse;
      writeStorage(courses);
      syncCourseToSupabase(targetCourse);
      return targetCourse;
    }
  }

  targetCourse = {
    ...data,
    id: `course-${Date.now()}`,
    lastUpdated: now,
  };
  courses.unshift(targetCourse);
  writeStorage(courses);
  syncCourseToSupabase(targetCourse);
  return targetCourse;
}

export function deleteCourse(id: string): boolean {
  const courses = getAllCourses();
  const target = courses.find((c) => c.id === id);
  const filtered = courses.filter((c) => c.id !== id);
  if (filtered.length === courses.length) return false;
  writeStorage(filtered);

  if (target) {
    supabase.from("courses").delete().or(`slug.eq.${target.slug},id.eq.${id}`).then();
  }
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
  syncCourseToSupabase(copy);
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
  syncCourseToSupabase(courses[index]);
  return courses[index];
}

export async function deleteCourseAsync(id: string): Promise<boolean> {
  const courses = getAllCourses();
  const target = courses.find((c) => c.id === id);

  deleteCourse(id);

  if (target) {
    try {
      await supabase.from("courses").delete().or(`slug.eq.${target.slug},id.eq.${id}`);
    } catch (e) {
      console.error("Supabase delete failed:", e);
    }
  }
  return true;
}

export async function toggleCourseStatusAsync(id: string): Promise<CourseRecord | null> {
  const updated = toggleCourseStatus(id);
  if (updated) {
    try {
      await supabase
        .from("courses")
        .update({ status: updated.status, updated_at: new Date().toISOString() })
        .or(`slug.eq.${updated.slug},id.eq.${id}`);
    } catch (e) {
      console.error("Supabase status toggle failed:", e);
    }
  }
  return updated;
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
