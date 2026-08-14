import type { CourseFormData, CourseRecord, CourseSortOption } from "./types";
import { supabase } from "@/utils/supabase";

const STORAGE_KEY = "micrylis-course-records";

function syncSeedMedia(courses: CourseRecord[]): CourseRecord[] {
  return courses;
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
  return existing || [];
}

export function getAllCourses(): CourseRecord[] {
  const courses = readStorage() ?? [];
  return syncSeedMedia(courses);
}

export function getCourseById(id: string): CourseRecord | undefined {
  return getAllCourses().find((c) => c.id === id);
}

export function getCourseBySlug(slug: string): CourseRecord | undefined {
  return getAllCourses().find((c) => c.slug === slug);
}

/** Lightweight columns for listing pages — excludes heavy text fields */
const LISTING_COLUMNS = "id, slug, title, short_description, thumbnail, cover_image, category, duration, mode, program_fee, difficulty, featured, status, apply_url, updated_at";

/** Lightweight course shape for listing/card views */
export interface CourseListingItem {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  thumbnail: string;
  category: string;
  duration: string;
  mode: string;
  programFee: string;
  difficulty: string;
  featured: boolean;
  status: string;
  applyUrl: string;
  lastUpdated: string;
}

function mapDbToListing(db: any): CourseListingItem {
  const defaultImage = (db.slug || db.title || "")?.toLowerCase().includes("drug")
    ? "/Photos/ai-drug-discovery-card.jpg"
    : "/Photos/bioplastic-card.jpg";

  return {
    id: String(db.id || db.slug),
    slug: db.slug || "course-slug",
    name: db.title || db.name || "Untitled Course",
    shortDescription: db.short_description || db.shortDescription || "",
    thumbnail: db.thumbnail || db.cover_image || db.coverImage || defaultImage,
    category: db.category || "Biotechnology",
    duration: db.duration || "30 Days",
    mode: db.mode || "Online",
    programFee: db.program_fee || db.programFee || "₹1999",
    difficulty: db.difficulty || "intermediate",
    featured: db.featured ?? true,
    status: db.status || "published",
    applyUrl: db.apply_url || db.applyUrl || "",
    lastUpdated: db.updated_at ? String(db.updated_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

/** Fetch lightweight listing data — only fields needed for cards/tables */
export async function fetchCoursesListing(options?: {
  status?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
  page?: number;
}): Promise<{ courses: CourseListingItem[]; total: number }> {
  try {
    let query = supabase
      .from("courses")
      .select(LISTING_COLUMNS, { count: "exact" });

    if (options?.status && options.status !== "all") {
      if (options.status === "published") {
        query = query.or("status.eq.published,status.is.null");
      } else {
        query = query.eq("status", options.status);
      }
    }
    if (options?.category && options.category !== "all") {
      query = query.eq("category", options.category);
    }
    if (options?.featured !== undefined) {
      query = query.eq("featured", options.featured);
    }

    query = query.order("updated_at", { ascending: false });

    const limit = Math.min(options?.limit || 24, 24);
    const page = Math.max(options?.page || 1, 1);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (!error && data && data.length > 0) {
      return {
        courses: data.map(mapDbToListing),
        total: count ?? data.length,
      };
    }
  } catch (err) {
    console.error("Error fetching courses listing from Supabase:", err);
  }

  // Fallback to local store / seed courses if Supabase returns 0 rows or errors
  let localCourses = getAllCourses();
  if (options?.status && options.status !== "all") {
    localCourses = localCourses.filter((c) =>
      options.status === "published"
        ? c.status === "published" || !c.status
        : c.status === options.status
    );
  }
  if (options?.category && options.category !== "all") {
    localCourses = localCourses.filter((c) => c.category === options.category);
  }
  if (options?.featured !== undefined) {
    localCourses = localCourses.filter((c) => c.featured === options.featured);
  }

  const mappedLocal: CourseListingItem[] = localCourses.map((c) => {
    const defaultImage = (c.slug || c.name || "")?.toLowerCase().includes("drug")
      ? "/Photos/ai-drug-discovery-card.jpg"
      : "/Photos/bioplastic-card.jpg";

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      shortDescription: c.shortDescription,
      thumbnail: c.thumbnail || c.coverImage || defaultImage,
      category: c.category,
      duration: c.duration,
      mode: c.mode,
      programFee: c.programFee,
      difficulty: c.difficulty,
      featured: c.featured,
      status: c.status || "published",
      applyUrl: c.applyUrl || "",
      lastUpdated: c.lastUpdated,
    };
  });

  return {
    courses: mappedLocal,
    total: mappedLocal.length,
  };
}

/** Fetch a single course by slug — full data for detail pages */
export async function fetchCourseBySlug(slug: string): Promise<CourseRecord | null> {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (data && (!data.status || data.status === "published")) {
      return mapDbToFull(data);
    }
  } catch (err) {
    console.error("Error fetching course by slug from Supabase:", err);
  }

  return getCourseBySlug(slug) || null;
}

/** Fetch a single course by id — full data for edit/enrollment */
export async function fetchCourseById(id: string): Promise<CourseRecord | null> {
  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .or(`id.eq.${id},slug.eq.${id}`)
      .maybeSingle();

    if (data) return mapDbToFull(data);
  } catch (err) {
    console.error("Error fetching course by id from Supabase:", err);
  }

  return getCourseById(id) || null;
}

