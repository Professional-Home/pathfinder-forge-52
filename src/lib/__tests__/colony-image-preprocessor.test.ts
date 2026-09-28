import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  preprocessSpecimenImage,
  calculatePreservedAspectRatioDimensions,
  MAX_UPLOAD_SIZE_BYTES,
  TARGET_MAX_DIMENSION,
  USER_OPTIMIZATION_SUCCESS_MESSAGE,
  USER_OPTIMIZATION_FAILURE_MESSAGE,
} from "../colony-image-preprocessor";

describe("Colony Image Preprocessor (UX-03 / Mobile Uploads)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Aspect Ratio Preservation", () => {
    it("preserves 2:1 aspect ratio when scaling down wide images", () => {
      const { width, height } = calculatePreservedAspectRatioDimensions(4096, 2048, 2048);
      expect(width).toBe(2048);
      expect(height).toBe(1024);
      expect(width / height).toBeCloseTo(4096 / 2048, 4);
    });

    it("preserves 3:4 aspect ratio when scaling down tall mobile portrait photos", () => {
      const { width, height } = calculatePreservedAspectRatioDimensions(3000, 4000, 2048);
      expect(width).toBe(1536);
      expect(height).toBe(2048);
      expect(width / height).toBeCloseTo(3000 / 4000, 4);
    });

    it("leaves images within 2048px untouched in dimension", () => {
      const { width, height } = calculatePreservedAspectRatioDimensions(1600, 1200, 2048);
      expect(width).toBe(1600);
      expect(height).toBe(1200);
    });

    it("handles square dimensions accurately", () => {
      const { width, height } = calculatePreservedAspectRatioDimensions(3000, 3000, 2048);
      expect(width).toBe(2048);
      expect(height).toBe(2048);
    });
  });

  describe("Normal <= 5 MB Upload Path", () => {
    it("preserves existing upload path without modifying or recompressing standard image", async () => {
      // 2 MB file (well within 5 MB limit)
      const mockFile = new File([new Uint8Array(2 * 1024 * 1024)], "standard_plate.jpg", {
        type: "image/jpeg",
      });

      const result = await preprocessSpecimenImage(mockFile);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isOptimized).toBe(false);
        // Exact object identity preserved (zero copy, zero recompression)
        expect(result.uploadFile).toBe(mockFile);
        expect(result.originalFile).toBe(mockFile);
        expect(result.originalSize).toBe(2 * 1024 * 1024);
        expect(result.optimizedSize).toBe(2 * 1024 * 1024);
      }
    });

    it("handles boundary file exactly at 5 MB without triggering preprocessing", async () => {
      const mockFile = new File([new Uint8Array(MAX_UPLOAD_SIZE_BYTES)], "boundary_plate.png", {
        type: "image/png",
      });

      const result = await preprocessSpecimenImage(mockFile);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isOptimized).toBe(false);
        expect(result.uploadFile).toBe(mockFile);
      }
    });
  });

  describe("Large Image Preprocessing Path (> 5 MB)", () => {
    it("triggers preprocessing for > 5 MB image and generates compliant upload payload", async () => {
      // 8 MB oversized camera photo
      const originalBuffer = new Uint8Array(8 * 1024 * 1024);
      const originalFile = new File([originalBuffer], "IMG_9823_camera.JPG", {
        type: "image/jpeg",
      });

      // Mock createImageBitmap to return high-res dimensions
      globalThis.createImageBitmap = vi.fn().mockResolvedValue({
        width: 4032,
        height: 3024,
        close: vi.fn(),
      } as unknown as ImageBitmap);

      // Mock canvas toBlob to return a 1.8 MB compressed JPEG blob
      const compressedBlob = new Blob([new Uint8Array(1.8 * 1024 * 1024)], { type: "image/jpeg" });
      HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
        callback(compressedBlob);
      }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

      const result = await preprocessSpecimenImage(originalFile);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isOptimized).toBe(true);
        expect(result.message).toBe(USER_OPTIMIZATION_SUCCESS_MESSAGE);
        expect(result.uploadFile).toBeInstanceOf(File);
        expect(result.uploadFile.name).toBe("IMG_9823_camera_optimized.jpg");
        expect(result.uploadFile.type).toBe("image/jpeg");
        expect(result.optimizedSize).toBeLessThanOrEqual(MAX_UPLOAD_SIZE_BYTES);

        // Aspect ratio dimensions scaled to max 2048
        expect(result.originalDimensions).toEqual({ width: 4032, height: 3024 });
        expect(result.optimizedDimensions?.width).toBe(2048);
        expect(result.optimizedDimensions?.height).toBe(1536);

        // Original user file must NOT be mutated
        expect(result.originalFile).toBe(originalFile);
        expect(originalFile.size).toBe(8 * 1024 * 1024);
        expect(originalFile.name).toBe("IMG_9823_camera.JPG");
      }
    });

    it("gracefully falls back and produces user-friendly error when decode fails", async () => {
      const corruptFile = new File([new Uint8Array(6 * 1024 * 1024)], "corrupt_mobile.jpg", {
        type: "image/jpeg",
      });

      // Mock createImageBitmap failure
      globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error("Decoder error"));

      // Mock Image load failure
      const originalImage = globalThis.Image;
      globalThis.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_v: string) {
          setTimeout(() => this.onerror?.(), 0);
        }
      } as unknown as typeof Image;

      try {
        const result = await preprocessSpecimenImage(corruptFile);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe(USER_OPTIMIZATION_FAILURE_MESSAGE);
          expect(result.originalFile).toBe(corruptFile);
        }
      } finally {
        globalThis.Image = originalImage;
      }
    });

    it("fails with user-friendly message if canvas cannot reduce below 5 MB within bounded iterations", async () => {
      const hugeFile = new File([new Uint8Array(20 * 1024 * 1024)], "huge_raw_scan.png", {
        type: "image/png",
      });

      globalThis.createImageBitmap = vi.fn().mockResolvedValue({
        width: 8000,
        height: 6000,
        close: vi.fn(),
      } as unknown as ImageBitmap);

      // Mock toBlob always returning 8 MB (fails to compress below 5 MB)
      const oversizedBlob = new Blob([new Uint8Array(8 * 1024 * 1024)], { type: "image/jpeg" });
      HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
        callback(oversizedBlob);
      }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

      const result = await preprocessSpecimenImage(hugeFile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(USER_OPTIMIZATION_FAILURE_MESSAGE);
      }
    });
  });
});
