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
  const cName = cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cName || !preset || cName === "your_cloudinary_cloud_name" || preset === "your_unsigned_upload_preset") {
    throw new Error(
      "Cloudinary credentials not configured! Please replace 'your_cloudinary_cloud_name' and 'your_unsigned_upload_preset' in your .env file with your actual Cloudinary credentials."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to upload image to Cloudinary.");
  }

  const data: CloudinaryUploadResponse = await response.json();
  return data.secure_url;
}
