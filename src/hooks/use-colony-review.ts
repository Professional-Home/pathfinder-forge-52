import * as React from "react";
import type { ColonyDetection } from "@/lib/colony-api";

export type ReviewTool = "select" | "add";

/** Represents a manually annotated colony marker placed by a human reviewer */
export interface ManualColony {
  /** Unique client-side identifier (e.g. manual-1718000000000-abcde) */
  id: string;
  /** Provenance marker identifying this colony as human-reviewed */
  source: "manual";
  /** Center X coordinate in natural image space (pixels) */
  x: number;
  /** Center Y coordinate in natural image space (pixels) */
  y: number;
  /** Colony marker radius in natural image space (pixels) */
  radius: number;
  /** Bounding box representation for future lab-report / CSV export compatibility */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Creation timestamp in milliseconds */
  createdAt: number;
}

export interface UseColonyReviewOptions {
  /** Immutable original AI detections from the API response */
  aiDetections?: ColonyDetection[];
  /** Immutable original AI count from the API response */
  aiCount?: number;
  /** Specimen natural image width for bounding box clamping and adaptive marker sizing */
  imageWidth?: number;
  /** Specimen natural image height for bounding box clamping */
  imageHeight?: number;
}

export interface ColonyReviewState {
  /** Original immutable detections from AI inference */
  aiDetections: ColonyDetection[];
  /** Set of original detection array indices marked as removed */
  removedAiIndices: Set<number>;
  /** User-added manual colonies */
  manualColonies: ManualColony[];
  /** Active review tool: "select" or "add" */
  activeTool: ReviewTool;
  /** Original automated count reported by AI (immutable baseline) */
  aiCount: number;
  /** Human-reviewed colony count: max(0, aiCount - removedCount + addedCount) */
  reviewedCount: number;
  /** Number of AI detections flagged as false positives / removed */
  removedCount: number;
  /** Number of manual colonies added by reviewer */
  addedCount: number;
  /** Whether any human adjustments have been made relative to AI baseline */
  hasModifications: boolean;
}

export interface UseColonyReviewReturn extends ColonyReviewState {
  /** Switch active review tool between "select" and "add" */
  setActiveTool: (tool: ReviewTool) => void;
  /** Toggle an AI detection between active and removed state */
  toggleAiDetection: (index: number) => void;
  /** Add a manual colony at specified image-space coordinates */
  addManualColony: (coords: { x: number; y: number; radius?: number }) => void;
  /** Remove a previously added manual colony by ID */
  removeManualColony: (id: string) => void;
  /** Reset all manual corrections back to original AI baseline */
  resetReview: () => void;
}

/**
 * Custom hook managing the human-in-the-loop colony review layer.
 *
 * Preserves the original automated AI detections as an immutable baseline,
 * computing a derived Reviewed Count based on user removals and manual additions.
 */
const EMPTY_DETECTIONS: ColonyDetection[] = [];

export function useColonyReview({
  aiDetections = EMPTY_DETECTIONS,
  aiCount = 0,
  imageWidth = 1024,
  imageHeight = 1024,
}: UseColonyReviewOptions): UseColonyReviewReturn {
  const [removedAiIndices, setRemovedAiIndices] = React.useState<Set<number>>(() => new Set());
  const [manualColonies, setManualColonies] = React.useState<ManualColony[]>([]);
  const [activeTool, setActiveTool] = React.useState<ReviewTool>("select");

  // Reset review state whenever the underlying AI detections baseline changes (e.g. new image analysis)
  const prevDetectionsRef = React.useRef(aiDetections);
  React.useEffect(() => {
    if (prevDetectionsRef.current !== aiDetections) {
      const wasEmpty = !prevDetectionsRef.current || prevDetectionsRef.current.length === 0;
      const isEmpty = !aiDetections || aiDetections.length === 0;
      prevDetectionsRef.current = aiDetections;

      // Avoid wiping review state if both previous and current are empty (e.g. unrelated renders on empty state)
      if (wasEmpty && isEmpty) {
        return;
      }

      setRemovedAiIndices(new Set());
      setManualColonies([]);
      setActiveTool("select");
    }
  }, [aiDetections]);

  // Toggle an AI detection: if active -> mark removed; if removed -> restore
  const toggleAiDetection = React.useCallback((index: number) => {
    setRemovedAiIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Add a manual colony marker in image coordinates
  const addManualColony = React.useCallback(
    ({ x, y, radius }: { x: number; y: number; radius?: number }) => {
      const imgW = imageWidth > 0 ? imageWidth : 1024;
      const imgH = imageHeight > 0 ? imageHeight : 1024;

      // Adaptive marker radius based on image resolution (approx 1.5% of width, min 8px, max 40px)
      const effectiveRadius =
        typeof radius === "number" && radius > 0
          ? radius
          : Math.min(40, Math.max(8, Math.round(imgW / 70)));

      // Clamped bounding box in image coordinates
      const clampedX = Math.max(0, Math.min(imgW, Math.round(x)));
      const clampedY = Math.max(0, Math.min(imgH, Math.round(y)));
      const x1 = Math.max(0, clampedX - effectiveRadius);
      const y1 = Math.max(0, clampedY - effectiveRadius);
      const x2 = Math.min(imgW, clampedX + effectiveRadius);
      const y2 = Math.min(imgH, clampedY + effectiveRadius);

      const newColony: ManualColony = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        source: "manual",
        x: clampedX,
        y: clampedY,
        radius: effectiveRadius,
        x1,
        y1,
        x2,
        y2,
        createdAt: Date.now(),
      };

      setManualColonies((prev) => [...prev, newColony]);
    },
    [imageWidth, imageHeight],
  );

  // Remove a manual colony by ID
  const removeManualColony = React.useCallback((id: string) => {
    setManualColonies((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Reset all human adjustments to clean state
  const resetReview = React.useCallback(() => {
    setRemovedAiIndices(new Set());
    setManualColonies([]);
    setActiveTool("select");
  }, []);

  // Derived counts: Reviewed Count = max(0, AI Count - Removed + Added)
  const effectiveAiCount = typeof aiCount === "number" ? aiCount : aiDetections.length;
  const removedCount = removedAiIndices.size;
  const addedCount = manualColonies.length;
  const reviewedCount = Math.max(0, effectiveAiCount - removedCount + addedCount);
  const hasModifications = removedCount > 0 || addedCount > 0;

  return {
    aiDetections,
    removedAiIndices,
    manualColonies,
    activeTool,
    aiCount: effectiveAiCount,
    reviewedCount,
    removedCount,
    addedCount,
    hasModifications,
    setActiveTool,
    toggleAiDetection,
    addManualColony,
    removeManualColony,
    resetReview,
  };
}
