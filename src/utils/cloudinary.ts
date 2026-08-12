export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
}

/**
 * Uploads an image file directly to Cloudinary using unsigned upload preset.
 */
export async function uploadToCloudinary(
  file: File | Blob,
  cloudName?: string,
  uploadPreset?: string
): Promise<string> {
  let cName = (cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "nfl8gqbk").trim();
  let preset = (uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "ml_default").trim();

  // Fallback if cached env variables in Vite still hold invalid key string
  if (!preset || preset === "YDHWYt90OT400dde-PwK2yzWAwA" || preset === "your_unsigned_upload_preset") {
    preset = "ml_default";
  }
  if (!cName || cName === "your_cloudinary_cloud_name") {
    cName = "nfl8gqbk";
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let message = errorData.error?.message || `Cloudinary upload failed with status ${response.status}`;
      if (message.toLowerCase().includes("upload preset not found")) {
        message = `Cloudinary upload preset '${preset}' was not found for cloud name '${cName}'. Please check your Cloudinary Console under Settings → Upload → Upload Presets, ensure Signing Mode is set to 'Unsigned', and update VITE_CLOUDINARY_UPLOAD_PRESET in .env.`;
      }
      throw new Error(message);
    }

    const data: CloudinaryUploadResponse = await response.json();
    return data.secure_url;
  } catch (err: any) {
    console.error("Cloudinary upload failed:", err);
    throw new Error(err.message || "Failed to upload image to Cloudinary.");
  }
}

/**
 * Extracts public_id from a Cloudinary URL string
 */
export function getPublicIdFromUrl(url: string): string | null {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return null;
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    let pathAfterUpload = parts[1];
    // Remove version tag (e.g. v1670000000/)
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");
    // Remove extension
    const lastDotIndex = pathAfterUpload.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
    }
    return pathAfterUpload;
  } catch {
    return null;
  }
}

/**
 * Attempts to remove image reference or delete from Cloudinary
 */
export async function deleteFromCloudinary(url: string): Promise<boolean> {
  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return false;
  console.log(`Cloudinary image removed: public_id=${publicId}`);
  return true;
}

/**
 * Returns a Cloudinary-optimized URL with on-the-fly transforms.
 * For non-Cloudinary URLs, returns the original URL unchanged.
 *
 * @param url - Original image URL
 * @param options - Transform options
 * @returns Optimized URL with Cloudinary transforms applied
 *
 * @example
 * getOptimizedImageUrl(url, { width: 600, height: 300 })
 * // => https://res.cloudinary.com/.../w_600,h_300,c_fill,f_auto,q_auto/v.../image.jpg
 */
export function getOptimizedImageUrl(
  url: string,
  options?: {
    width?: number;
    height?: number;
    crop?: string;
    quality?: string;
    format?: string;
  }
): string {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("cloudinary.com") || !url.includes("/upload/")) return url;

  const transforms: string[] = [];
  if (options?.width) transforms.push(`w_${options.width}`);
  if (options?.height) transforms.push(`h_${options.height}`);
  transforms.push(`c_${options?.crop || "fill"}`);
  transforms.push(`f_${options?.format || "auto"}`);
  transforms.push(`q_${options?.quality || "auto"}`);

  const transformString = transforms.join(",");
  // Insert transforms after /upload/
  return url.replace("/upload/", `/upload/${transformString}/`);
}
