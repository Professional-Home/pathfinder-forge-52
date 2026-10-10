import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { ColonyCounterPage } from "@/routes/tools/colony-counter";
import { ColonyResultsPanel } from "../ColonyResultsPanel";
import { ColonyDetectionCanvas } from "../ColonyDetectionCanvas";
import * as apiModule from "@/lib/colony-api";
import { ColonyDetectionApiError } from "@/lib/colony-api";

// Mock router and lightweight headers
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => config,
  Link: ({ children }: any) => children,
  useLocation: () => ({ pathname: "/tools/colony-counter" }),
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="mock-site-header" />,
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer data-testid="mock-site-footer" />,
}));

// Mock object URLs
global.URL.createObjectURL = vi.fn(() => "blob:mock-petri-image-url");
global.URL.revokeObjectURL = vi.fn();

describe("Colony Counter - Confidence Threshold State and Review Data Protection", { timeout: 15000 }, () => {
  const mockFile = new File([new Uint8Array(1024 * 10)], "agar_specimen.jpg", {
    type: "image/jpeg",
  });

  const sampleDetections: apiModule.ColonyDetection[] = [
    {
      x1: 50,
      y1: 50,
      x2: 100,
      y2: 100,
      confidence: 0.85,
      class_id: 0,
      class_name: "colony",
    },
    {
      x1: 150,
      y1: 150,
      x2: 200,
      y2: 200,
      confidence: 0.75,
      class_id: 0,
      class_name: "colony",
    },
    {
      x1: 250,
      y1: 250,
      x2: 300,
      y2: 300,
      confidence: 0.45,
      class_id: 0,
      class_name: "colony",
    },
  ];

  const mockResponse: apiModule.ColonyDetectionSuccessResponse = {
    success: true,
    count: 3,
    detections: sampleDetections,
    processing_time_ms: 110,
    image: { width: 640, height: 640 },
    quality: {
      density_level: "low",
      review_recommended: false,
      confluence_risk: "low",
      overlap_ratio: 0.0,
      reason: "Low density plate",
      warning_message: null,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Slider moved but no re-analysis: active threshold metadata remains unchanged", async () => {
    vi.spyOn(apiModule, "detectColonies").mockResolvedValueOnce(mockResponse);

    render(<ColonyCounterPage />);

    // Load file and analyze with initial default (0.30)
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: /analyze petri dish plate/i });
    fireEvent.click(analyzeBtn);

    // Verify initial successful analysis state
    await screen.findByRole("button", { name: /re-analyze/i });
    expect(screen.getByTestId("active-threshold-display")).toHaveTextContent("Applied: 30%");
    expect(screen.getByText("Filter Applied")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();

    // Now adjust slider from 0.30 to 0.70 WITHOUT re-analyzing
    const slider = screen.getByLabelText("Confidence threshold slider");
    fireEvent.change(slider, { target: { value: "0.7" } });

    // Active threshold display in detection parameters remains applied at 30%, but shows Pending badge
    expect(screen.getByTestId("active-threshold-display")).toHaveTextContent("Applied: 30%");
    expect(screen.getByTestId("pending-threshold-badge")).toHaveTextContent("Pending: 70%");
    expect(screen.getByTestId("unapplied-threshold-notice")).toHaveTextContent(
      /Results currently display detections analyzed at 30%/i,
    );

    // Results panel filter applied metadata still reflects 30%
    expect(screen.getByTestId("filter-applied-value")).toHaveTextContent("30%");

    // Verify detectColonies was called only once so far (at 0.3)
    expect(apiModule.detectColonies).toHaveBeenCalledTimes(1);
    expect(apiModule.detectColonies).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ confidenceThreshold: 0.3 }),
    );
  });

  it("2. Successful re-analysis: active threshold metadata updates", async () => {
    const secondResponse: apiModule.ColonyDetectionSuccessResponse = {
      ...mockResponse,
      count: 2,
      detections: sampleDetections.slice(0, 2),
    };

    vi.spyOn(apiModule, "detectColonies")
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(secondResponse);

    render(<ColonyCounterPage />);

    // First analysis at 0.30
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    const analyzeBtn = await screen.findByRole("button", { name: /analyze petri dish plate/i });
    fireEvent.click(analyzeBtn);

    const reanalyzeBtn = await screen.findByRole("button", { name: /re-analyze/i });
    expect(screen.getByTestId("active-threshold-display")).toHaveTextContent("Applied: 30%");

    // Move slider to 0.70
    const slider = screen.getByLabelText("Confidence threshold slider");
    fireEvent.change(slider, { target: { value: "0.7" } });

    // Re-analyze with new slider threshold (no edits exist, so immediate re-analysis)
    fireEvent.click(reanalyzeBtn);

    await waitFor(() => {
      expect(apiModule.detectColonies).toHaveBeenCalledTimes(2);
    });

    // Active threshold display now updates to 70% applied
    await waitFor(() => {
      expect(screen.getByTestId("active-threshold-display")).toHaveTextContent("Applied: 70%");
    });
    expect(screen.queryByTestId("pending-threshold-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unapplied-threshold-notice")).not.toBeInTheDocument();

    expect(screen.getByTestId("filter-applied-value")).toHaveTextContent("70%");
  });

  it("3. Failed or cancelled re-analysis: active results and review state remain unchanged", async () => {
    vi.spyOn(apiModule, "detectColonies")
      .mockResolvedValueOnce(mockResponse)
      .mockRejectedValueOnce(new ColonyDetectionApiError("NETWORK_ERROR", "Backend offline"));

    render(<ColonyCounterPage />);

    // First analysis
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    const analyzeBtn = await screen.findByRole("button", { name: /analyze petri dish plate/i });
    fireEvent.click(analyzeBtn);

    const reanalyzeBtn = await screen.findByRole("button", { name: /re-analyze/i });

    // Trigger re-analysis that will fail
    fireEvent.click(reanalyzeBtn);

    // Re-analysis error banner appears, but previous detections and applied threshold are preserved
    await screen.findByTestId("colony-reanalysis-error-banner");
    expect(screen.getByTestId("colony-reanalysis-error-banner")).toHaveTextContent(
      /Previous detections and review edits were preserved/i,
    );
    expect(screen.getByTestId("active-threshold-display")).toHaveTextContent("Applied: 30%");
    expect(screen.getByTestId("kpi-ai-count")).toHaveTextContent("3");

    // Dismiss error banner
    const dismissBtn = screen.getByRole("button", { name: /dismiss re-analysis error notice/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId("colony-reanalysis-error-banner")).not.toBeInTheDocument();
  });

  it("4 & 5. Re-analysis with review edits requires confirmation, and cancelling preserves review edits", async () => {
    vi.spyOn(apiModule, "detectColonies").mockResolvedValueOnce(mockResponse);

    render(<ColonyCounterPage />);

    // Initial analysis
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    const analyzeBtn = await screen.findByRole("button", { name: /analyze petri dish plate/i });
    fireEvent.click(analyzeBtn);

    const reanalyzeBtn = await screen.findByRole("button", { name: /re-analyze/i });

    // Remove one AI detection by clicking on its detection marker
    const firstDetectionBox = await screen.findByRole("button", { name: /colony detection 1:/i });
    fireEvent.click(firstDetectionBox);

    // Verify modification exists (lineage-removed-count is −1)
    await screen.findByTestId("lineage-removed-count");
    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("−1");
    expect(screen.getByTestId("primary-reviewed-count")).toHaveTextContent("2");

    // Click Re-analyze Plate -> Should trigger confirmation dialog
    fireEvent.click(reanalyzeBtn);

    const confirmDialog = await screen.findByTestId("reanalysis-confirmation-dialog");
    expect(confirmDialog).toBeInTheDocument();
    expect(confirmDialog).toHaveTextContent("Discard manual review changes?");
    expect(confirmDialog).toHaveTextContent(/1 removed/i);

    // Cancel confirmation
    const cancelBtn = screen.getByTestId("reanalysis-cancel-button");
    fireEvent.click(cancelBtn);

    // Confirmation dialog closes, no new request was sent, and manual colony review remains intact!
    expect(screen.queryByTestId("reanalysis-confirmation-dialog")).not.toBeInTheDocument();
    expect(apiModule.detectColonies).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("−1");
    expect(screen.getByTestId("primary-reviewed-count")).toHaveTextContent("2");
  });

  it("6. Confirming and successfully re-analyzing resets edits intentionally", async () => {
    const secondResponse: apiModule.ColonyDetectionSuccessResponse = {
      ...mockResponse,
      count: 2,
      detections: sampleDetections.slice(0, 2),
    };

    vi.spyOn(apiModule, "detectColonies")
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(secondResponse);

    render(<ColonyCounterPage />);

    // Initial analysis
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    const analyzeBtn = await screen.findByRole("button", { name: /analyze petri dish plate/i });
    fireEvent.click(analyzeBtn);

    const reanalyzeBtn = await screen.findByRole("button", { name: /re-analyze/i });

    // Remove one AI detection
    const firstDetectionBox = await screen.findByRole("button", { name: /colony detection 1:/i });
    fireEvent.click(firstDetectionBox);

    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("−1");

    // Click Re-analyze -> Show confirmation -> Confirm
    fireEvent.click(reanalyzeBtn);
    await screen.findByTestId("reanalysis-confirmation-dialog");

    const confirmActionBtn = screen.getByTestId("reanalysis-confirm-button");
    fireEvent.click(confirmActionBtn);

    // Second analysis succeeds and deliberately resets manual review edits
    await waitFor(() => {
      expect(apiModule.detectColonies).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId("kpi-ai-count")).toHaveTextContent("2");
      expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("0");
    });
  });

  it("7. Empty high-threshold result displays helpful guidance message", () => {
    const zeroResponse: apiModule.ColonyDetectionSuccessResponse = {
      success: true,
      count: 0,
      detections: [],
      processing_time_ms: 85,
      image: { width: 640, height: 640 },
    };

    // Render ColonyResultsPanel with count = 0 and appliedThreshold = 0.85
    const { rerender } = render(
      <ColonyResultsPanel response={zeroResponse} appliedThreshold={0.85} />,
    );

    const guidance = screen.getByTestId("high-threshold-zero-detections-guidance");
    expect(guidance).toBeInTheDocument();
    expect(guidance).toHaveTextContent(
      "No colonies met this high confidence threshold. Try lowering the threshold towards the 30% default and re-analyze.",
    );

    // If appliedThreshold is 0.30 with count = 0, high-threshold guidance should not appear
    rerender(<ColonyResultsPanel response={zeroResponse} appliedThreshold={0.3} />);
    expect(screen.queryByTestId("high-threshold-zero-detections-guidance")).not.toBeInTheDocument();

    // Verify ColonyDetectionCanvas zero detections guidance
    render(
      <ColonyDetectionCanvas
        originalImageUrl="blob:fake"
        detections={[]}
        imageMetadata={{ width: 640, height: 640 }}
        appliedThreshold={0.75}
      />,
    );

    expect(screen.getByTestId("canvas-zero-detections-notice")).toHaveTextContent(
      "No colonies met this high confidence threshold. Try lowering the threshold towards the 30% default and re-analyze.",
    );
  });

  it("8. Existing count, CFU, and export behavior remains correct with appliedThreshold", () => {
    const testResponse: apiModule.ColonyDetectionSuccessResponse = {
      ...mockResponse,
      count: 150,
      quality: {
        density_level: "medium",
        review_recommended: false,
        confluence_risk: "low",
        overlap_ratio: 0.02,
        reason: "Medium density countable range",
        warning_message: null,
      },
    };

    render(
      <ColonyResultsPanel
        response={testResponse}
        appliedThreshold={0.45}
        reviewedCount={152}
        removedCount={1}
        addedCount={3}
        hasModifications={true}
      />,
    );

    // Primary reviewed count reflects reviewed count
    expect(screen.getByTestId("primary-reviewed-count")).toHaveTextContent("152");
    expect(screen.getByTestId("kpi-ai-count")).toHaveTextContent("150");
    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("−1");
    expect(screen.getByTestId("lineage-added-count")).toHaveTextContent("+3");
    expect(screen.getByTestId("filter-applied-value")).toHaveTextContent("45%");

    // Export buttons are rendered and active
    expect(
      screen.getByRole("button", { name: /export colony quantification summary to csv/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /print or save pdf/i }),
    ).toBeInTheDocument();
  });
});
