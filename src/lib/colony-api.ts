/**
 * Colony Detection & Counting API Client
 *
 * Connects to the external Python FastAPI ML microservice running YOLO
 * for automated Petri-dish colony detection.
 */

// ─── Types & Interfaces ────────────────────────────────────────────────────────

/** Bounding box coordinates and confidence for a single detected colony */
export interface ColonyDetection {
  /** X coordinate of top-left corner (in pixels) */
  x1: number;
  /** Y coordinate of top-left corner (in pixels) */
  y1: number;
  /** X coordinate of bottom-right corner (in pixels) */
  x2: number;
  /** Y coordinate of bottom-right corner (in pixels) */
  y2: number;
  /** Model confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Numeric class identifier (default 0 for single-class colony detection) */
  class_id: number;
  /** Label name for the detected class (e.g. "colony") */
  class_name: string;
}

/** Original image dimensions reported by the ML service */
export interface ColonyImageMetadata {
  width: number;
  height: number;
}

/** Error details returned by the ML service or API client */
export interface ColonyDetectionError {
  code: string;
  message: string;
  details?: unknown;
}

/** Successful detection response from the ML service */
export interface ColonyDetectionSuccessResponse {
  success: true;
  /** Total number of colonies detected above the confidence threshold */
  count: number;
  /** Array of individual colony detections with bounding boxes */
  detections: ColonyDetection[];
  /** Dimensions of the processed image */
  image: ColonyImageMetadata;
  /** Optional URL or data URI to the server-annotated image */
  annotated_image_url?: string;
  /** Total backend inference/processing time in milliseconds */
  processing_time_ms: number;
}

/** Error response format from the ML service */
export interface ColonyDetectionErrorResponse {
  success: false;
  error: ColonyDetectionError;
}

/** Discriminated union of all possible API responses */
export type ColonyDetectionResponse = ColonyDetectionSuccessResponse | ColonyDetectionErrorResponse;

/** Options passed to the colony detection request */
export interface DetectColoniesOptions {
  /** Optional confidence cutoff (0.0 to 1.0). Detections below this score are filtered out. */
  confidenceThreshold?: number;
  /** Optional AbortSignal to cancel in-flight detection requests */
  signal?: AbortSignal;
}

// ─── Custom API Error ─────────────────────────────────────────────────────────

export class ColonyDetectionApiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;

  constructor(message: string, code = "API_ERROR", status?: number, details?: unknown) {
    super(message);
    this.name = "ColonyDetectionApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// ─── URL Helper ───────────────────────────────────────────────────────────────

/**
 * Returns the fully qualified endpoint URL for colony detection:
 * `${VITE_COLONY_ML_API_URL}/api/v1/detect-colonies`
 */
export function getColonyApiUrl(): string {
  const envUrl = import.meta.env.VITE_COLONY_ML_API_URL;
  const baseUrl = (
    typeof envUrl === "string" && envUrl.trim() ? envUrl.trim() : "http://localhost:8000"
  ).replace(/\/+$/, "");

  return `${baseUrl}/api/v1/detect-colonies`;
}

// ─── API Client Function ──────────────────────────────────────────────────────

/**
 * Sends a Petri-dish image to the Python FastAPI YOLO microservice for colony detection.
 *
 * @param file - The image file or Blob to analyze (e.g. from camera or file picker)
 * @param optionsOrThreshold - Optional confidence threshold (number 0-1) or options object
 * @returns Promise resolving to the validated ColonyDetectionSuccessResponse
 *
 * @throws {ColonyDetectionApiError} If request fails, returns non-2xx status, or returns an error payload
 */
export async function detectColonies(
  file: File | Blob,
  optionsOrThreshold?: number | DetectColoniesOptions,
): Promise<ColonyDetectionSuccessResponse> {
  if (!file) {
    throw new ColonyDetectionApiError(
      "No image file provided for colony detection.",
      "INVALID_ARGUMENT",
    );
  }

  // Parse polymorphic options argument
  const options: DetectColoniesOptions =
    typeof optionsOrThreshold === "number"
      ? { confidenceThreshold: optionsOrThreshold }
      : (optionsOrThreshold ?? {});

  const { confidenceThreshold, signal } = options;

  if (
    typeof confidenceThreshold === "number" &&
    (Number.isNaN(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1)
  ) {
    throw new ColonyDetectionApiError(
      "Confidence threshold must be a number between 0.0 and 1.0.",
      "INVALID_THRESHOLD",
    );
  }

  // Prepare multipart form data
  const formData = new FormData();
  formData.append("image", file);

  if (typeof confidenceThreshold === "number") {
    formData.append("confidence_threshold", String(confidenceThreshold));
  }

  const endpoint = getColonyApiUrl();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      signal,
      // Do NOT set Content-Type header manually; fetch sets boundary automatically for FormData
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ColonyDetectionApiError("Colony detection request was aborted.", "REQUEST_ABORTED");
    }

    const errorMsg =
      err instanceof Error
        ? err.message
        : "Failed to connect to the Colony Detection ML service. Please ensure the backend is running.";

    throw new ColonyDetectionApiError(
      `Network error communicating with ML service: ${errorMsg}`,
      "NETWORK_ERROR",
    );
  }

  // Parse response body as JSON
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ColonyDetectionApiError(
      `Colony Detection service responded with status ${response.status}, but response was not valid JSON.`,
      "INVALID_RESPONSE",
      response.status,
    );
  }

  // Handle non-2xx HTTP status codes
  if (!response.ok) {
    const errorPayload = data as Partial<ColonyDetectionErrorResponse>;
    const code = errorPayload?.error?.code ?? `HTTP_${response.status}`;
    const message =
      errorPayload?.error?.message ??
      `Colony detection failed with status ${response.status} (${response.statusText || "Error"}).`;

    throw new ColonyDetectionApiError(message, code, response.status, errorPayload?.error?.details);
  }

  // Validate response payload conforms to success contract
  const payload = data as Partial<ColonyDetectionSuccessResponse>;

  if (
    payload.success !== true ||
    typeof payload.count !== "number" ||
    !Array.isArray(payload.detections) ||
    !payload.image ||
    typeof payload.image.width !== "number" ||
    typeof payload.image.height !== "number"
  ) {
    const errorPayload = data as Partial<ColonyDetectionErrorResponse>;
    const code = errorPayload?.error?.code ?? "INVALID_PAYLOAD";
    const message =
      errorPayload?.error?.message ??
      "Response from Colony Detection service did not match expected schema.";

    throw new ColonyDetectionApiError(message, code, response.status, data);
  }

  return payload as ColonyDetectionSuccessResponse;
}
