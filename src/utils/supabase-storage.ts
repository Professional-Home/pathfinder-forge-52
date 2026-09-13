import { supabase } from "@/utils/supabase";

export const ARTICLE_IMAGES_BUCKET = "article-images";
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];

export interface ImageUploadResult {
  url?: string;
  error?: string;
}

/**
 * Validates file size, MIME type, and extension for article images.
 */
export function validateArticleImage(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No image file selected." };
  }

  // 1. Size check
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 5 MB.`,
    };
  }

  // 2. MIME type check
  const fileType = (file.type || "").toLowerCase();
  if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPG, JPEG, PNG, WEBP, GIF, and SVG images are supported.",
    };
  }

  // 3. Extension check
  const fileName = (file.name || "").toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExt) {
    return {
      valid: false,
      error:
        "Invalid file extension. Please select an image with a valid extension (.jpg, .png, .webp, etc.).",
    };
  }

  return { valid: true };
}

/**
 * Uploads an article image to the Supabase Storage 'article-images' bucket
 * and returns the public URL.
 */
export async function uploadArticleImage(file: File): Promise<ImageUploadResult> {
  const validation = validateArticleImage(file);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const sanitizedBase = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9_-]/gi, "-")
      .toLowerCase()
      .substring(0, 30);
    const filePath = `articles/${timestamp}-${sanitizedBase || "img"}-${randomStr}.${ext}`;

    const { data, error: uploadError } = await supabase.storage
      .from(ARTICLE_IMAGES_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

    if (uploadError) {
      console.error("[Supabase Storage] Upload error:", uploadError);

      const status =
        uploadError && typeof uploadError === "object" && "statusCode" in uploadError
          ? String((uploadError as { statusCode: unknown }).statusCode)
          : "";

      if (uploadError.message?.includes("Bucket not found") || status === "404") {
        return {
          error: `Storage bucket '${ARTICLE_IMAGES_BUCKET}' not found in your Supabase project. Please run 'supabase_article_images_storage.sql' in the Supabase SQL Editor to create it.`,
        };
      }

      if (uploadError.message?.includes("row-level security") || status === "403") {
        return {
          error: `Permission denied uploading to '${ARTICLE_IMAGES_BUCKET}'. Please verify the storage RLS policies in 'supabase_article_images_storage.sql'.`,
        };
      }

      return {
        error: uploadError.message || "Failed to upload image to Supabase Storage.",
      };
    }

    if (!data?.path) {
      return { error: "Upload succeeded but no file path was returned." };
    }

    // Retrieve public URL
    const { data: urlData } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      return { error: "Failed to generate public URL for uploaded image." };
    }

    return { url: urlData.publicUrl };
  } catch (err: unknown) {
    console.error("[Supabase Storage] Unexpected error during upload:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred while uploading the image.";
    return { error: msg };
  }
}
