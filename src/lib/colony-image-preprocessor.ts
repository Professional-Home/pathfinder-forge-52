/**
 * Client-Side Colony Image Preprocessor (UX-03 / Mobile Optimization)
 *
 * Preprocesses high-resolution and mobile camera images exceeding the 5 MB
 * upload limit directly in browser memory before sending to the backend ML service.
 *
 * Scientific & UX Invariants:
 * - If file size <= 5 MB: remains completely untouched (zero recompression).
 * - If file size > 5 MB: scales longest edge to max 2048px (consistent with backend PRF-01)
 *   and applies bounded high-fidelity JPEG compression until file is <= 5 MB.
 * - Strictly preserves original aspect ratio (zero cropping).
 * - Respects EXIF orientation tags from mobile cameras.
 * - Non-destructive: original user File is never mutated.
 * - Memory-safe: revokes object URLs, closes bitmaps, and clears canvas buffers.
 */

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (5,242,880 bytes)
export const TARGET_MAX_DIMENSION = 2048; // Matches backend PRF-01 longest-edge target
export const MIN_SAFE_DIMENSION = 640; // Floor matching YOLO receptive field
export const INITIAL_JPEG_QUALITY = 0.92; // High-fidelity baseline preserving punctate colonies
export const MIN_JPEG_QUALITY = 0.65; // Safe minimum compression quality cutoff
export const MAX_COMPRESSION_ITERATIONS = 5; // Bounded loop guard

export const USER_OPTIMIZATION_SUCCESS_MESSAGE = "Large image optimized for upload.";
export const USER_OPTIMIZATION_FAILURE_MESSAGE =
  "Unable to optimize this image in your browser. Please choose a smaller image.";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageOptimizationSuccess {
  success: true;
  isOptimized: boolean;
  uploadFile: File;
  originalFile: File;
  originalSize: number;
  optimizedSize: number;
  originalDimensions?: ImageDimensions;
  optimizedDimensions?: ImageDimensions;
  message: string;
}

export interface ImageOptimizationError {
  success: false;
  error: string;
  originalFile: File;
}

export type PreprocessImageResult = ImageOptimizationSuccess | ImageOptimizationError;

/**
 * Calculates new dimensions scaled to maxDimension while strictly preserving aspect ratio.
 */
export function calculatePreservedAspectRatioDimensions(
  rawWidth: number,
  rawHeight: number,
  maxDimension: number = TARGET_MAX_DIMENSION,
): ImageDimensions {
  if (rawWidth <= 0 || rawHeight <= 0) {
    return { width: Math.max(1, rawWidth), height: Math.max(1, rawHeight) };
  }

  const currentMax = Math.max(rawWidth, rawHeight);
  if (currentMax <= maxDimension) {
    return { width: rawWidth, height: rawHeight };
  }

  const scale = maxDimension / currentMax;
  const targetWidth = Math.max(1, Math.round(rawWidth * scale));
  const targetHeight = Math.max(1, Math.round(rawHeight * scale));

  return { width: targetWidth, height: targetHeight };
}

/**
 * Encodes an HTMLCanvasElement to a JPEG Blob with promise wrapper.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = INITIAL_JPEG_QUALITY,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } else {
      // Fallback for environments lacking native canvas.toBlob (e.g. legacy or minimal test DOM)
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const parts = dataUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || type;
        const binStr = atob(parts[1]);
        const len = binStr.length;
        const u8arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8arr[i] = binStr.charCodeAt(i);
        }
        resolve(new Blob([u8arr], { type: mime }));
      } catch {
        resolve(null);
      }
    }
  });
}

/**
 * Preprocesses a specimen image in browser memory if it exceeds 5 MB.
 *
 * @param file - The user's original image File
 * @returns Result with uploadFile (original file if <= 5MB, or optimized file if > 5MB)
 */
