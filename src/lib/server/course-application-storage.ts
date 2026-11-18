import { supabaseAdmin } from "@/lib/server/supabase-admin";

export const BUCKET_NAME = "course-applications";
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per DEC-04

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  detectedMime?: AllowedMimeType;
}

/**
 * Validates document buffer against binary magic bytes to prevent file extension spoofing (DEC-04).
 */
export function validateDocumentMagicBytes(buffer: Uint8Array | Buffer): FileValidationResult {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, error: "File buffer is empty or corrupted." };
  }

  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, detectedMime: "application/pdf" };
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedMime: "image/png" };
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedMime: "image/jpeg" };
  }

  return {
    isValid: false,
    error: "Invalid file format. Only true PDF, JPEG, and PNG files are accepted.",
  };
}

/**
 * Full pre-upload validation for file metadata and binary signatures.
 */
export function validateDocumentFile(opts: {
  buffer?: Uint8Array | Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): FileValidationResult {
  if (opts.sizeBytes <= 0) {
    return { isValid: false, error: "File is empty (0 bytes)." };
  }

  if (opts.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the 10 MB limit (${(opts.sizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  const ext = opts.fileName.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];
  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      isValid: false,
      error: `Unsupported file format for '${opts.fileName}'. Allowed extensions: .pdf, .jpg, .jpeg, .png`,
    };
  }

  const mime = opts.mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mime as AllowedMimeType)) {
    return {
      isValid: false,
      error: `Unsupported file type '${opts.mimeType}'. Please upload a PDF, JPEG, or PNG document.`,
    };
  }

  if (opts.buffer) {
    const magicCheck = validateDocumentMagicBytes(opts.buffer);
    if (!magicCheck.isValid) {
      return magicCheck;
    }
  }

  return { isValid: true, detectedMime: mime as AllowedMimeType };
}

/**
 * Generates an isolated, collision-resistant storage path for a document.
 * Path convention: <application_id>/<document_type>/<timestamp>-<sanitized_name>
 */
export function generateStoragePath(applicationId: string, documentType: string, originalFileName: string): string {
  const sanitizedName = originalFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();

  const timestamp = Date.now();
  return `${applicationId}/${documentType}/${timestamp}-${sanitizedName}`;
}

/**
 * Creates a signed upload URL for browser-direct, authenticated uploads to the private bucket.
 */
export async function createSignedUploadUrl(
  applicationId: string,
  documentType: string,
  fileName: string
): Promise<{
  success: boolean;
  signedUrl?: string;
  token?: string;
  storagePath?: string;
  error?: string;
}> {
  try {
    const storagePath = generateStoragePath(applicationId, documentType, fileName);

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl) {
      console.error("[STORAGE_SERVICE] Failed to create signed upload URL:", error);
      return { success: false, error: error?.message || "Failed to generate upload ticket." };
    }

    return {
      success: true,
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    };
  } catch (err: any) {
    console.error("[STORAGE_SERVICE] Unexpected error in createSignedUploadUrl:", err);
    return { success: false, error: err.message || "Internal storage error." };
  }
}

/**
 * Creates a short-lived signed download URL for administrative or student viewing.
 */
export async function createSignedDownloadUrl(
  storagePath: string,
  expiresInSeconds: number = 300 // 5 minutes default
): Promise<{
  success: boolean;
  signedUrl?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error("[STORAGE_SERVICE] Failed to create signed download URL:", error);
      return { success: false, error: error?.message || "Failed to generate secure document URL." };
    }

    return {
      success: true,
      signedUrl: data.signedUrl,
    };
  } catch (err: any) {
    console.error("[STORAGE_SERVICE] Unexpected error in createSignedDownloadUrl:", err);
    return { success: false, error: err.message || "Internal storage error." };
  }
}

/**
 * Removes a document from private storage upon application rejection or document replacement.
 */
export async function deleteDocumentFromStorage(storagePath: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error("[STORAGE_SERVICE] Failed to delete document from storage:", error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[STORAGE_SERVICE] Exception deleting document:", err);
    return false;
  }
}
