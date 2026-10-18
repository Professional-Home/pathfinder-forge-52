/**
 * Colony Results Export Utilities
 *
 * Implements client-side, zero-dependency CSV export (Summary & Detections)
 * and offscreen HTML5 canvas specimen annotation for printable PDF lab reports.
 */

import type { ColonyDetection, ColonyQualityAssessment } from "./colony-api";
import type { ManualColony } from "@/hooks/use-colony-review";

// ─── Export Data Contracts ───────────────────────────────────────────────────

export interface CfuExportData {
  countSource: "reviewed" | "ai" | "custom";
  activeCount: number | null;
  volumeInput: string;
  volumeMl: number | null;
  volumeUnit: "mL" | "uL";
  dilutionExponent: number;
  dilutionFactor: number;
  cfuPerMl: number | null;
  llodCfuPerMl: number | null;
  isValid: boolean;
}

export interface SummaryExportParams {
  filename?: string | null;
  timestamp?: string;
  imageWidth: number;
  imageHeight: number;
  processingTimeMs: number;
  appliedThreshold: number;
  aiCount: number;
  removedCount: number;
  addedCount: number;
  reviewedCount: number;
  quality?: ColonyQualityAssessment;
  cfuData?: CfuExportData | null;
}

export interface DetectionsExportParams {
  filename?: string | null;
  timestamp?: string;
  detections: ColonyDetection[];
  removedAiIndices?: Set<number>;
  manualColonies?: ManualColony[];
}