function mapDbToFull(db: any): CourseRecord {
  const defaultImage = (db.slug || db.title || "")?.toLowerCase().includes("drug")
    ? "/Photos/ai-drug-discovery-card.jpg"
    : "/Photos/bioplastic-card.jpg";

  const defaultHero = (db.slug || db.title || "")?.toLowerCase().includes("drug")
    ? "/Photos/ai-drug-discovery-hero.jpg"
    : "/Photos/bioplastic-hero.jpg";

  return {
    id: String(db.id || db.slug),
    slug: db.slug || "course-slug",
    name: db.title || db.name || "Untitled Course",
    shortDescription: db.short_description || db.shortDescription || "",
    fullDescription: db.full_description || db.fullDescription || "",
    thumbnail: db.thumbnail || db.cover_image || db.coverImage || defaultImage,
    coverImage: db.cover_image || db.coverImage || db.thumbnail || defaultHero,
    duration: db.duration || "30 Days",
    mode: db.mode || "Online",
    programFee: db.program_fee || db.programFee || "₹1999",
    category: db.category || "Biotechnology",
    difficulty: db.difficulty || "intermediate",
    certificate: db.certificate || "Certificate of Completion",
    learningOutcomes: db.learning_outcomes || [],
    curriculum: db.curriculum || "",
    requirements: db.requirements || "",
    whoShouldJoin: db.who_should_join || "",
    faqs: db.faqs || "",
    seoTitle: db.seo_title || db.title || "",
    seoDescription: db.seo_description || db.short_description || "",
    featured: db.featured ?? true,
    status: db.status || "published",
    lastUpdated: db.updated_at ? String(db.updated_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    applyUrl: db.apply_url || db.applyUrl || "",
  };
}

export async function fetchCoursesFromSupabase(): Promise<CourseRecord[]> {
  try {
    const { data: dbCourses, error } = await supabase.from("courses").select("*");
    if (error || !dbCourses) {
      return getAllCourses();
    }

    const dbMapped: CourseRecord[] = dbCourses.map(mapDbToFull);

    writeStorage(dbMapped);
    return dbMapped;
  } catch (err) {
    console.error("Error fetching courses from Supabase:", err);
    return getAllCourses();
  }
}

async function syncCourseToSupabase(course: CourseRecord) {
  try {
    const { error } = await supabase.from("courses").upsert(
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
    if (error) {
      console.error("[Supabase Store] Failed to sync course:", error.message || error);
    }
  } catch (e) {
    console.warn("[Store] Supabase sync note:", e);
  }
}

export async function saveCourse(data: CourseFormData, id?: string): Promise<CourseRecord> {
  const courses = getAllCourses();
  const now = new Date().toISOString().slice(0, 10);

  let targetCourse: CourseRecord;

  if (id) {
    const index = courses.findIndex((c) => c.id === id);
    if (index >= 0) {
      targetCourse = { ...data, id, lastUpdated: now };
      courses[index] = targetCourse;
      writeStorage(courses);
      await syncCourseToSupabase(targetCourse);
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
  await syncCourseToSupabase(targetCourse);
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
  writeStorage([]);
}

export function clearLocalCourseStore() {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
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
    featured: true,
    status: "published",
  };
}
