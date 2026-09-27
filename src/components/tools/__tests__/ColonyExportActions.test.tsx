import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColonyExportActions } from "../ColonyExportActions";
import * as colonyExportModule from "@/lib/colony-export";
import type { ColonyDetectionSuccessResponse } from "@/lib/colony-api";

vi.mock("@/lib/colony-export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/colony-export")>();
  return {
    ...actual,
    exportSummaryCsv: vi.fn(),
    exportDetectionsCsv: vi.fn(),
  };
});

describe("ColonyExportActions Component", () => {
  const mockResponse: ColonyDetectionSuccessResponse = {
    success: true,
    count: 120,
    detections: [
      { x1: 10, y1: 10, x2: 20, y2: 20, confidence: 0.9, class_id: 0, class_name: "colony" },
      { x1: 30, y1: 30, x2: 40, y2: 40, confidence: 0.85, class_id: 0, class_name: "colony" },
    ],
    annotated_image_url: "/outputs/annotated_123.jpg",
    image: { width: 1024, height: 1024 },
    processing_time_ms: 150,
    applied_threshold: 0.3,
    quality: {
      density_level: "medium",
      confluence_risk: "low",
      review_recommended: false,
      overlap_ratio: 0.05,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders export action buttons properly", () => {
    render(
      <ColonyExportActions
        filename="plate_01.jpg"
        response={mockResponse}
        appliedThreshold={0.3}
        reviewedCount={120}
        removedCount={0}
        addedCount={0}
      />,
    );

    expect(screen.getByText("Export Summary CSV")).toBeInTheDocument();
    expect(screen.getByText("Export Detections")).toBeInTheDocument();
    expect(screen.getByText("Print / Save PDF")).toBeInTheDocument();
  });

  it("triggers exportSummaryCsv when Export Summary CSV button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ColonyExportActions
        filename="plate_01.jpg"
        response={mockResponse}
        appliedThreshold={0.3}
        reviewedCount={118}
        removedCount={4}
        addedCount={2}
      />,
    );

    const summaryBtn = screen.getByText("Export Summary CSV").closest("button")!;
    expect(summaryBtn).toBeInTheDocument();
    await user.click(summaryBtn);

    expect(colonyExportModule.exportSummaryCsv).toHaveBeenCalledTimes(1);
    const passedParams = vi.mocked(colonyExportModule.exportSummaryCsv).mock.calls[0][0];
    expect(passedParams.filename).toBe("plate_01.jpg");
    expect(passedParams.aiCount).toBe(120);
    expect(passedParams.reviewedCount).toBe(118);
    expect(passedParams.removedCount).toBe(4);
    expect(passedParams.addedCount).toBe(2);
  });

  it("triggers exportDetectionsCsv when Export Detections button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <ColonyExportActions
        filename="plate_01.jpg"
        response={mockResponse}
        appliedThreshold={0.3}
        reviewedCount={120}
        removedCount={0}
        addedCount={0}
      />,
    );

    const detectionsBtn = screen.getByText("Export Detections").closest("button")!;
    expect(detectionsBtn).toBeInTheDocument();
    await user.click(detectionsBtn);

    expect(colonyExportModule.exportDetectionsCsv).toHaveBeenCalledTimes(1);
    const passedParams = vi.mocked(colonyExportModule.exportDetectionsCsv).mock.calls[0][0];
    expect(passedParams.filename).toBe("plate_01.jpg");
    expect(passedParams.detections.length).toBe(2);
  });
});
