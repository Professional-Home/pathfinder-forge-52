import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColonyReview } from "../use-colony-review";
import type { ColonyDetection } from "@/lib/colony-api";

describe("useColonyReview hook (Manual Review Lineage)", () => {
  const createMockDetections = (count: number): ColonyDetection[] => {
    return Array.from({ length: count }, (_, i) => ({
      x1: i * 10,
      y1: i * 10,
      x2: i * 10 + 8,
      y2: i * 10 + 8,
      confidence: 0.85,
      class_id: 0,
      class_name: "colony",
    }));
  };

  it("initializes with clean baseline state", () => {
    const detections = createMockDetections(50);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 50,
      }),
    );

    expect(result.current.aiCount).toBe(50);
    expect(result.current.reviewedCount).toBe(50);
    expect(result.current.removedCount).toBe(0);
    expect(result.current.addedCount).toBe(0);
    expect(result.current.hasModifications).toBe(false);
    expect(result.current.activeTool).toBe("select");
  });

  it("removes AI detection false-positives and updates reviewed count", () => {
    const detections = createMockDetections(10);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 10,
      }),
    );

    // Toggle detection at index 2 (remove)
    act(() => {
      result.current.toggleAiDetection(2);
    });

    expect(result.current.removedCount).toBe(1);
    expect(result.current.removedAiIndices.has(2)).toBe(true);
    expect(result.current.reviewedCount).toBe(9);
    expect(result.current.hasModifications).toBe(true);

    // Toggle detection at index 5 (remove)
    act(() => {
      result.current.toggleAiDetection(5);
    });

    expect(result.current.removedCount).toBe(2);
    expect(result.current.reviewedCount).toBe(8);
  });

  it("restores previously removed AI detection when toggled again", () => {
    const detections = createMockDetections(10);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 10,
      }),
    );

    // Remove index 3
    act(() => {
      result.current.toggleAiDetection(3);
    });
    expect(result.current.reviewedCount).toBe(9);

    // Restore index 3
    act(() => {
      result.current.toggleAiDetection(3);
    });
    expect(result.current.removedCount).toBe(0);
    expect(result.current.removedAiIndices.has(3)).toBe(false);
    expect(result.current.reviewedCount).toBe(10);
    expect(result.current.hasModifications).toBe(false);
  });

  it("adds and removes manual colonies and accurately reflects in reviewed count", () => {
    const detections = createMockDetections(20);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 20,
        imageWidth: 800,
        imageHeight: 800,
      }),
    );

    // Add 2 manual colonies
    act(() => {
      result.current.addManualColony({ x: 150, y: 200 });
      result.current.addManualColony({ x: 300, y: 400 });
    });

    expect(result.current.addedCount).toBe(2);
    expect(result.current.manualColonies.length).toBe(2);
    expect(result.current.reviewedCount).toBe(22);
    expect(result.current.hasModifications).toBe(true);

    const firstManualId = result.current.manualColonies[0].id;

    // Remove one manual colony
    act(() => {
      result.current.removeManualColony(firstManualId);
    });

    expect(result.current.addedCount).toBe(1);
    expect(result.current.reviewedCount).toBe(21);
  });

  it("strictly follows the production formula: reviewed = AI - removed + added", () => {
    const detections = createMockDetections(150);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 150,
      }),
    );

    // Remove 5 AI colonies
    act(() => {
      result.current.toggleAiDetection(0);
      result.current.toggleAiDetection(1);
      result.current.toggleAiDetection(2);
      result.current.toggleAiDetection(3);
      result.current.toggleAiDetection(4);
    });

    // Add 3 manual colonies
    act(() => {
      result.current.addManualColony({ x: 50, y: 50 });
      result.current.addManualColony({ x: 60, y: 60 });
      result.current.addManualColony({ x: 70, y: 70 });
    });

    // 150 - 5 + 3 = 148
    expect(result.current.aiCount).toBe(150);
    expect(result.current.removedCount).toBe(5);
    expect(result.current.addedCount).toBe(3);
    expect(result.current.reviewedCount).toBe(148);
  });

  it("clamps reviewed count to non-negative when removals exceed count", () => {
    const detections = createMockDetections(1);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 0, // Baseline AI count is 0
      }),
    );

    act(() => {
      result.current.toggleAiDetection(0); // 1 removal
    });

    // max(0, 0 - 1 + 0) = 0
    expect(result.current.reviewedCount).toBe(0);
  });

  it("resets review back to clean baseline state when resetReview is called", () => {
    const detections = createMockDetections(30);
    const { result } = renderHook(() =>
      useColonyReview({
        aiDetections: detections,
        aiCount: 30,
      }),
    );

    act(() => {
      result.current.toggleAiDetection(1);
      result.current.addManualColony({ x: 100, y: 100 });
      result.current.setActiveTool("add");
    });

    expect(result.current.hasModifications).toBe(true);

    act(() => {
      result.current.resetReview();
    });

    expect(result.current.removedCount).toBe(0);
    expect(result.current.addedCount).toBe(0);
    expect(result.current.reviewedCount).toBe(30);
    expect(result.current.hasModifications).toBe(false);
    expect(result.current.activeTool).toBe("select");
  });
});
