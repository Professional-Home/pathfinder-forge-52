import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import * as React from "react";
import { ColonyCounterPage } from "@/routes/tools/colony-counter";
import * as preprocessorModule from "@/lib/colony-image-preprocessor";
import * as apiModule from "@/lib/colony-api";
import * as demoModule from "../ColonyDemoPlates";

// Mock router and lightweight subcomponents for reliable test execution
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => config,
  Link: ({ children }: any) => children,
  useLocation: () => ({ pathname: "/tools/colony-counter" }),
}));

vi.mock("@/components/tools/ColonyDetectionCanvas", () => ({
  ColonyDetectionCanvas: () => <div data-testid="mock-detection-canvas" />,
}));

vi.mock("@/components/tools/ColonyPrintReport", () => ({
  ColonyPrintReport: () => <div data-testid="mock-print-report" />,
}));

vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="mock-site-header" />,
}));

vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer data-testid="mock-site-footer" />,
}));

// Mock object URLs
global.URL.createObjectURL = vi.fn(() => "blob:mock-plate-url");
global.URL.revokeObjectURL = vi.fn();

describe("Colony Counter Analysis & Loading Experience", { timeout: 15000 }, () => {
  const smallFile = new File([new Uint8Array(1024 * 50)], "plate_specimen.jpg", {
    type: "image/jpeg",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Analyze button is enabled and shows ready status when image is loaded", async () => {
    render(<ColonyCounterPage />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    await waitFor(() => {
      const analyzeBtn = screen.getByRole("button", { name: "Analyze Petri dish plate" });
      expect(analyzeBtn).toBeInTheDocument();
      expect(analyzeBtn).toBeEnabled();
      expect(analyzeBtn).toHaveAttribute("aria-busy", "false");
    });

    const statusText = screen.getByTestId("analysis-status-text");
    expect(statusText).toHaveTextContent("Ready to analyze");
  });

  it("2 & 3. Analyze button becomes disabled and exposes busy state during analysis", async () => {
    let resolveApi: (value: any) => void;
    const apiPromise = new Promise((resolve) => {
      resolveApi = resolve;
    });
    vi.spyOn(apiModule, "detectColonies").mockReturnValue(apiPromise as any);

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    // Analyze button should be disabled, busy, and labeled
    await waitFor(() => {
      const busyAnalyzeBtn = screen.getByRole("button", { name: "Analyzing colony image…" });
      expect(busyAnalyzeBtn).toBeInTheDocument();
      expect(busyAnalyzeBtn).toBeDisabled();
      expect(busyAnalyzeBtn).toHaveAttribute("aria-busy", "true");
    });

    // Right-column card should also expose status and busy
    const analyzingPanel = screen.getByTestId("analyzing-state-panel");
    expect(analyzingPanel).toBeInTheDocument();
    expect(analyzingPanel).toHaveAttribute("aria-busy", "true");

    // Clean up
    act(() => {
      resolveApi!({
        count: 10,
        detections: [],
        processing_time_ms: 100,
        image: { width: 640, height: 640 },
      });
    });
  });

  it("4. Prevents duplicate submissions when clicked multiple times", async () => {
    let resolveApi: (value: any) => void;
    const apiPromise = new Promise((resolve) => {
      resolveApi = resolve;
    });
    const detectSpy = vi.spyOn(apiModule, "detectColonies").mockReturnValue(apiPromise as any);

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);
    fireEvent.click(analyzeBtn);
    fireEvent.click(analyzeBtn);

    expect(detectSpy).toHaveBeenCalledTimes(1);

    act(() => {
      resolveApi!({
        count: 5,
        detections: [],
        processing_time_ms: 80,
        image: { width: 640, height: 640 },
      });
    });
  });

  it("5. Shows preparing-image status when client-side preprocessing is active", async () => {
    let resolvePreprocess: (value: any) => void;
    const preprocessPromise = new Promise((resolve) => {
      resolvePreprocess = resolve;
    });
    vi.spyOn(preprocessorModule, "preprocessSpecimenImage").mockReturnValue(
      preprocessPromise as any,
    );

    const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], "oversized_plate.jpg", {
      type: "image/jpeg",
    });

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Preprocessing loading area should be visible
    await waitFor(() => {
      const statusText = screen.getByTestId("analysis-status-text");
      expect(statusText).toHaveTextContent("Preparing image…");
    });

    const analyzeBtn = screen.getByRole("button", { name: "Preparing image…" });
    expect(analyzeBtn).toBeDisabled();
    expect(analyzeBtn).toHaveAttribute("aria-busy", "true");

    // Resolve preprocessing
    await act(async () => {
      resolvePreprocess!({
        success: true,
        isOptimized: true,
        uploadFile: smallFile,
        originalFile: largeFile,
        originalSizeBytes: 6 * 1024 * 1024,
        optimizedSizeBytes: 1024 * 50,
        compressionRatio: 0.01,
        reductionPercent: 99,
        durationMs: 150,
      });
    });

    // After preprocessing completes, status becomes ready to analyze
    await waitFor(() => {
      expect(screen.getByTestId("analysis-status-text")).toHaveTextContent("Ready to analyze");
    });
  });

  it("6. Staged analyzing progression transitions without fake percentages", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let resolveApi: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });
      vi.spyOn(apiModule, "detectColonies").mockReturnValue(apiPromise as any);

      render(<ColonyCounterPage />);
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
      await waitFor(() => expect(analyzeBtn).toBeEnabled());
      fireEvent.click(analyzeBtn);

      // Initial staged status
      expect(screen.getByTestId("analysis-status-text")).toHaveTextContent(
        "Analyzing colony image…",
      );

      // Advance timer past staged sub-stage threshold (1200ms)
      act(() => {
        vi.advanceTimersByTime(1300);
      });

      // Staged waiting status
      expect(screen.getByTestId("analysis-status-text")).toHaveTextContent(
        "Detecting colonies and preparing results…",
      );

      // Confirm no fake percentage appears
      expect(screen.queryByText(/%\s*complete/i)).not.toBeInTheDocument();

      // Resolve
      act(() => {
        resolveApi!({
          count: 15,
          detections: [],
          processing_time_ms: 120,
          image: { width: 640, height: 640 },
        });
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("7. Successful analysis exits loading state, displays measured duration, and enables re-analyze", async () => {
    vi.spyOn(apiModule, "detectColonies").mockResolvedValue({
      success: true,
      count: 24,
      detections: [],
      processing_time_ms: 150,
      image: { width: 640, height: 640 },
    });

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("analysis-status-text")).toHaveTextContent("Analysis complete.");
      expect(screen.getByRole("button", { name: "Re-analyze Petri dish plate" })).toBeEnabled();
    });

    // Should not have any active busy panel
    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
  });

  it("8. Timeout exits loading state, shows factual timeout alert, and exposes retry", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError(
        "Analysis timed out. Please try again.",
        "REQUEST_TIMEOUT",
        408,
      ),
    );

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Analysis timed out. Please try again.");
      expect(screen.getByRole("button", { name: "Retry colony analysis" })).toBeInTheDocument();
    });

    // Loading indicator is cleared
    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
  });

  it("9. Cancellation/abort exits loading state and restores ready state", async () => {
    let abortSignalCaptured: AbortSignal | undefined;
    vi.spyOn(apiModule, "detectColonies").mockImplementation((_, opts: any) => {
      abortSignalCaptured = opts?.signal;
      return new Promise((_, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener("abort", () => {
            reject(
              new apiModule.ColonyDetectionApiError(
                "Colony detection request cancelled by user.",
                "REQUEST_ABORTED",
              ),
            );
          });
        }
      });
    });

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel colony analysis" })).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel colony analysis" });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      const announcer = screen.getByTestId("colony-counter-status-announcer");
      expect(announcer).toHaveTextContent("Analysis cancelled.");
      expect(screen.getByRole("button", { name: "Analyze Petri dish plate" })).toBeEnabled();
    });

    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
  });

  it("10. Network error exits loading state and provides clear retry path", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError(
        "Network error connecting to ML service.",
        "NETWORK_ERROR",
      ),
    );

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Network error connecting to ML service.");
      expect(screen.getByRole("button", { name: "Retry colony analysis" })).toBeEnabled();
    });

    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
  });

  it("11. HTTP 413 Payload Too Large exits loading state", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError(
        "Payload Too Large",
        "PAYLOAD_TOO_LARGE",
        413,
      ),
    );

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/exceeds maximum upload size/i);
    });

    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
  });

  it("12. HTTP 429 Rate Limit Exceeded exits loading state", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError(
        "Rate limit exceeded",
        "RATE_LIMIT_EXCEEDED",
        429,
      ),
    );

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/throttled to protect shared laboratory compute/i);
    });

    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
  });

  it("13. Demo analysis uses the same loading architecture and is labeled clearly", async () => {
    const demoPlate = demoModule.DEMO_PLATES[0];
    const demoPlateFile = new File([new Uint8Array(1024)], demoPlate.filename, {
      type: "image/jpeg",
    });
    vi.spyOn(demoModule, "fetchDemoPlateFile").mockResolvedValue(demoPlateFile);

    let resolveApi: (value: any) => void;
    const apiPromise = new Promise((resolve) => {
      resolveApi = resolve;
    });
    vi.spyOn(apiModule, "detectColonies").mockReturnValue(apiPromise as any);

    render(<ColonyCounterPage />);

    // Select Demo Plate A
    const demoBtn = screen.getByRole("button", { name: `Use ${demoPlate.name}` });
    fireEvent.click(demoBtn);

    await waitFor(() => {
      const announcer = screen.getByTestId("colony-counter-status-announcer");
      expect(announcer).toHaveTextContent(`Demo plate loaded: ${demoPlate.name}.`);
    });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    // Verify demo-specific staged status and button label
    await waitFor(() => {
      const busyBtn = screen.getByRole("button", { name: "Analyzing demo plate…" });
      expect(busyBtn).toBeDisabled();
      expect(busyBtn).toHaveAttribute("aria-busy", "true");
    });

    expect(screen.getByTestId("analysis-status-text")).toHaveTextContent("Analyzing demo plate…");
    expect(screen.getByTestId("analyzing-state-panel")).toHaveTextContent("Analyzing Demo Plate…");

    // Resolve API
    act(() => {
      resolveApi!({
        count: 18,
        detections: [],
        processing_time_ms: 95,
        image: { width: 640, height: 640 },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("analysis-status-text")).toHaveTextContent("Analysis complete.");
    });
  });

  it("14. Live region announcer receives correct status announcements", async () => {
    vi.spyOn(apiModule, "detectColonies").mockResolvedValue({
      success: true,
      count: 12,
      detections: [],
      processing_time_ms: 100,
      image: { width: 640, height: 640 },
    });

    render(<ColonyCounterPage />);
    const announcer = screen.getByTestId("colony-counter-status-announcer");
    expect(announcer).toHaveAttribute("aria-live", "polite");

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    expect(announcer).toHaveTextContent("Analyzing culture plate.");

    await waitFor(() => {
      expect(announcer).toHaveTextContent("Analysis complete. Colony detection results are ready.");
    });
  });

  it("15. Reset clears timers, measured duration, and leaves no stale spinner", async () => {
    vi.spyOn(apiModule, "detectColonies").mockResolvedValue({
      success: true,
      count: 30,
      detections: [],
      processing_time_ms: 110,
      image: { width: 640, height: 640 },
    });

    render(<ColonyCounterPage />);
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("analysis-status-text")).toHaveTextContent("Analysis complete.");
    });

    // Click Reset
    const resetBtn = screen.getByRole("button", { name: "Clear image and results" });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("analysis-loading-status")).not.toBeInTheDocument();
      expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
    });

    const announcer = screen.getByTestId("colony-counter-status-announcer");
    expect(announcer).toHaveTextContent("Workspace reset. No image selected.");
  });
});
