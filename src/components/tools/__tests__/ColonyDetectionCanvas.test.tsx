import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColonyDetectionCanvas } from "../ColonyDetectionCanvas";
import type { ColonyDetection, ColonyImageMetadata } from "@/lib/colony-api";
import type { ManualColony } from "@/hooks/use-colony-review";

describe("ColonyDetectionCanvas Keyboard Accessibility (Phase 6C-2)", () => {
  const mockImageMetadata: ColonyImageMetadata = {
    width: 800,
    height: 800,
  };

  const mockDetections: ColonyDetection[] = [
    {
      x1: 100,
      y1: 100,
      x2: 150,
      y2: 150,
      confidence: 0.95,
      class_id: 0,
      class_name: "colony",
    },
    {
      x1: 200,
      y1: 200,
      x2: 240,
      y2: 240,
      confidence: 0.82,
      class_id: 0,
      class_name: "colony",
    },
  ];

  const mockManualColonies: ManualColony[] = [
    {
      id: "manual-1",
      source: "manual",
      x: 300,
      y: 300,
      radius: 12,
      x1: 288,
      y1: 288,
      x2: 312,
      y2: 312,
      createdAt: 1718000000000,
    },
  ];

  it("renders AI detections as keyboard-focusable interactive elements with accessible attributes", () => {
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="select"
      />,
    );

    const det0 = screen.getByTestId("ai-colony-det-0");
    const det1 = screen.getByTestId("ai-colony-det-1");

    expect(det0).toHaveAttribute("role", "button");
    expect(det0).toHaveAttribute("tabindex", "0");
    expect(det0).toHaveAttribute("aria-pressed", "true");
    expect(det0).toHaveAttribute("aria-label");
    expect(det0.getAttribute("aria-label")).toMatch(/Colony detection 1: active \(95% confidence\)/i);

    expect(det1).toHaveAttribute("role", "button");
    expect(det1).toHaveAttribute("tabindex", "0");
    expect(det1).toHaveAttribute("aria-pressed", "true");
    expect(det1.getAttribute("aria-label")).toMatch(/Colony detection 2: active \(82% confidence\)/i);
  });

  it("displays visual focus ring when AI detection is focused via keyboard", async () => {
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="select"
      />,
    );

    const det0 = screen.getByTestId("ai-colony-det-0");

    // Initially no focus ring
    expect(screen.queryByTestId("ai-focus-ring-0")).not.toBeInTheDocument();

    // Focus the detection element
    fireEvent.focus(det0);
    expect(screen.getByTestId("ai-focus-ring-0")).toBeInTheDocument();

    // Blur removes the focus ring
    fireEvent.blur(det0);
    expect(screen.queryByTestId("ai-focus-ring-0")).not.toBeInTheDocument();
  });

  it("toggles AI detection review/removal when Enter key is pressed", () => {
    const onToggle = vi.fn();
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="select"
        onToggleAiDetection={onToggle}
      />,
    );

    const det0 = screen.getByTestId("ai-colony-det-0");
    fireEvent.focus(det0);

    // Press Enter
    fireEvent.keyDown(det0, { key: "Enter" });
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it("toggles AI detection review/removal when Space key is pressed and prevents page scroll", () => {
    const onToggle = vi.fn();
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="select"
        onToggleAiDetection={onToggle}
      />,
    );

    const det1 = screen.getByTestId("ai-colony-det-1");
    fireEvent.focus(det1);

    // Press Space via fireEvent
    fireEvent.keyDown(det1, { key: " " });

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it("reflects removed state with aria-pressed='false' and updated accessible label", () => {
    const removedSet = new Set([0]);
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        removedAiIndices={removedSet}
        activeTool="select"
      />,
    );

    const det0 = screen.getByTestId("ai-colony-det-0");
    const det1 = screen.getByTestId("ai-colony-det-1");

    // Detection 0 is removed
    expect(det0).toHaveAttribute("aria-pressed", "false");
    expect(det0.getAttribute("aria-label")).toMatch(/Colony detection 1: removed/i);
    expect(det0.getAttribute("aria-label")).toMatch(/Press Enter or Space to restore/i);

    // Detection 1 is still active
    expect(det1).toHaveAttribute("aria-pressed", "true");
    expect(det1.getAttribute("aria-label")).toMatch(/Colony detection 2: active/i);
  });

  it("supports keyboard focus and removal for manual colonies", () => {
    const onRemoveManual = vi.fn();
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        manualColonies={mockManualColonies}
        activeTool="select"
        onRemoveManualColony={onRemoveManual}
      />,
    );

    const manual0 = screen.getByTestId("manual-colony-manual-1");
    expect(manual0).toHaveAttribute("role", "button");
    expect(manual0).toHaveAttribute("tabindex", "0");
    expect(manual0.getAttribute("aria-label")).toMatch(/Manual colony marker #1/i);

    // Focus displays manual focus ring
    fireEvent.focus(manual0);
    expect(screen.getByTestId("manual-focus-ring-manual-1")).toBeInTheDocument();

    // Press Enter to remove
    fireEvent.keyDown(manual0, { key: "Enter" });
    expect(onRemoveManual).toHaveBeenCalledTimes(1);
    expect(onRemoveManual).toHaveBeenCalledWith("manual-1");

    // Press Space to remove
    fireEvent.keyDown(manual0, { key: " " });
    expect(onRemoveManual).toHaveBeenCalledTimes(2);
  });

  it("displays accessible tool guidance banner and status for Select and Add modes", () => {
    const { rerender } = render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="select"
        reviewedCount={2}
      />,
    );

    const statusBanner = screen.getByRole("status");
    expect(statusBanner).toHaveAttribute("aria-live", "polite");
    expect(statusBanner).toHaveTextContent(/Select Mode:/i);
    expect(statusBanner).toHaveTextContent(/Reviewed: 2/i);

    // Switch to Add Colony mode
    rerender(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="add"
        reviewedCount={3}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Add Colony Mode:/i);
    expect(screen.getByRole("status")).toHaveTextContent(/Reviewed: 3/i);
  });

  it("does not toggle AI detections when activeTool is 'add'", () => {
    const onToggle = vi.fn();
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        activeTool="add"
        onToggleAiDetection={onToggle}
      />,
    );

    const det0 = screen.getByTestId("ai-colony-det-0");
    fireEvent.keyDown(det0, { key: "Enter" });
    fireEvent.keyDown(det0, { key: " " });

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("renders non-color exclusion indicators (✕ badge and label) on removed AI detections", () => {
    const removedSet = new Set([0]);
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        removedAiIndices={removedSet}
        activeTool="select"
      />,
    );

    // Non-color exclusion indicator: '✕' badge
    expect(screen.getByTestId("ai-excluded-badge-0")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-excluded-badge-1")).not.toBeInTheDocument();

    // Non-color label cue
    expect(screen.getByText("EXCLUDED (✕)")).toBeInTheDocument();
  });

  it("renders distinctive non-color visual markers (reticle crosshairs and + label) for manual colonies", () => {
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        manualColonies={mockManualColonies}
        activeTool="select"
      />,
    );

    // Non-color label cue for manual colonies
    expect(screen.getByText("Manual (+)")).toBeInTheDocument();

    const manualColonyG = screen.getByTestId("manual-colony-manual-1");
    // Verify circular shape and reticle crosshairs lines are present
    const circles = manualColonyG.querySelectorAll("circle");
    const lines = manualColonyG.querySelectorAll("line");
    expect(circles.length).toBeGreaterThanOrEqual(2); // Reticle halo + reticle + center dot
    expect(lines.length).toBeGreaterThanOrEqual(2); // Crosshair lines
  });

  it("renders accessible visual legend with all 4 review states and non-color descriptions", () => {
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:http://localhost/sample.jpg"
        detections={mockDetections}
        imageMetadata={mockImageMetadata}
        manualColonies={mockManualColonies}
        activeTool="select"
        reviewedCount={3}
      />,
    );

    const legendRegion = screen.getByRole("region", { name: /Colony review visual legend/i });
    expect(legendRegion).toBeInTheDocument();

    // 1. AI Active Detection
    const aiActiveLegend = screen.getByTestId("legend-ai-active");
    expect(aiActiveLegend).toHaveTextContent("AI Detected");
    expect(aiActiveLegend).toHaveTextContent("(Solid Box)");

    // 2. AI Excluded
    const aiExcludedLegend = screen.getByTestId("legend-ai-excluded");
    expect(aiExcludedLegend).toHaveTextContent("Excluded");
    expect(aiExcludedLegend).toHaveTextContent("(Dashed + ✕)");

    // 3. Manual
    const manualLegend = screen.getByTestId("legend-manual");
    expect(manualLegend).toHaveTextContent("Manual");
    expect(manualLegend).toHaveTextContent("(Reticle +)");

    // 4. Focus
    const focusLegend = screen.getByTestId("legend-focus");
    expect(focusLegend).toHaveTextContent("Focused");
    expect(focusLegend).toHaveTextContent("(Tab / Ring)");
  });

  describe("Review Guidance and Interaction Clarity", () => {
    it("renders compact review guidance card when detections exist with clear, non-technical instructions", () => {
      render(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          activeTool="select"
        />,
      );

      const guidanceCard = screen.getByTestId("canvas-review-guidance");
      expect(guidanceCard).toBeInTheDocument();
      expect(guidanceCard).toHaveAttribute("aria-label", "How to review colony detections");

      // Verify header and empty state factual notice
      expect(guidanceCard).toHaveTextContent("Review detections");
      expect(guidanceCard).toHaveTextContent("Review the highlighted detections before using the final count.");

      // Verify all 4 non-technical guidance points
      expect(guidanceCard).toHaveTextContent("Select an AI marker to remove a false detection.");
      expect(guidanceCard).toHaveTextContent("Select a removed marker to restore it.");
      expect(guidanceCard).toHaveTextContent("Switch to Add Colony to mark a colony the AI missed.");
      expect(guidanceCard).toHaveTextContent("Use the mouse, touch, or keyboard to review detections.");
    });

    it("displays breakdown of reviewed count in guidance header when human modifications exist", () => {
      render(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          removedAiIndices={new Set([0])}
          manualColonies={mockManualColonies}
          activeTool="select"
          reviewedCount={2}
        />,
      );

      const guidanceCard = screen.getByTestId("canvas-review-guidance");
      expect(guidanceCard).toHaveTextContent("AI: 2 · Removed: 1 · Manual: +1 · Reviewed: 2");
    });

    it("makes Select and Add Colony modes programmatically identifiable with aria and data attributes", () => {
      const onSetActiveTool = vi.fn();
      const { rerender } = render(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          activeTool="select"
          onSetActiveTool={onSetActiveTool}
        />,
      );

      const selectBtn = screen.getByTestId("tool-select-button");
      const addBtn = screen.getByTestId("tool-add-button");

      // In select mode
      expect(selectBtn).toHaveAttribute("role", "radio");
      expect(selectBtn).toHaveAttribute("aria-checked", "true");
      expect(selectBtn).toHaveAttribute("aria-pressed", "true");
      expect(selectBtn).toHaveAttribute("data-state", "active");

      expect(addBtn).toHaveAttribute("role", "radio");
      expect(addBtn).toHaveAttribute("aria-checked", "false");
      expect(addBtn).toHaveAttribute("aria-pressed", "false");
      expect(addBtn).toHaveAttribute("data-state", "inactive");

      // Switch to add mode
      rerender(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          activeTool="add"
          onSetActiveTool={onSetActiveTool}
        />,
      );

      expect(selectBtn).toHaveAttribute("aria-checked", "false");
      expect(selectBtn).toHaveAttribute("aria-pressed", "false");
      expect(selectBtn).toHaveAttribute("data-state", "inactive");

      expect(addBtn).toHaveAttribute("aria-checked", "true");
      expect(addBtn).toHaveAttribute("aria-pressed", "true");
      expect(addBtn).toHaveAttribute("data-state", "active");
    });

    it("displays contextual instructions and discoverable keyboard guidance", () => {
      const { rerender } = render(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          activeTool="select"
          reviewedCount={2}
        />,
      );

      // Select mode contextual & keyboard text
      const statusBanner = screen.getByRole("status");
      expect(statusBanner).toHaveTextContent(/Select Mode:/i);
      expect(statusBanner).toHaveTextContent(/Select a detection to remove or restore it/i);
      expect(statusBanner).toHaveTextContent(/Tab to a detection\. Press Enter or Space to toggle it/i);

      // Add mode contextual text
      rerender(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          activeTool="add"
          reviewedCount={2}
        />,
      );

      expect(statusBanner).toHaveTextContent(/Add Colony Mode:/i);
      expect(statusBanner).toHaveTextContent(/Click or tap a colony location on the agar image to add it/i);
    });

    it("does not create duplicate interactive controls in review guidance", () => {
      render(
        <ColonyDetectionCanvas
          originalImageUrl="blob:http://localhost/sample.jpg"
          detections={mockDetections}
          imageMetadata={mockImageMetadata}
          activeTool="select"
        />,
      );

      const guidanceCard = screen.getByTestId("canvas-review-guidance");
      // Guidance area should only provide informational list items, not redundant actionable buttons or inputs
      expect(guidanceCard.querySelectorAll("button").length).toBe(0);
      expect(guidanceCard.querySelectorAll("input").length).toBe(0);
    });
  });
});
