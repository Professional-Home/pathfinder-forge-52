import { supabase } from "@/utils/supabase";
import { type WebinarItem, type WebinarFormData, getCalculatedWebinarStatus, safeParseDate } from "./types";

function mapDbToWebinar(db: any): WebinarItem {
  const rawStart = db.start_date_time || db.startDateTime;
  const rawEnd = db.end_date_time || db.endDateTime;

  const startD = safeParseDate(rawStart);
  const endD = safeParseDate(rawEnd);

  const start = startD ? startD.toISOString() : new Date().toISOString();
  const end = endD ? endD.toISOString() : new Date().toISOString();

  return {
    id: String(db.id),
    title: db.title || "Untitled Webinar",
    description: db.description || "",
    topic: db.topic || "Biotechnology",
    speakerName: db.speaker_name || db.speakerName || "Micrylis Mentor",
    speakerDesignation: db.speaker_designation || db.speakerDesignation || "Biotech Specialist",
    speakerImage: db.speaker_image || db.speakerImage || "",
    startDateTime: start,
    endDateTime: end,
    timezone: db.timezone || "IST (GMT+5:30)",
    registrationUrl: db.registration_url || db.registrationUrl || "",
    joinUrl: db.join_url || db.joinUrl || "",
    recordingUrl: db.recording_url || db.recordingUrl || "",
    thumbnail: db.thumbnail || "",
    status: getCalculatedWebinarStatus(start, end),
    isPublished: db.is_published ?? db.isPublished ?? false,
    createdAt: db.created_at || new Date().toISOString(),
    updatedAt: db.updated_at || new Date().toISOString(),
  };
}

/**
 * Fetch all webinars from Supabase. Status is always recalculated from the current time.
 * @param includeUnpublished If true, returns all webinars including unpublished (admin view)
 */
export async function fetchWebinars(includeUnpublished = false): Promise<WebinarItem[]> {
  try {
    let query = supabase.from("webinars").select("*").order("start_date_time", { ascending: true });
    if (!includeUnpublished) {
      query = query.eq("is_published", true);
    }

    const { data, error } = await query;
    if (!error && data) {
      return data.map(mapDbToWebinar);
    }
    console.warn("[Webinar Store] Fetch error:", error);
  } catch (e) {
    console.warn("[Webinar Store] Fetch error from Supabase:", e);
  }

  return [];
}

/**
 * Fetch a single webinar by its UUID
 */
export async function fetchWebinarById(id: string): Promise<WebinarItem | null> {
  try {
    const { data, error } = await supabase
      .from("webinars")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return mapDbToWebinar(data);
    }
  } catch (e) {
    console.warn("[Webinar Store] Error fetching webinar by id:", e);
  }
  return null;
}

/**
 * Create or update a webinar in Supabase.
 */
export async function saveWebinar(formData: WebinarFormData, existingId?: string): Promise<WebinarItem> {
  const now = new Date().toISOString();

  const startD = safeParseDate(formData.startDateTime);
  const endD = safeParseDate(formData.endDateTime);
  const startIso = startD ? startD.toISOString() : formData.startDateTime;
  const endIso = endD ? endD.toISOString() : formData.endDateTime;

  const record: Record<string, any> = {
    title: formData.title,
    description: formData.description,
    topic: formData.topic || "Biotechnology",
    speaker_name: formData.speakerName || "Micrylis Mentor",
    speaker_designation: formData.speakerDesignation || "Specialist",
    speaker_image: formData.speakerImage || "",
    start_date_time: startIso,
    end_date_time: endIso,
    timezone: formData.timezone || "IST (GMT+5:30)",
    registration_url: formData.registrationUrl || "",
    join_url: formData.joinUrl || "",
    recording_url: formData.recordingUrl || "",
    thumbnail: formData.thumbnail || "",
    status: getCalculatedWebinarStatus(startIso, endIso),
    is_published: formData.isPublished,
    updated_at: now,
  };

  let resultData: any;

  if (existingId) {
    // Update existing webinar
    const { data, error } = await supabase
      .from("webinars")
      .update(record)
      .eq("id", existingId)
      .select()
      .single();

    if (error) {
      console.error("[Webinar Store] Supabase update error:", error);
      throw new Error(error.message);
    }
    resultData = data;
  } else {
    // Insert new webinar
    const { data, error } = await supabase
      .from("webinars")
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error("[Webinar Store] Supabase insert error:", error);
      throw new Error(error.message);
    }
    resultData = data;
  }

  return mapDbToWebinar(resultData);
}

/**
 * Delete a webinar from Supabase by UUID
 */
export async function deleteWebinar(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("webinars").delete().eq("id", id);
    if (error) {
      console.error("[Webinar Store] Supabase delete error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Webinar Store] Supabase delete error:", err);
    return false;
  }
}

/**
 * Toggle publish/unpublish status of a webinar
 */
export async function togglePublishWebinar(id: string, isPublished: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webinars")
      .update({ is_published: isPublished, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[Webinar Store] Toggle publish error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Webinar Store] Toggle publish error:", err);
    return false;
  }
}
