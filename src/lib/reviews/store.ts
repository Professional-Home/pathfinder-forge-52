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
    INITIAL_TESTIMONIALS.forEach((r) => combinedMap.set(r.id, r));
    parsed.forEach((r) => combinedMap.set(r.id, r));

    return Array.from(combinedMap.values());
  } catch (e) {
    console.error("Error reading stored reviews:", e);
    return INITIAL_TESTIMONIALS;
  }
}

/** Fetch live published reviews from Supabase table */
export async function fetchReviewsFromSupabase(): Promise<ReviewItem[]> {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .or("status.eq.published,status.is.null")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      const mapped: ReviewItem[] = data.map((db: any) => ({
        id: String(db.id),
        userId: db.user_id || "",
        userEmail: db.user_email || "",
        name: db.name || "Anonymous",
        institution: db.institution || "",
        rating: Number(db.rating) || 5,
        content: db.content || "",
        project: db.project || "Bioinformatics",
        date: db.created_at ? String(db.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
        isVerified: true,
      }));

      const map = new Map<string, ReviewItem>();
      INITIAL_TESTIMONIALS.forEach((r) => map.set(r.id, r));
      mapped.forEach((r) => map.set(r.id, r));

      const combined = Array.from(map.values());
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
      }
      return combined;
    }
  } catch (e) {
    console.warn("Supabase review fetch error, falling back to local:", e);
  }

  return getStoredReviews();
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

/** Add a new review with max 2 review limit enforcement and Supabase storage */
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
  };

  // 2. Save locally
  if (typeof window !== "undefined") {
    try {
      const current = getStoredReviews();
      const updated = [item, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Record in tracker
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

  // 3. Store in Supabase `reviews` table
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
        status: "published",
        created_at: new Date().toISOString(),
      },
    ]);

    if (dbError) {
      console.warn("[Supabase Reviews] Insert note:", dbError.message || dbError);
    }
  } catch (err) {
    console.warn("Supabase insert failed, local copy saved:", err);
  }

  return { success: true, item };
}
