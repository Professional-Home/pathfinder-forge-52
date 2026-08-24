import { supabase } from "@/utils/supabase";

export interface ReviewItem {
  id: string;
  userId?: string;
  userEmail?: string;
  name: string;
  institution?: string;
  rating: number; // 1 to 5
  content: string;
  date?: string;
  project?: string;
  isVerified?: boolean;
  status?: "published" | "approved" | "pending" | "rejected";
}

export const INITIAL_TESTIMONIALS: ReviewItem[] = [
  {
    id: "rev-1",
    name: "Sai Shrestha",
    institution: "NIT Warangal",
    rating: 5,
    project: "BioPlastic Innovation",
    date: "2026-07-15",
    content:
      "My research internship at Micrylis Biotech was an enriching and rewarding experience that strengthened my teamwork, communication, and professional networking skills. I worked on biodegradable pipette tips, gaining deep knowledge in polymers, material selection, and logical decision-making in product development.",
    status: "approved",
  },
  {
    id: "rev-2",
    name: "Riddhi Mewada",
    institution: "DBT, VNSGU",
    rating: 5,
    project: "Biotech Market Research",
    date: "2026-07-28",
    content:
      "Interning at Micrylis Biotech was a truly rewarding experience. I led on-ground market research engaging with laboratories and studied CPCB biomedical waste management reports across multiple states to identify real-world business and environmental opportunities.",
    status: "approved",
  },
  {
    id: "rev-3",
    name: "Minal Mahesh Patil",
    institution: "Biotech Scholar",
    rating: 5,
    project: "MCT Tube R&D",
    date: "2026-08-02",
    content:
      "I worked on the research and development of MCT tubes, gaining hands-on experience in scientific analysis, technical documentation, and product development. Working with such an encouraging team enhanced my technical skills and confidence.",
    status: "approved",
  },
  {
    id: "rev-4",
    name: "Sareema Hasan",
    institution: "Life Sciences Student",
    rating: 5,
    project: "Biodegradable Petri Plates",
    date: "2026-08-10",
    content:
      "My internship at Micrylis Biotech was an enriching experience. I had the opportunity to work on the development and scientific analysis of semi-biodegradable Petri plates, strengthening my research, analytical, and report-writing skills.",
    status: "approved",
  },
  {
    id: "rev-5",
    name: "Dr. Aarav Mehta",
    institution: "IIT Bombay",
    rating: 5,
    project: "Bioinformatics & NGS Platform",
    date: "2026-08-14",
    content:
      "The AI-integrated Bioinformatics research project gave me hands-on exposure to Next-Gen Sequencing data analysis, variant calling, and biomarker discovery. The structured research-to-POC approach is unparalleled.",
    status: "approved",
  },
  {
    id: "rev-6",
    name: "Kavya Nair",
    institution: "Delhi University",
    rating: 5,
    project: "AI in Drug Discovery",
    date: "2026-08-18",
    content:
      "An extraordinary 30-day research journey. From target identification to molecular docking, virtual screening, and AI predictive models, this project helped me build a real research portfolio for higher studies.",
    status: "approved",
  },
];

const STORAGE_KEY = "micrylis_user_reviews_v1";
const TRACKER_KEY = "micrylis_submitted_reviews_tracker_v1";

export function getStoredReviews(): ReviewItem[] {
  if (typeof window === "undefined") return INITIAL_TESTIMONIALS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_TESTIMONIALS;
    const parsed: ReviewItem[] = JSON.parse(raw);

    const combinedMap = new Map<string, ReviewItem>();
    INITIAL_TESTIMONIALS.forEach((r) =>
      combinedMap.set(r.id, { ...r, status: r.status || "approved" })
    );
    parsed.forEach((r) => combinedMap.set(r.id, r));

    return Array.from(combinedMap.values());
  } catch (e) {
    console.error("Error reading stored reviews:", e);
    return INITIAL_TESTIMONIALS;
  }
}

