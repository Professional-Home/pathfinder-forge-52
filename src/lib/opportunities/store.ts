import { supabase } from "@/utils/supabase";
import { deleteFromCloudinary } from "@/utils/cloudinary";
import type {
  Opportunity,
  OpportunityFormData,
  OpportunityFilters,
  OpportunityStatus,
} from "./types";

export function mapDbToOpportunity(db: any): Opportunity {
  return {
    id: String(db.id),
    title: db.title || "Untitled Opportunity",
    slug: db.slug || `opp-${db.id}`,
    category: db.category || "Internships",
    organization: db.organization || "",
    shortDescription: db.short_description || db.shortDescription || "",
    description: db.description || "",
    imageUrl: db.image_url || db.imageUrl || "",
    location: db.location || "",
    mode: db.mode || "Remote",
    deadline: db.deadline || null,
    startDate: db.start_date || db.startDate || null,
    endDate: db.end_date || db.endDate || null,
    eligibility: db.eligibility || "",
    requirements: db.requirements || "",
    applicationUrl: db.application_url || db.applicationUrl || "",
    tags: Array.isArray(db.tags) ? db.tags : [],
    isFeatured: Boolean(db.is_featured ?? db.isFeatured),
    status: (db.status as OpportunityStatus) || "draft",
    createdBy: db.created_by || null,
    createdAt: db.created_at || new Date().toISOString(),
    updatedAt: db.updated_at || new Date().toISOString(),
  };
}

export function mapOpportunityToDb(data: Partial<OpportunityFormData>) {
  const dbRecord: Record<string, any> = {};

  if (data.title !== undefined) dbRecord.title = data.title;
  if (data.slug !== undefined) dbRecord.slug = data.slug;
  if (data.category !== undefined) dbRecord.category = data.category;
  if (data.organization !== undefined) dbRecord.organization = data.organization;
  if (data.shortDescription !== undefined) dbRecord.short_description = data.shortDescription;
  if (data.description !== undefined) dbRecord.description = data.description;
  if (data.imageUrl !== undefined) dbRecord.image_url = data.imageUrl;
  if (data.location !== undefined) dbRecord.location = data.location;
  if (data.mode !== undefined) dbRecord.mode = data.mode;
  if (data.deadline !== undefined) dbRecord.deadline = data.deadline ? data.deadline : null;
  if (data.startDate !== undefined) dbRecord.start_date = data.startDate ? data.startDate : null;
  if (data.endDate !== undefined) dbRecord.end_date = data.endDate ? data.endDate : null;
  if (data.eligibility !== undefined) dbRecord.eligibility = data.eligibility;
  if (data.requirements !== undefined) dbRecord.requirements = data.requirements;
  if (data.applicationUrl !== undefined) dbRecord.application_url = data.applicationUrl;
  if (data.tags !== undefined) dbRecord.tags = data.tags;
  if (data.isFeatured !== undefined) dbRecord.is_featured = Boolean(data.isFeatured);
  if (data.status !== undefined) dbRecord.status = data.status;

  return dbRecord;
}

/**
 * Public Query: Fetch only published opportunities from database.
 * Never uses localStorage. Always queries Supabase public.opportunities table.
 */
export async function getPublishedOpportunities(
  filters: OpportunityFilters = {}
): Promise<Opportunity[]> {
  const { category, query, featured, limit } = filters;

  try {
    let dbQuery = supabase
      .from("opportunities")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (category && category !== "All") {
      dbQuery = dbQuery.eq("category", category);
    }

    if (featured !== undefined) {
      dbQuery = dbQuery.eq("is_featured", featured);
    }

    if (limit && limit > 0) {
      dbQuery = dbQuery.limit(limit);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("[Opportunities] Supabase query error:", error.message);
      return [];
    }

    if (!data) return [];

    let mapped = data.map(mapDbToOpportunity);

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      mapped = mapped.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.organization.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return mapped;
  } catch (err: any) {
    console.error("[Opportunities] Failed to fetch published opportunities from database:", err);
    return [];
  }
}

/**
 * Public Query: Fetch single opportunity by slug directly from database.
 * Never uses localStorage.
 */
export async function getOpportunityBySlug(slug: string): Promise<Opportunity | null> {
  if (!slug) return null;

  try {
    const { data, error } = await supabase
      .from("opportunities")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("[Opportunities] Error fetching slug from database:", error.message);
      return null;
    }

    if (!data) return null;

    return mapDbToOpportunity(data);
  } catch (err: any) {
    console.error("[Opportunities] Database query exception for slug:", err);
    return null;
  }
}

/**
 * Public Helper: Opportunities by Category (Direct from DB)
 */