export async function preprocessSpecimenImage(file: File): Promise<PreprocessImageResult> {
  if (!file) {
    return {
      success: false,
      error: USER_OPTIMIZATION_FAILURE_MESSAGE,
      originalFile: file,
    };
  }

  // 1. Normal path: If already <= 5 MB, do NOT recompress or modify
  if (file.size <= MAX_UPLOAD_SIZE_BYTES) {
    return {
      success: true,
      isOptimized: false,
      uploadFile: file,
      originalFile: file,
      originalSize: file.size,
      optimizedSize: file.size,
      message: "Image within standard upload limit.",
    };
  }

  // 2. Large image optimization path (> 5 MB)
  let bitmap: ImageBitmap | null = null;
  let imgElement: HTMLImageElement | null = null;
  let objectUrl: string | null = null;
  let rawWidth = 0;
  let rawHeight = 0;

  try {
    // Attempt createImageBitmap with EXIF orientation handling where available
    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        rawWidth = bitmap.width;
        rawHeight = bitmap.height;
      } catch {
        // Fallback to HTMLImageElement if createImageBitmap fails on specific format/options
        bitmap = null;
      }
    }

    if (!bitmap) {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = async () => {
          img.onload = null;
          img.onerror = null;
          if (typeof img.decode === "function") {
            try {
              await img.decode();
            } catch {
              // Safe fallback
            }
          }
          resolve();
        };
        img.onerror = () => {
          img.onload = null;
          img.onerror = null;
          reject(new Error("Image decode failed"));
        };
        img.src = objectUrl!;
      });
      imgElement = img;
      rawWidth = img.naturalWidth || img.width;
      rawHeight = img.naturalHeight || img.height;
    }
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (bitmap) {
      try {
        (bitmap as unknown as ImageBitmap).close();
      } catch {}
      bitmap = null;
    }
    return {
      success: false,
      error: USER_OPTIMIZATION_FAILURE_MESSAGE,
      originalFile: file,
    };
  }

  if (rawWidth <= 0 || rawHeight <= 0) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (bitmap) {
      try {
        (bitmap as unknown as ImageBitmap).close();
      } catch {}
      bitmap = null;
    }
    return {
      success: false,
      error: USER_OPTIMIZATION_FAILURE_MESSAGE,
      originalFile: file,
    };
  }

  const originalDimensions: ImageDimensions = { width: rawWidth, height: rawHeight };

  // Calculate target dimensions capped at TARGET_MAX_DIMENSION (2048px)
  let { width: targetWidth, height: targetHeight } = calculatePreservedAspectRatioDimensions(
    rawWidth,
    rawHeight,
    TARGET_MAX_DIMENSION,
  );

  let canvas: HTMLCanvasElement | null = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (bitmap) {
      try {
        bitmap.close();
      } catch {}
      bitmap = null;
    }
    canvas.width = 0;
    canvas.height = 0;
    return {
      success: false,
      error: USER_OPTIMIZATION_FAILURE_MESSAGE,
      originalFile: file,
    };
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const imageSource: CanvasImageSource = bitmap || imgElement!;
  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

  // Iterative bounded compression loop
  let currentQuality = INITIAL_JPEG_QUALITY;
  let bestBlob: Blob | null = null;
  let iteration = 0;

  try {
    while (iteration < MAX_COMPRESSION_ITERATIONS) {
      const blob = await canvasToBlob(canvas, "image/jpeg", currentQuality);
      if (!blob) {
        break;
      }

      bestBlob = blob;

      // Successful compression below backend limit
      if (blob.size <= MAX_UPLOAD_SIZE_BYTES) {
        break;
      }

      iteration++;
      if (iteration >= MAX_COMPRESSION_ITERATIONS) {
        break;
      }

      // First reduce quality down to MIN_JPEG_QUALITY
      if (currentQuality > MIN_JPEG_QUALITY) {
        currentQuality = Math.max(MIN_JPEG_QUALITY, Number((currentQuality - 0.08).toFixed(2)));
      } else {
        // If quality already reached minimum safe threshold, downscale dimensions by 0.85
        const curMax = Math.max(canvas.width, canvas.height);
        const nextMax = Math.round(curMax * 0.85);

        if (nextMax < MIN_SAFE_DIMENSION) {
          // Never scale below minimum safe dimension for colony detection
          break;
        }

        const nextDims = calculatePreservedAspectRatioDimensions(rawWidth, rawHeight, nextMax);
        targetWidth = nextDims.width;
        targetHeight = nextDims.height;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

        currentQuality = 0.85;
      }
    }
  } finally {
    // Memory cleanup: close bitmap, release objectUrl, and clear canvas memory buffer
    if (bitmap) {
      try {
        bitmap.close();
      } catch {}
      bitmap = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas = null;
    }
    imgElement = null;
  }

  // Check if resulting blob satisfies the <= 5 MB invariant
  if (!bestBlob || bestBlob.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      success: false,
      error: USER_OPTIMIZATION_FAILURE_MESSAGE,
      originalFile: file,
    };
  }

  // Create an explicit optimized upload File instance without mutating original user file
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const optimizedFileName = `${baseName}_optimized.jpg`;
  const uploadFile = new File([bestBlob], optimizedFileName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return {
    success: true,
    isOptimized: true,
    uploadFile,
    originalFile: file,
    originalSize: file.size,
    optimizedSize: uploadFile.size,
    originalDimensions,
    optimizedDimensions: { width: targetWidth, height: targetHeight },
    message: USER_OPTIMIZATION_SUCCESS_MESSAGE,
  };
}