/** Fetch live approved & published reviews from Supabase table & local storage for main page */
export async function fetchReviewsFromSupabase(): Promise<ReviewItem[]> {
  const localList = getStoredReviews().filter(
    (r) => r.status === "approved" || r.status === "published" || !r.status
  );

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .or("status.eq.published,status.eq.approved,status.is.null")
      .order("created_at", { ascending: false });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const mapped: ReviewItem[] = data.map((db: any) => ({
        id: String(db.id),
        userId: db.user_id || "",
        userEmail: db.user_email || "",
        name: db.name || "Anonymous",
        institution: db.institution || "",
        rating: Number(db.rating) || 5,
        content: db.content || "",
        project: db.project || "Bioinformatics",
        status: db.status || "approved",
        date: db.created_at ? String(db.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        isVerified: true,
      }));

      const map = new Map<string, ReviewItem>();
      localList.forEach((r) => map.set(r.id, r));
      mapped.forEach((r) => map.set(r.id, r));

      return Array.from(map.values());
    }
  } catch (e) {
    console.warn("Supabase review fetch error, falling back to local:", e);
  }

  return localList;
}

/** Filter to strictly return 5-star ratings for display in testimonial cards */
export function getOnly5StarReviews(reviews: ReviewItem[]): ReviewItem[] {
  return reviews.filter((r) => r.rating === 5);
}

/** Check if user can submit a review (max 2 reviews limit per user) */
export async function checkUserCanSubmitReview(
  userEmail?: string,
  userId?: string
): Promise<{ allowed: boolean; count: number; message?: string }> {
  let count = 0;

  // 1. Check local tracker
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(TRACKER_KEY);
      if (raw) {
        const trackerList: Array<{ email?: string; userId?: string; id: string }> = JSON.parse(raw);
        if (userId) {
          count = trackerList.filter((item) => item.userId === userId).length;
        } else if (userEmail) {
          count = trackerList.filter(
            (item) => item.email?.toLowerCase() === userEmail.toLowerCase()
          ).length;
        } else {
          count = trackerList.length;
        }
      }
    } catch {
      // fallback
    }
  }

  // 2. Query Supabase table for user's previous reviews
  try {
    let query = supabase.from("reviews").select("id", { count: "exact" });

    if (userId && userId.trim()) {
      query = query.eq("user_id", userId.trim());
    } else if (userEmail && userEmail.trim()) {
      query = query.eq("user_email", userEmail.trim().toLowerCase());
    }

    if (userId || userEmail) {
      const { count: dbCount, error } = await query;
      if (!error && typeof dbCount === "number") {
        count = Math.max(count, dbCount);
      }
    }
  } catch (err) {
    console.warn("Error checking review count from Supabase:", err);
  }

  const MAX_REVIEWS_PER_USER = 2;
  const allowed = count < MAX_REVIEWS_PER_USER;

  return {
    allowed,
    count,
    message: !allowed
      ? `You have reached the maximum limit of ${MAX_REVIEWS_PER_USER} reviews per user.`
      : undefined,
  };
}