export async function getOpportunitiesByCategory(category: string): Promise<Opportunity[]> {
  return getPublishedOpportunities({ category });
}

/**
 * Public Helper: Search Opportunities (Direct from DB)
 */
export async function searchOpportunities(
  query: string,
  category?: string
): Promise<Opportunity[]> {
  return getPublishedOpportunities({ query, category });
}

/**
 * Admin Query: Get all opportunities (Drafts, Published, Archived) directly from database.
 * Never uses localStorage.
 */
export async function getAllAdminOpportunities(
  statusFilter?: OpportunityStatus | "all",
  search?: string
): Promise<Opportunity[]> {
  try {
    let dbQuery = supabase
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "all") {
      dbQuery = dbQuery.eq("status", statusFilter);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("[Opportunities] Admin fetch error from database:", error.message);
      return [];
    }

    if (!data) return [];

    let mapped = data.map(mapDbToOpportunity);

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      mapped = mapped.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.organization.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return mapped;
  } catch (err: any) {
    console.error("[Opportunities] Admin query exception:", err);
    return [];
  }
}

/**
 * Admin Mutation: Create Opportunity in database.
 * Strictly writes to Supabase database. No localStorage fallback.
 */
export async function createOpportunity(
  data: OpportunityFormData
): Promise<{ opportunity?: Opportunity; error?: string }> {
  const dbRecord = mapOpportunityToDb(data);

  try {
    const { data: inserted, error } = await supabase
      .from("opportunities")
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error("[Opportunities] Supabase insert failed:", error.message);
      return { error: error.message };
    }

    if (!inserted) {
      return { error: "Failed to create opportunity in database: No record returned" };
    }

    const created = mapDbToOpportunity(inserted);
    return { opportunity: created };
  } catch (err: any) {
    console.error("[Opportunities] Create exception:", err);
    return { error: err?.message || "Failed to save to database" };
  }
}

/**
 * Admin Mutation: Update Opportunity in database.
 * Strictly updates Supabase database.
 */
export async function updateOpportunity(
  id: string,
  data: Partial<OpportunityFormData>
): Promise<{ opportunity?: Opportunity; error?: string }> {
  const dbRecord = mapOpportunityToDb(data);
  dbRecord.updated_at = new Date().toISOString();

  try {
    const { data: updated, error } = await supabase
      .from("opportunities")
      .update(dbRecord)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[Opportunities] Supabase update failed:", error.message);
      return { error: error.message };
    }

    if (!updated) {
      return { error: "Opportunity not found or no changes made in database" };
    }

    return { opportunity: mapDbToOpportunity(updated) };
  } catch (err: any) {
    console.error("[Opportunities] Update exception:", err);
    return { error: err?.message || "Failed to update opportunity in database" };
  }
}

/**
 * Remove an opportunity image from Cloudinary and clear it in the database.
 */
export async function removeOpportunityImage(
  opportunityId: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Remove from Cloudinary if URL is present
    if (imageUrl) {
      await deleteFromCloudinary(imageUrl);
    }

    // 2. Clear image_url in Supabase database
    if (opportunityId) {
      const { error } = await supabase
        .from("opportunities")
        .update({ image_url: "", updated_at: new Date().toISOString() })
        .eq("id", opportunityId);

      if (error) {
        console.error("[Opportunities] Failed to clear image_url in database:", error.message);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Opportunities] removeOpportunityImage error:", err);
    return { success: false, error: err?.message || "Failed to remove image" };
  }
}

/**
 * Admin Mutation: Publish Opportunity in database
 */
export async function publishOpportunity(id: string) {
  return updateOpportunity(id, { status: "published" });
}

/**
 * Admin Mutation: Unpublish / Draft Opportunity in database
 */
export async function unpublishOpportunity(id: string) {
  return updateOpportunity(id, { status: "draft" });
}

/**
 * Admin Mutation: Archive Opportunity in database
 */
export async function archiveOpportunity(id: string) {
  return updateOpportunity(id, { status: "archived" });
}

/**
 * Admin Mutation: Delete Opportunity permanently.
 * Removes associated image from Cloudinary, then deletes row from Supabase database.
 */
export async function deleteOpportunity(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch existing record to find associated Cloudinary image
    const { data: existing } = await supabase
      .from("opportunities")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();

    if (existing?.image_url) {
      await deleteFromCloudinary(existing.image_url);
    }

    // 2. Delete opportunity record from database
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) {
      console.error("[Opportunities] Supabase delete error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Opportunities] Delete exception:", err);
    return { success: false, error: err?.message || "Failed to delete opportunity" };
  }
}
