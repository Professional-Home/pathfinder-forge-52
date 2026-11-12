/**
 * IELTS Store - Data operations for IELTS applications and mentors
 */

import { supabase } from "@/utils/supabase";
import type {
  IELTSMentor,
  IELTSApplication,
  IELTSApplicationFormData,
  IELTSMentorFormData,
  IELTSApplyResult,
} from "./types";

/**
 * Submit an IELTS application (public route - no auth required)
 * After saving, returns the Google Form URL for redirect
 */
export async function submitIELTSApplication(
  data: IELTSApplicationFormData
): Promise<IELTSApplyResult> {
  try {
    const { data: result, error } = await supabase
      .from("ielts_applications")
      .insert([
        {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          country: data.country,
          current_level: data.current_level,
          target_band_score: data.target_band_score,
          preferred_batch: data.preferred_batch,
          message: data.message || "",
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[IELTS] Application insert error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      applicationId: result.id,
      googleFormUrl: `https://forms.gle/ielts-application-form?entry=application_${result.id}`,
    };
  } catch (err: any) {
    console.error("[IELTS] Application error:", err);
    return { success: false, error: err.message || "Failed to submit application" };
  }
}

/**
 * Fetch all IELTS applications (admin use)
 */
export async function fetchIELTSApplications(): Promise<IELTSApplication[]> {
  try {
    const { data, error } = await supabase
      .from("ielts_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[IELTS] Fetch applications error:", error);
      return [];
    }

    return (data || []) as IELTSApplication[];
  } catch (err: any) {
    console.error("[IELTS] Fetch applications error:", err);
    return [];
  }
}

/**
 * Fetch a single IELTS application by ID
 */
export async function fetchIELTSApplicationById(
  id: string
): Promise<IELTSApplication | null> {
  try {
    const { data, error } = await supabase
      .from("ielts_applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[IELTS] Fetch application error:", error);
      return null;
    }

    return (data || null) as IELTSApplication;
  } catch (err: any) {
    console.error("[IELTS] Fetch application error:", err);
    return null;
  }
}

/**
 * Update application status (admin use)
 */
export async function updateIELTSApplicationStatus(
  id: string,
  status: "pending" | "contacted" | "enrolled" | "rejected",
  mentorId?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("ielts_applications")
      .update({
        status,
        mentor_id: mentorId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[IELTS] Update status error:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("[IELTS] Update status error:", err);
    return false;
  }
}

/**
 * Fetch all IELTS mentors (public - active only)
 */
export async function fetchIELTSMentors(): Promise<IELTSMentor[]> {
  try {
    const { data, error } = await supabase
      .from("ielts_mentors")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[IELTS] Fetch mentors error:", error);
      return [];
    }

    return (data || []) as IELTSMentor[];
  } catch (err: any) {
    console.error("[IELTS] Fetch mentors error:", err);
    return [];
  }
}

/**
 * Fetch all IELTS mentors including inactive (admin use)
 */
export async function fetchAllIELTSMentorsAdmin(): Promise<IELTSMentor[]> {
  try {
    const { data, error } = await supabase
      .from("ielts_mentors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[IELTS] Fetch all mentors error:", error);
      return [];
    }

    return (data || []) as IELTSMentor[];
  } catch (err: any) {
    console.error("[IELTS] Fetch all mentors error:", err);
    return [];
  }
}

/**
 * Create a new IELTS mentor (admin use)
 */
export async function createIELTSMentor(
  data: IELTSMentorFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("ielts_mentors").insert([
      {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        expertise: data.expertise,
        experience_years: data.experience_years,
        qualification: data.qualification || null,
        bio: data.bio || null,
        avatar_url: data.avatar_url || null,
        is_active: data.is_active,
        hourly_rate: data.hourly_rate || null,
      },
    ]);

    if (error) {
      console.error("[IELTS] Create mentor error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[IELTS] Create mentor error:", err);
    return { success: false, error: err.message || "Failed to create mentor" };
  }
}

/**
 * Update an IELTS mentor (admin use)
 */
export async function updateIELTSMentor(
  id: string,
  data: Partial<IELTSMentorFormData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("ielts_mentors")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[IELTS] Update mentor error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[IELTS] Update mentor error:", err);
    return { success: false, error: err.message || "Failed to update mentor" };
  }
}

/**
 * Delete an IELTS mentor (admin use)
 */
export async function deleteIELTSMentor(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("ielts_mentors").delete().eq("id", id);

    if (error) {
      console.error("[IELTS] Delete mentor error:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("[IELTS] Delete mentor error:", err);
    return false;
  }
}

/**
 * Toggle mentor active status (admin use)
 */
export async function toggleIELTSMentorStatus(
  id: string,
  isActive: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("ielts_mentors")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[IELTS] Toggle mentor error:", error);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("[IELTS] Toggle mentor error:", err);
    return false;
  }
}