/** Add a new review with status='pending' requiring admin approval */
export async function addReview(newReview: {
  name: string;
  institution?: string;
  rating: number;
  content: string;
  project?: string;
  userId?: string;
  userEmail?: string;
}): Promise<{ success: boolean; item?: ReviewItem; error?: string }> {
  // 1. Enforce Max 2 Reviews Limit
  const limitCheck = await checkUserCanSubmitReview(newReview.userEmail, newReview.userId);
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: limitCheck.message || "You have reached the maximum limit of 2 reviews per user.",
    };
  }

  const id = `rev-${Date.now()}`;
  const item: ReviewItem = {
    id,
    userId: newReview.userId || "",
    userEmail: newReview.userEmail || "",
    name: newReview.name,
    institution: newReview.institution || "",
    rating: newReview.rating,
    content: newReview.content,
    project: newReview.project || "Bioinformatics",
    date: new Date().toISOString().slice(0, 10),
    isVerified: true,
    status: "pending",
  };

  // 2. Save locally in STORAGE_KEY and TRACKER_KEY so review is immediately accessible in Admin Panel
  if (typeof window !== "undefined") {
    try {
      const current = getStoredReviews();
      const updated = [item, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      const trackerRaw = localStorage.getItem(TRACKER_KEY);
      const trackerList: Array<{ email?: string; userId?: string; id: string }> = trackerRaw
        ? JSON.parse(trackerRaw)
        : [];
      trackerList.push({
        email: newReview.userEmail?.toLowerCase() || newReview.name.toLowerCase(),
        userId: newReview.userId,
        id,
      });
      localStorage.setItem(TRACKER_KEY, JSON.stringify(trackerList));
    } catch (e) {
      console.error("Error saving review to local storage:", e);
    }
  }

  // 3. Store in Supabase `reviews` table with status 'pending'
  try {
    const { error: dbError } = await supabase.from("reviews").insert([
      {
        id: item.id,
        user_id: item.userId || null,
        user_email: item.userEmail || null,
        name: item.name,
        institution: item.institution || "",
        rating: item.rating,
        content: item.content,
        project: item.project || "Bioinformatics",
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);

    if (dbError) {
      console.warn("[Supabase Reviews] Insert note:", dbError.message || dbError);
    }
  } catch (err) {
    console.warn("Supabase insert failed, local copy retained:", err);
  }

  return { success: true, item };
}

/** Fetch all reviews for Admin Panel (combining local storage, seed items, and Supabase) */
export async function fetchAllReviewsAdmin(): Promise<ReviewItem[]> {
  const localReviews = getStoredReviews();
  const seedMapped: ReviewItem[] = INITIAL_TESTIMONIALS.map((r) => ({
    ...r,
    status: "approved" as const,
  }));

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data && Array.isArray(data)) {
      const dbMapped: ReviewItem[] = data.map((db: any) => ({
        id: String(db.id),
        userId: db.user_id || "",
        userEmail: db.user_email || "",
        name: db.name || "Anonymous",
        institution: db.institution || "",
        rating: Number(db.rating) || 5,
        content: db.content || "",
        project: db.project || "Bioinformatics",
        status: (db.status as any) || "pending",
        date: db.created_at ? String(db.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        isVerified: true,
      }));

      const map = new Map<string, ReviewItem>();
      seedMapped.forEach((r) => map.set(r.id, r));
      localReviews.forEach((r) => map.set(r.id, { ...r, status: r.status || "pending" }));
      dbMapped.forEach((r) => map.set(r.id, r));

      return Array.from(map.values());
    }
  } catch (err) {
    console.error("fetchAllReviewsAdmin error:", err);
  }

  const map = new Map<string, ReviewItem>();
  seedMapped.forEach((r) => map.set(r.id, r));
  localReviews.forEach((r) => map.set(r.id, { ...r, status: r.status || "pending" }));
  return Array.from(map.values());
}

/** Update review approval status in Supabase table and LocalStorage */
export async function updateReviewStatus(
  id: string,
  status: "approved" | "published" | "rejected" | "pending"
): Promise<{ success: boolean; error?: string }> {
  // 1. Update in LocalStorage if present
  if (typeof window !== "undefined") {
    try {
      const stored = getStoredReviews();
      const updated = stored.map((r) => (r.id === id ? { ...r, status } : r));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("LocalStorage update error:", e);
    }
  }

  // 2. Update in Supabase
  try {
    const { error } = await supabase
      .from("reviews")
      .update({ status })
      .eq("id", id);

    if (error) {
      const localOrSeed = getStoredReviews().find((r) => r.id === id);
      if (localOrSeed) {
        await supabase.from("reviews").insert([
          {
            id: localOrSeed.id,
            user_id: localOrSeed.userId || null,
            user_email: localOrSeed.userEmail || null,
            name: localOrSeed.name,
            institution: localOrSeed.institution || "",
            rating: localOrSeed.rating,
            content: localOrSeed.content,
            project: localOrSeed.project || "Bioinformatics",
            status,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

/** Delete a review permanently from Supabase table and LocalStorage */
export async function deleteReviewAdmin(id: string): Promise<{ success: boolean; error?: string }> {
  // 1. Remove from local storage
  if (typeof window !== "undefined") {
    try {
      const stored = getStoredReviews();
      const updated = stored.filter((r) => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  // 2. Remove from Supabase
  try {
    await supabase.from("reviews").delete().eq("id", id);
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}