export interface AnnotatedImageParams {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  detections: ColonyDetection[];
  removedAiIndices?: Set<number>;
  manualColonies?: ManualColony[];
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Sanitizes an image filename into a clean, filesystem-safe basename without extension.
 * Strips any directory traversal patterns, system paths, unsafe characters,
 * and dangerous leading spreadsheet formula triggers (=, +, -, @, tab, carriage return).
 */
export function sanitizeFilename(filename?: string | null, fallback = "specimen"): string {
  if (!filename || typeof filename !== "string") return fallback;
  // Extract basename if full path was mistakenly passed
  const base = filename.replace(/^.*[\\/]/, "");
  // Remove file extension
  const withoutExt = base.replace(/\.[^/.]+$/, "");
  // Replace filesystem-unsafe characters, control characters (including tabs and CR), and whitespace with underscore
  let sanitized = withoutExt.replace(/[<>:"/\\|?*\x00-\x1F\s]+/g, "_");
  // Strip dangerous leading spreadsheet formula characters (=, +, -, @, \t, \r) and leading/trailing underscores
  sanitized = sanitized.replace(/^[=+\-@\t\r_]+/, "").replace(/_+$/, "");
  return sanitized || fallback;
}

/** Formats a numeric value into raw, standard scientific notation with 2-digit exponent (e.g. 1.83E+06) */
export function formatRawScientific(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "";
  if (val === 0) return "0";
  const str = val.toExponential(2).toUpperCase();
  // Standardize single-digit exponent (e.g. 1.83E+6 -> 1.83E+06)
  return str.replace(/E([+-])(\d)$/, (_, sign, digit) => `E${sign}0${digit}`);
}

/** Escapes a single CSV cell according to RFC 4180 */
export function escapeCsvCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  const str = String(cell);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serializes a 2D matrix of cells into an RFC 4180 compliant CSV string with UTF-8 BOM */
export function serializeCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  // \uFEFF is the UTF-8 Byte Order Mark for Excel compatibility
  return "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Triggers a browser-native programmatic file download from a string payload */
export function triggerFileDownload(
  content: string,
  filename: string,
  mimeType = "text/csv;charset=utf-8;",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ─── Summary CSV Export ──────────────────────────────────────────────────────

/**
 * Builds the RFC 4180 compliant CSV string for the colony analysis summary.
 * Preserves exact count lineage, provenance, CFU calculations, and plate quality metrics.
 */
export function buildSummaryCsv(params: SummaryExportParams): string {
  const {
    filename,
    timestamp = new Date().toISOString(),
    imageWidth,
    imageHeight,
    processingTimeMs,
    appliedThreshold,
    aiCount,
    removedCount,
    addedCount,
    reviewedCount,
    quality,
    cfuData,
  } = params;

  const sampleId = sanitizeFilename(filename, "specimen");

  // Determine effective count source and count used
  const countSource = cfuData?.countSource ?? (removedCount > 0 || addedCount > 0 ? "reviewed" : "ai");
  const countUsed =
    cfuData?.activeCount !== undefined && cfuData?.activeCount !== null
      ? cfuData.activeCount
      : countSource === "reviewed"
        ? reviewedCount
        : aiCount;

  const countSourceProvenance =
    countSource === "reviewed"
      ? "Using human-reviewed count"
      : countSource === "ai"
        ? "Using automated AI count"
        : "Using custom laboratory count";

  const densityLevel =
    quality?.density_level ??
    (aiCount > 400 ? "ultra_high" : aiCount > 200 ? "high" : aiCount >= 50 ? "medium" : "low");
  const confluenceRisk = quality?.confluence_risk ?? (aiCount > 200 ? "high" : "low");
  const reviewRecommended = quality?.review_recommended ?? aiCount > 200;
  const isProvisionalTntc = densityLevel === "ultra_high" || confluenceRisk === "high";

  const headers = [
    "sample_id",
    "analysis_timestamp_utc",
    "image_width_px",
    "image_height_px",
    "processing_time_ms",
    "confidence_threshold",
    "ai_colony_count",
    "removed_ai_count",
    "manual_added_count",
    "reviewed_colony_count",
    "selected_count_source",
    "count_used",
    "count_source_provenance",
    "plated_volume_ml",
    "volume_unit",
    "dilution_exponent",
    "dilution_factor",
    "calculated_cfu_per_ml",
    "llod_cfu_per_ml",
    "density_level",
    "confluence_risk",
    "review_recommended",
    "colony_overlap_ratio",
    "is_provisional_tntc",
    "model_name",
    "software_version",
  ];

  const dataRow = [
    sampleId,
    timestamp,
    imageWidth,
    imageHeight,
    processingTimeMs,
    appliedThreshold.toFixed(2),
    aiCount,
    removedCount,
    addedCount,
    reviewedCount,
    countSource,
    countUsed,
    countSourceProvenance,
    cfuData?.volumeMl !== null && cfuData?.volumeMl !== undefined ? cfuData.volumeMl : "",
    cfuData?.volumeUnit ?? "",
    cfuData?.dilutionExponent !== undefined ? cfuData.dilutionExponent : "",
    cfuData?.dilutionFactor !== undefined ? cfuData.dilutionFactor : "",
    formatRawScientific(cfuData?.cfuPerMl),
    formatRawScientific(cfuData?.llodCfuPerMl),
    densityLevel,
    confluenceRisk,
    String(reviewRecommended),
    quality?.overlap_ratio !== undefined ? quality.overlap_ratio.toFixed(3) : "",
    String(isProvisionalTntc),
    "YOLO11n Colony Detector",
    "Micrylis Biotech Colony Counter v1.0",
  ];

  return serializeCsv([headers, dataRow]);
}

/**
 * Generates and downloads a single-row Summary CSV of the colony analysis.
 * Preserves exact count lineage, provenance, CFU calculations, and plate quality metrics.
 */
export function exportSummaryCsv(params: SummaryExportParams): void {
  const sampleId = sanitizeFilename(params.filename, "specimen");
  const csvString = buildSummaryCsv(params);
  const downloadFilename = `${sampleId}-summary.csv`;
  triggerFileDownload(csvString, downloadFilename);
}

// ─── Detection-Level CSV Export ──────────────────────────────────────────────

/**
 * Builds the RFC 4180 compliant multi-row CSV string containing all individual colony detections
 * and manual additions with exact bounding boxes, centers, radius, and confidence.
 */
export function buildDetectionsCsv(params: DetectionsExportParams): string {
  const { detections, removedAiIndices = new Set(), manualColonies = [] } = params;

  const headers = [
    "detection_id",
    "source",
    "review_status",
    "x1",
    "y1",
    "x2",
    "y2",
    "center_x",
    "center_y",
    "radius_px",
    "confidence",
    "class_name",
  ];

  const rows: (string | number)[][] = [headers];

  // 1. AI Detections
  detections.forEach((det, index) => {
    const isRemoved = removedAiIndices.has(index);
    const boxW = Math.max(1, det.x2 - det.x1);
    const boxH = Math.max(1, det.y2 - det.y1);
    const centerX = Number((det.x1 + boxW / 2).toFixed(1));
    const centerY = Number((det.y1 + boxH / 2).toFixed(1));
    const radiusPx = Number((Math.max(boxW, boxH) / 2).toFixed(1));

    rows.push([
      index + 1,
      "ai_yolo",
      isRemoved ? "removed_by_reviewer" : "active",
      det.x1,
      det.y1,
      det.x2,
      det.y2,
      centerX,
      centerY,
      radiusPx,
      det.confidence.toFixed(4),
      det.class_name || "colony",
    ]);
  });

  // 2. Manual Additions
  manualColonies.forEach((colony, mIndex) => {
    rows.push([
      `manual-${mIndex + 1}`,
      "manual_addition",
      "active",
      colony.x1,
      colony.y1,
      colony.x2,
      colony.y2,
      colony.x,
      colony.y,
      colony.radius,
      "", // No confidence invented for manual markings
      "colony",
    ]);
  });

  return serializeCsv(rows);
}

/**
 * Generates and downloads a multi-row CSV containing all individual colony detections
 * and manual additions with exact bounding boxes, centers, radius, and confidence.
 */
export function exportDetectionsCsv(params: DetectionsExportParams): void {
  const sampleId = sanitizeFilename(params.filename, "specimen");
  const csvString = buildDetectionsCsv(params);
  const downloadFilename = `${sampleId}-detections.csv`;
  triggerFileDownload(csvString, downloadFilename);
}

// ─── Offscreen Canvas Image Compositor ───────────────────────────────────────

/**
 * Renders the specimen image and active annotations into an offscreen HTML5 Canvas
 * at full 1:1 native resolution, independent of DOM zoom/pan matrix.
 *
 * Excludes removed false-positive AI detections and includes manual colony reticles.
 * Returns a high-fidelity PNG Data URL suitable for print and report embedding.
 */
export async function generateAnnotatedPlateImage(params: AnnotatedImageParams): Promise<string> {
  const { imageUrl, imageWidth, imageHeight, detections, removedAiIndices = new Set(), manualColonies = [] } =
    params;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      img.onload = null;
      img.onerror = null;
      let canvas: HTMLCanvasElement | null = null;
      try {
        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch {
            // Safe fallback if decode() rejects
          }
        }

        const width = imageWidth > 0 ? imageWidth : img.naturalWidth || 1024;
        const height = imageHeight > 0 ? imageHeight : img.naturalHeight || 1024;

        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to obtain 2D canvas context for annotated image rendering.");
        }

        // 1. Draw base specimen image at 1:1 scale
        ctx.drawImage(img, 0, 0, width, height);

        const baseStrokeWidth = Math.max(2, Math.round(width / 400));
        const labelFontSize = Math.max(11, Math.round(width / 70));
        const labelPaddingX = Math.round(labelFontSize * 0.4);
        const labelHeight = Math.round(labelFontSize * 1.5);

        // 2. Render active AI detections (excluded removed detections)
        detections.forEach((det, index) => {
          if (removedAiIndices.has(index)) {
            return;
          }

          const boxWidth = Math.max(1, det.x2 - det.x1);
          const boxHeight = Math.max(1, det.y2 - det.y1);
          const confidencePct = Math.round(det.confidence * 100);

          // Emerald bounding box
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = baseStrokeWidth;
          ctx.fillStyle = "rgba(16, 185, 129, 0.15)";

          ctx.beginPath();
          ctx.rect(det.x1, det.y1, boxWidth, boxHeight);
          ctx.fill();
          ctx.stroke();

          // Label tag
          const labelText = `colony ${confidencePct}%`;
          ctx.font = `600 ${labelFontSize}px monospace, ui-monospace`;
          const textMetrics = ctx.measureText(labelText);
          const estLabelWidth = textMetrics.width + labelPaddingX * 2;
          const labelY = det.y1 - labelHeight >= 0 ? det.y1 - labelHeight - 2 : det.y2 + 2;
          const labelX = Math.max(0, det.x1);

          ctx.fillStyle = "#10b981";
          ctx.fillRect(labelX, labelY, estLabelWidth, labelHeight);

          ctx.fillStyle = "#ffffff";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, labelX + labelPaddingX, labelY + labelHeight / 2);
        });

        // 3. Render manual colony reticles
        manualColonies.forEach((colony, mIndex) => {
          const strokeColor = "#8b5cf6";
          const fillColor = "rgba(139, 92, 246, 0.25)";

          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(2, Math.round(baseStrokeWidth * 1.2));
          ctx.fillStyle = fillColor;

          // Outer reticle circle
          ctx.beginPath();
          ctx.arc(colony.x, colony.y, colony.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Center dot
          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.arc(colony.x, colony.y, Math.max(2, Math.round(baseStrokeWidth * 0.7)), 0, Math.PI * 2);
          ctx.fill();

          // Crosshairs
          ctx.lineWidth = Math.max(1, Math.round(baseStrokeWidth * 0.6));
          ctx.beginPath();
          ctx.moveTo(colony.x - colony.radius * 0.55, colony.y);
          ctx.lineTo(colony.x + colony.radius * 0.55, colony.y);
          ctx.moveTo(colony.x, colony.y - colony.radius * 0.55);
          ctx.lineTo(colony.x, colony.y + colony.radius * 0.55);
          ctx.stroke();

          // Label tag
          const labelText = `Manual #${mIndex + 1}`;
          ctx.font = `600 ${labelFontSize}px monospace, ui-monospace`;
          const textMetrics = ctx.measureText(labelText);
          const estLabelWidth = textMetrics.width + labelPaddingX * 2;
          const labelY =
            colony.y - colony.radius - labelHeight - 2 >= 0
              ? colony.y - colony.radius - labelHeight - 2
              : colony.y + colony.radius + 2;
          const labelX = Math.max(0, colony.x - estLabelWidth / 2);

          ctx.fillStyle = strokeColor;
          ctx.fillRect(labelX, labelY, estLabelWidth, labelHeight);

          ctx.fillStyle = "#ffffff";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, labelX + labelPaddingX, labelY + labelHeight / 2);
        });

        // Convert canvas to Blob URL to prevent heap memory exhaustion from multi-megabyte Base64 strings
        if (typeof canvas.toBlob === "function") {
          canvas.toBlob((blob) => {
            try {
              if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                if (canvas) {
                  canvas.width = 0;
                  canvas.height = 0;
                  canvas = null;
                }
                resolve(blobUrl);
              } else {
                const dataUrl = canvas!.toDataURL("image/png");
                if (canvas) {
                  canvas.width = 0;
                  canvas.height = 0;
                  canvas = null;
                }
                resolve(dataUrl);
              }
            } catch (blobErr) {
              if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
                canvas = null;
              }
              reject(blobErr);
            }
          }, "image/png");
        } else {
          const dataUrl = canvas.toDataURL("image/png");
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
          resolve(dataUrl);
        }
      } catch (err) {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas = null;
        }
        reject(err);
      }
    };

    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      reject(new Error("Failed to load specimen image for annotated canvas rendering."));
    };

    img.src = imageUrl;
  });
}
