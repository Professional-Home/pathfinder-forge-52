import { describe, it, expect, vi } from "vitest";
import {
  sanitizeFilename,
  formatRawScientific,
  escapeCsvCell,
  serializeCsv,
  buildSummaryCsv,
  exportSummaryCsv,
  buildDetectionsCsv,
  exportDetectionsCsv,
  generateAnnotatedPlateImage,
  type SummaryExportParams,
  type DetectionsExportParams,
} from "../colony-export";
import type { ColonyDetection } from "../colony-api";
import type { ManualColony } from "@/hooks/use-colony-review";

describe("colony-export pure logic and formatting", () => {
  describe("sanitizeFilename", () => {
    it("preserves standard safe basenames without extension", () => {
      expect(sanitizeFilename("plate-01.jpg")).toBe("plate-01");
      expect(sanitizeFilename("sample_specimen_2026.png")).toBe("sample_specimen_2026");
      expect(sanitizeFilename("Agar Plate #3.jpeg")).toBe("Agar_Plate_#3");
      expect(sanitizeFilename("specimen+test.jpg")).toBe("specimen+test");
      expect(sanitizeFilename("sample-analysis-dish.png")).toBe("sample-analysis-dish");
    });

    it("strips directory traversal and full path components", () => {
      expect(sanitizeFilename("C:\\Users\\Lab\\Desktop\\dish_42.jpg")).toBe("dish_42");
      expect(sanitizeFilename("/var/data/specimens/culture_dish.png")).toBe("culture_dish");
      expect(sanitizeFilename("../../../etc/passwd.jpg")).toBe("passwd");
    });

    it("neutralizes leading spreadsheet formula injection triggers (SEC-03)", () => {
      const maliciousInputs = [
        { input: "=SUM(A1:A2)", expectedPrefixNot: ["=", "+", "-", "@", "\t", "\r"] },
        { input: "+malicious", expected: "malicious" },
        { input: "-malicious", expected: "malicious" },
        { input: "@malicious", expected: "malicious" },
        { input: "\tmalicious", expected: "malicious" },
        { input: "\rmalicious", expected: "malicious" },
        { input: "=-@+cmd|' /C calc'!A0", expectedPrefixNot: ["=", "+", "-", "@", "\t", "\r"] },
        { input: "\t=1+2.jpg", expectedPrefixNot: ["=", "+", "-", "@", "\t", "\r"] },
        { input: "\r\n@SUM(B1:B10).csv", expectedPrefixNot: ["=", "+", "-", "@", "\t", "\r"] },
        { input: "=cmd.exe", expected: "cmd" },
        { input: "+12345", expected: "12345" },
        { input: "-999", expected: "999" },
        { input: "@import", expected: "import" },
        { input: "   =test.png", expected: "test" },
      ];

      for (const tc of maliciousInputs) {
        const sanitized = sanitizeFilename(tc.input);
        expect(sanitized).not.toMatch(/^[=+\-@\t\r]/);
        if (tc.expected !== undefined) {
          expect(sanitized).toBe(tc.expected);
        }
      }
    });

    it("falls back to default fallback when input is null, undefined, empty, or entirely stripped", () => {
      expect(sanitizeFilename(null)).toBe("specimen");
      expect(sanitizeFilename(undefined)).toBe("specimen");
      expect(sanitizeFilename("")).toBe("specimen");
      expect(sanitizeFilename("=-+@\t\r")).toBe("specimen");
      expect(sanitizeFilename("   ", "custom-fallback")).toBe("custom-fallback");
    });
  });

  describe("formatRawScientific", () => {
    it("formats finite positive numbers into standard uppercase scientific notation with 2-digit exponent", () => {
      expect(formatRawScientific(1.83e6)).toBe("1.83E+06");
      expect(formatRawScientific(1000000)).toBe("1.00E+06");
      expect(formatRawScientific(2.5e-3)).toBe("2.50E-03");
      expect(formatRawScientific(42)).toBe("4.20E+01");
    });

    it("handles zero and special values cleanly", () => {
      expect(formatRawScientific(0)).toBe("0");
      expect(formatRawScientific(null)).toBe("");
      expect(formatRawScientific(undefined)).toBe("");
      expect(formatRawScientific(NaN)).toBe("");
      expect(formatRawScientific(Infinity)).toBe("");
    });
  });

  describe("escapeCsvCell and serializeCsv", () => {
    it("escapes cells containing commas, quotes, or newlines per RFC 4180", () => {
      expect(escapeCsvCell("simple")).toBe("simple");
      expect(escapeCsvCell("with,comma")).toBe('"with,comma"');
      expect(escapeCsvCell('with "quotes"')).toBe('"with ""quotes"""');
      expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
      expect(escapeCsvCell("line1\rline2")).toBe('"line1\rline2"');
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
      expect(escapeCsvCell(123)).toBe("123");
    });

    it("serializes rows with UTF-8 BOM and CRLF line endings", () => {
      const rows = [
        ["col1", "col2"],
        ["val1", "val2"],
      ];
      const csv = serializeCsv(rows);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("col1,col2\r\nval1,val2");
    });
  });

  describe("buildSummaryCsv", () => {
    const baseSummaryParams: SummaryExportParams = {
      filename: "plate_01.jpg",
      timestamp: "2026-09-27T10:00:00.000Z",
      imageWidth: 1024,
      imageHeight: 1024,
      processingTimeMs: 145,
      appliedThreshold: 0.3,
      aiCount: 185,
      removedCount: 4,
      addedCount: 2,
      reviewedCount: 183,
      quality: {
        density_level: "medium",
        confluence_risk: "low",
        review_recommended: false,
        overlap_ratio: 0.082,
        reason: "Medium density plate.",
      },
      cfuData: {
        countSource: "reviewed",
        activeCount: 183,
        volumeInput: "0.1",
        volumeMl: 0.1,
        volumeUnit: "mL",
        dilutionExponent: 3,
        dilutionFactor: 0.001,
        cfuPerMl: 1.83e6,
        llodCfuPerMl: 1e4,
        isValid: true,
      },
    };

    it("generates complete RFC 4180 summary CSV with BOM and required metadata", () => {
      const csv = buildSummaryCsv(baseSummaryParams);

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("sample_id,analysis_timestamp_utc,image_width_px,image_height_px");
      expect(csv).toContain("plate_01");
      expect(csv).toContain("1.83E+06");
      expect(csv).toContain("1.00E+04");
      expect(csv).toContain("YOLO11n Colony Detector");
      expect(csv).toContain("Micrylis Biotech Colony Counter v1.0");
      expect(csv).toContain("Using human-reviewed count");
    });

    it("preserves automated AI count provenance when count source is ai", () => {
      const params: SummaryExportParams = {
        ...baseSummaryParams,
        cfuData: {
          ...baseSummaryParams.cfuData!,
          countSource: "ai",
          activeCount: 185,
        },
      };
      const csv = buildSummaryCsv(params);
      expect(csv).toContain("Using automated AI count");
    });

    it("preserves custom laboratory count provenance when count source is custom", () => {
      const params: SummaryExportParams = {
        ...baseSummaryParams,
        cfuData: {
          ...baseSummaryParams.cfuData!,
          countSource: "custom",
          activeCount: 120,
        },
      };
      const csv = buildSummaryCsv(params);
      expect(csv).toContain("Using custom laboratory count");
      expect(csv).toContain(",custom,120,Using custom laboratory count,");
    });

    it("handles incomplete CFU calculator state cleanly without fabricating numbers", () => {
      const params: SummaryExportParams = {
        ...baseSummaryParams,
        cfuData: {
          countSource: "ai",
          activeCount: 185,
          volumeInput: "",
          volumeMl: null,
          volumeUnit: "mL",
          dilutionExponent: 0,
          dilutionFactor: 1,
          cfuPerMl: null,
          llodCfuPerMl: null,
          isValid: false,
        },
      };
      const csv = buildSummaryCsv(params);
      expect(csv).toContain(",,mL,0,1,,,medium,low,false,0.082,false");
    });

    it("correctly flags provisional TNTC for ultra_high density or high confluence risk", () => {
      const params: SummaryExportParams = {
        ...baseSummaryParams,
        aiCount: 450,
        quality: {
          density_level: "ultra_high",
          confluence_risk: "high",
          review_recommended: true,
          overlap_ratio: 0.38,
          reason: "Ultra high density plate.",
        },
      };
      const csv = buildSummaryCsv(params);
      expect(csv).toContain("ultra_high,high,true,0.380,true");
    });

    it("sanitizes malicious filename when generating summary CSV", () => {
      const params: SummaryExportParams = {
        ...baseSummaryParams,
        filename: "=SUM(A1:B10).jpg",
      };
      const csv = buildSummaryCsv(params);
      expect(csv).not.toContain("=SUM");
      expect(csv).toContain("SUM(A1_B10)");
    });
  });

  describe("buildDetectionsCsv", () => {
    const sampleDetections: ColonyDetection[] = [
      { x1: 10, y1: 20, x2: 30, y2: 40, confidence: 0.8954, class_id: 0, class_name: "colony" },
      { x1: 50, y1: 60, x2: 70, y2: 80, confidence: 0.421, class_id: 0, class_name: "colony" },
    ];

    const manualColonies: ManualColony[] = [
      {
        id: "manual-1",
        source: "manual",
        x: 100,
        y: 100,
        radius: 12,
        x1: 88,
        y1: 88,
        x2: 112,
        y2: 112,
        createdAt: 1718000000000,
      },
    ];

    it("accurately reports active AI, removed AI, and manual colony lineage", () => {
      const params: DetectionsExportParams = {
        filename: "dish.jpg",
        detections: sampleDetections,
        removedAiIndices: new Set([1]), // Remove second detection
        manualColonies,
      };

      const csv = buildDetectionsCsv(params);
      const lines = csv.split("\r\n");

      // Header + 2 AI + 1 Manual
      expect(lines.length).toBe(4);
      expect(lines[0]).toContain("detection_id,source,review_status,x1,y1,x2,y2,center_x,center_y,radius_px,confidence,class_name");

      // AI detection 1: active
      expect(lines[1]).toContain("1,ai_yolo,active,10,20,30,40,20,30,10,0.8954,colony");

      // AI detection 2: removed_by_reviewer with confidence preserved
      expect(lines[2]).toContain("2,ai_yolo,removed_by_reviewer,50,60,70,80,60,70,10,0.4210,colony");

      // Manual addition: manual_addition, active, empty confidence
      expect(lines[3]).toContain("manual-1,manual_addition,active,88,88,112,112,100,100,12,,colony");
    });
  });

  describe("exportSummaryCsv and exportDetectionsCsv browser download triggers", () => {
    it("triggers file download for summary CSV", () => {
      const appendSpy = vi.spyOn(document.body, "appendChild");
      const removeSpy = vi.spyOn(document.body, "removeChild");

      exportSummaryCsv({
        filename: "test.jpg",
        imageWidth: 500,
        imageHeight: 500,
        processingTimeMs: 100,
        appliedThreshold: 0.3,
        aiCount: 10,
        removedCount: 0,
        addedCount: 0,
        reviewedCount: 10,
      });

      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
    });

    it("triggers file download for detections CSV", () => {
      const appendSpy = vi.spyOn(document.body, "appendChild");
      const removeSpy = vi.spyOn(document.body, "removeChild");

      exportDetectionsCsv({
        filename: "test.jpg",
        detections: [],
      });

      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
    });
  });

  describe("Offscreen Canvas Annotated Image Compositor (generateAnnotatedPlateImage)", () => {
    it("generates blob URL and releases offscreen canvas memory buffers upon completion", async () => {
      let createdCanvas: HTMLCanvasElement | null = null;
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag.toLowerCase() === "canvas") {
          createdCanvas = el as HTMLCanvasElement;
        }
        return el;
      });

      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/annotated-mock");

      const origImage = globalThis.Image;
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        crossOrigin = "";
        naturalWidth = 800;
        naturalHeight = 800;
        decode = vi.fn().mockResolvedValue(undefined);
        set src(_val: string) {
          setTimeout(() => this.onload?.(), 0);
        }
      }
      globalThis.Image = MockImage as unknown as typeof Image;

      try {
        const url = await generateAnnotatedPlateImage({
          imageUrl: "http://example.com/plate.jpg",
          imageWidth: 800,
          imageHeight: 800,
          detections: [
            {
              x1: 100,
              y1: 100,
              x2: 150,
              y2: 150,
              confidence: 0.95,
              class_id: 0,
              class_name: "colony",
            },
          ],
          removedAiIndices: new Set(),
          manualColonies: [
            {
              id: "man-1",
              source: "manual",
              x: 200,
              y: 200,
              radius: 12,
              x1: 188,
              y1: 188,
              x2: 212,
              y2: 212,
              createdAt: 1700000000000,
            },
          ],
        });

        // Verify returned URL is a memory-efficient blob: URL rather than multi-MB base64
        expect(url).toBe("blob:http://localhost/annotated-mock");
        expect(createObjectURLSpy).toHaveBeenCalled();

        // Verify canvas dimensions were zeroed out to release backing store GPU memory
        expect(createdCanvas).not.toBeNull();
        expect(createdCanvas!.width).toBe(0);
        expect(createdCanvas!.height).toBe(0);
      } finally {
        globalThis.Image = origImage;
      }
    });

    it("rejects gracefully when specimen image fails to load", async () => {
      const origImage = globalThis.Image;
      class FailingImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        crossOrigin = "";
        set src(_val: string) {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
      globalThis.Image = FailingImage as unknown as typeof Image;

      try {
        await expect(
          generateAnnotatedPlateImage({
            imageUrl: "http://example.com/bad-plate.jpg",
            imageWidth: 800,
            imageHeight: 800,
            detections: [],
          }),
        ).rejects.toThrow("Failed to load specimen image for annotated canvas rendering.");
      } finally {
        globalThis.Image = origImage;
      }
    });
  });
});

