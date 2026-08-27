import { supabase } from "@/utils/supabase";
import { type WebinarEvent, type EventFormData } from "./types";

function mapDbToEvent(db: any): WebinarEvent {
  return {
    id: String(db.id),
    name: db.name || "Untitled Event",
    description: db.description || "",
    photo: db.photo || "",
    googleFormLink: db.google_form_link || db.googleFormLink || "",
    isLocked: db.is_locked ?? db.isLocked ?? false,
    createdAt: db.created_at || new Date().toISOString(),
    updatedAt: db.updated_at || new Date().toISOString(),
  };
}

/**
 * Fetch all webinar events from Supabase.
 */
export async function fetchEvents(): Promise<WebinarEvent[]> {
  try {
    const { data, error } = await supabase
      .from("webinar_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map(mapDbToEvent);
    }
    console.warn("[Events Store] Fetch error:", error);
  } catch (e) {
    console.warn("[Events Store] Fetch error from Supabase:", e);
  }
  return [];
}

/**
 * Fetch a single event by UUID.
 */
export async function fetchEventById(id: string): Promise<WebinarEvent | null> {
  try {
    const { data, error } = await supabase
      .from("webinar_events")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return mapDbToEvent(data);
    }
  } catch (e) {
    console.warn("[Events Store] Error fetching event by id:", e);
  }
  return null;
}

/**
 * Create or update an event in Supabase.
 */
export async function saveEvent(formData: EventFormData, existingId?: string): Promise<WebinarEvent> {
  const now = new Date().toISOString();

  const record: Record<string, any> = {
    name: formData.name,
    description: formData.description,
    photo: formData.photo,
    google_form_link: formData.googleFormLink,
    is_locked: formData.isLocked,
    updated_at: now,
  };

  let resultData: any;

  if (existingId) {
    const { data, error } = await supabase
      .from("webinar_events")
      .update(record)
      .eq("id", existingId)
      .select()
      .single();

    if (error) {
      console.error("[Events Store] Supabase update error:", error);
      throw new Error(error.message);
    }
    resultData = data;
  } else {
    const { data, error } = await supabase
      .from("webinar_events")
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error("[Events Store] Supabase insert error:", error);
      throw new Error(error.message);
    }
    resultData = data;
  }

  return mapDbToEvent(resultData);
}

/**
 * Delete an event from Supabase by UUID.
 */
export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("webinar_events").delete().eq("id", id);
    if (error) {
      console.error("[Events Store] Supabase delete error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Events Store] Supabase delete error:", err);
    return false;
  }
}

/**
 * Toggle the locked status of an event.
 */
export async function toggleLockEvent(id: string, isLocked: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("webinar_events")
      .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[Events Store] Toggle lock error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Events Store] Toggle lock error:", err);
    return false;
  }
}
