import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getColonyApiUrl,
  detectColonies,
  ColonyDetectionApiError,
  type ColonyDetectionSuccessResponse,
} from "../colony-api";

describe("colony-api client & URL resolution (DEP-01)", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore import.meta.env
    Object.assign(import.meta.env, originalEnv);
  });

  describe("getColonyApiUrl (DEP-01 Regression Tests)", () => {
    it("returns development localhost fallback when in dev mode and env var is unset", () => {
      (import.meta.env as Record<string, unknown>).PROD = false;
      (import.meta.env as Record<string, unknown>).VITE_COLONY_ML_API_URL = "";

      const url = getColonyApiUrl();
      expect(url).toBe("http://localhost:8000/api/v1/detect-colonies");
    });

    it("throws CONFIG_ERROR in production when VITE_COLONY_ML_API_URL is missing", () => {
      (import.meta.env as Record<string, unknown>).PROD = true;
      (import.meta.env as Record<string, unknown>).VITE_COLONY_ML_API_URL = "";

      expect(() => getColonyApiUrl()).toThrowError(ColonyDetectionApiError);

      try {
        getColonyApiUrl();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ColonyDetectionApiError);
        const apiErr = err as ColonyDetectionApiError;
        expect(apiErr.code).toBe("CONFIG_ERROR");
        expect(apiErr.message).toContain("VITE_COLONY_ML_API_URL");
      }
    });

    it("throws CONFIG_ERROR in production when VITE_COLONY_ML_API_URL is only whitespace", () => {
      (import.meta.env as Record<string, unknown>).PROD = true;
      (import.meta.env as Record<string, unknown>).VITE_COLONY_ML_API_URL = "   ";

      expect(() => getColonyApiUrl()).toThrowError(ColonyDetectionApiError);
    });

    it("uses configured production URL and strips trailing slashes", () => {
      (import.meta.env as Record<string, unknown>).PROD = true;
      (import.meta.env as Record<string, unknown>).VITE_COLONY_ML_API_URL = "https://biotech-ml.micrylis.com/";

      const url = getColonyApiUrl();
      expect(url).toBe("https://biotech-ml.micrylis.com/api/v1/detect-colonies");
    });

    it("uses configured URL in development if explicitly set", () => {
      (import.meta.env as Record<string, unknown>).PROD = false;
      (import.meta.env as Record<string, unknown>).VITE_COLONY_ML_API_URL = "http://127.0.0.1:8001";

      const url = getColonyApiUrl();
      expect(url).toBe("http://127.0.0.1:8001/api/v1/detect-colonies");
    });
  });

  describe("detectColonies", () => {
    const mockSuccessResponse: ColonyDetectionSuccessResponse = {
      success: true,
      count: 2,
      detections: [
        { x1: 10, y1: 20, x2: 30, y2: 40, confidence: 0.95, class_id: 0, class_name: "colony" },
        { x1: 50, y1: 60, x2: 70, y2: 80, confidence: 0.88, class_id: 0, class_name: "colony" },
      ],
      annotated_image_url: "/outputs/annotated_0123456789abcdef0123456789abcdef.jpg",
      image: { width: 1024, height: 1024 },
      processing_time_ms: 120,
      applied_threshold: 0.3,
      quality: {
        density_level: "low",
        confluence_risk: "low",
        review_recommended: false,
        overlap_ratio: 0.02,
      },
    };

    it("throws INVALID_ARGUMENT when no file is passed", async () => {
      // @ts-expect-error testing invalid invocation
      await expect(detectColonies(null)).rejects.toMatchObject({
        code: "INVALID_ARGUMENT",
      });
    });

    it("throws INVALID_THRESHOLD when confidence threshold is outside 0.0-1.0", async () => {
      const mockFile = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
      await expect(detectColonies(mockFile, { confidenceThreshold: 1.5 })).rejects.toMatchObject({
        code: "INVALID_THRESHOLD",
      });
      await expect(detectColonies(mockFile, { confidenceThreshold: -0.1 })).rejects.toMatchObject({
        code: "INVALID_THRESHOLD",
      });
      await expect(detectColonies(mockFile, { confidenceThreshold: NaN })).rejects.toMatchObject({
        code: "INVALID_THRESHOLD",
      });
    });

    it("sends request with FormData and returns parsed payload on success", async () => {
      (import.meta.env as Record<string, unknown>).PROD = false;
      (import.meta.env as Record<string, unknown>).VITE_COLONY_ML_API_URL = "http://localhost:8000";

      const mockFile = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const result = await detectColonies(mockFile, 0.35);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("http://localhost:8000/api/v1/detect-colonies");
      expect(calledInit?.method).toBe("POST");
      expect(calledInit?.body).toBeInstanceOf(FormData);

      expect(result.count).toBe(2);
      expect(result.annotated_image_url).toBe("/outputs/annotated_0123456789abcdef0123456789abcdef.jpg");
    });

    it("handles backend error responses and extracts structured error details", async () => {
      (import.meta.env as Record<string, unknown>).PROD = false;
      const mockFile = new Blob(["fake-image-bytes"], { type: "image/jpeg" });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          success: false,
          error: {
            code: "MODEL_NOT_CONFIGURED",
            message: "Trained colony model is not configured.",
          },
        }),
      } as Response);

      await expect(detectColonies(mockFile)).rejects.toMatchObject({
        code: "MODEL_NOT_CONFIGURED",
        message: "Trained colony model is not configured.",
      });
    });

    it("handles pre-aborted signal with REQUEST_ABORTED", async () => {
      const mockFile = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
      const abortController = new AbortController();
      abortController.abort();

      await expect(
        detectColonies(mockFile, { signal: abortController.signal }),
      ).rejects.toMatchObject({
        code: "REQUEST_ABORTED",
      });
    });

    it("handles network failure with NETWORK_ERROR", async () => {
      (import.meta.env as Record<string, unknown>).PROD = false;
      const mockFile = new Blob(["fake-image-bytes"], { type: "image/jpeg" });

      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Failed to fetch"));

      await expect(detectColonies(mockFile)).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });
    });

    it("handles timeout with REQUEST_TIMEOUT", async () => {
      (import.meta.env as Record<string, unknown>).PROD = false;
      const mockFile = new Blob(["fake-image-bytes"], { type: "image/jpeg" });

      vi.spyOn(globalThis, "fetch").mockImplementationOnce((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new DOMException("The operation was aborted", "AbortError");
            reject(err);
          });
        });
      });

      await expect(detectColonies(mockFile, { timeoutMs: 50 })).rejects.toMatchObject({
        code: "REQUEST_TIMEOUT",
      });
    });
  });
});
