import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as React from "react";
import { ColonyCounterPage } from "@/routes/tools/colony-counter";
import * as preprocessorModule from "@/lib/colony-image-preprocessor";
import * as apiModule from "@/lib/colony-api";
import * as demoModule from "../ColonyDemoPlates";

// Mock router and lightweight subcomponents
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

describe("Colony Counter Recovery & Non-Success States UX", { timeout: 15000 }, () => {
  const smallFile = new File([new Uint8Array(1024 * 50)], "plate_specimen.jpg", {
    type: "image/jpeg",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Empty state displays clear upload and demo guidance", () => {
    render(<ColonyCounterPage />);

    const emptyCard = screen.getByTestId("colony-empty-state");
    expect(emptyCard).toBeInTheDocument();
    expect(
      screen.getByText("Upload a Petri dish image or choose a demo plate to begin."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Upload a culture plate image or choose a demo plate to begin automated colony counting.",
      ),
    ).toBeInTheDocument();

    const uploadBtn = screen.getByRole("button", { name: "Upload Petri dish specimen" });
    const demoBtn = screen.getByRole("button", { name: "Try demo plate A" });
    expect(uploadBtn).toBeInTheDocument();
    expect(demoBtn).toBeInTheDocument();
  });

  it("2. Unsupported file type shows actionable validation error without claiming AI failed", async () => {
    render(<ColonyCounterPage />);

    const invalidFile = new File(["fake binary data"], "document.pdf", {
      type: "application/pdf",
    });
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        "That file type isn't supported. Choose a JPEG, PNG, WebP, AVIF, or BMP image.",
      );
      expect(alert).not.toHaveTextContent(/ai failed/i);
      expect(alert).not.toHaveTextContent(/model failed/i);
    });
  });

  it("3. Zero-byte file shows actionable empty-file error", async () => {
    render(<ColonyCounterPage />);

    const zeroByteFile = new File([], "empty_plate.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [zeroByteFile] } });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("The selected file is empty. Choose another image.");
      expect(alert).not.toHaveTextContent(/ai failed/i);
    });
  });

  it("4 & 5. Oversized image preprocessing failure shows clear recovery message and clears loading", async () => {
    vi.spyOn(preprocessorModule, "preprocessSpecimenImage").mockResolvedValue({
      success: false,
      error: "Canvas memory allocation limit reached",
      originalFile: new File([], "empty.jpg"),
    });

    render(<ColonyCounterPage />);

    const largeFile = new File([new Uint8Array(1024 * 1024 * 12)], "oversized_plate.jpg", {
      type: "image/jpeg",
    });
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(
        "We couldn't prepare this image for analysis. This image could not be prepared for upload. Try a smaller image or a different file.",
      );
      // Ensure no browser internal structures are leaked
      expect(alert).not.toHaveTextContent(/ImageBitmap/i);
      expect(alert).not.toHaveTextContent(/canvas/i);
      expect(alert).not.toHaveTextContent(/heap/i);
    });

    // Loading indicator must not remain active
    expect(screen.queryByText("Preparing image…")).not.toBeInTheDocument();
  });

  it("6 & 7. Network error preserves valid selected image and provides retry path", async () => {
    const detectSpy = vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError(
        "Failed to fetch from colony detection endpoint.",
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
      const errorCard = screen.getByTestId("colony-error-card");
      expect(errorCard).toBeInTheDocument();
      expect(errorCard).toHaveTextContent(
        "We couldn't reach the colony analysis service. Check your connection and try again.",
      );
    });

    // Valid selected image is preserved
    const preservationIndicator = screen.getByTestId("state-preservation-indicator");
    expect(preservationIndicator).toHaveTextContent("Specimen retained: plate_specimen.jpg");

    // Retry button is available
    const retryBtn = screen.getByRole("button", { name: "Retry colony analysis" });
    expect(retryBtn).toBeEnabled();

    // Trigger retry
    fireEvent.click(retryBtn);
    expect(detectSpy).toHaveBeenCalledTimes(2);
  });

  it("8. Timeout error shows factual timeout alert and provides direct retry path", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError(
        "Request exceeded 45s threshold.",
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
      const errorCard = screen.getByTestId("colony-error-card");
      expect(errorCard).toHaveTextContent("Analysis timed out. Please try again.");
      expect(errorCard).not.toHaveTextContent(/broken/i);
      expect(errorCard).not.toHaveTextContent(/inaccurate/i);
    });

    const retryBtn = screen.getByRole("button", { name: "Retry colony analysis" });
    expect(retryBtn).toBeEnabled();
  });

  it("9. User cancellation restores ready state and preserves image", async () => {
    let cancelSignal: AbortSignal | undefined;
    vi.spyOn(apiModule, "detectColonies").mockImplementation((_file, opts) => {
      const options = typeof opts === "object" ? opts : undefined;
      cancelSignal = options?.signal;
      return new Promise((_resolve, reject) => {
        cancelSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    render(<ColonyCounterPage />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    const cancelBtn = await screen.findByRole("button", { name: "Cancel colony analysis" });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByTestId("colony-ready-state")).toBeInTheDocument();
      expect(screen.getByTestId("colony-counter-status-announcer")).toHaveTextContent("Analysis cancelled.");
    });

    expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
    // Image is still available and ready to analyze again
    expect(screen.getByRole("button", { name: "Analyze Petri dish plate" })).toBeEnabled();
  });

  it("10. HTTP 413 Payload Too Large displays user-friendly oversized message", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError("Payload Too Large", "PAYLOAD_TOO_LARGE", 413),
    );

    render(<ColonyCounterPage />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const errorCard = screen.getByTestId("colony-error-card");
      expect(errorCard).toHaveTextContent("The image is too large to process. Try a smaller image.");
    });
  });

  it("11. HTTP 429 Rate Limit Exceeded displays polite rate-limit message", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError("Rate Limit Exceeded", "RATE_LIMIT_EXCEEDED", 429),
    );

    render(<ColonyCounterPage />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const errorCard = screen.getByTestId("colony-error-card");
      expect(errorCard).toHaveTextContent("Too many analysis requests. Please wait and try again.");
    });
  });

  it("12. Retry does not create duplicate requests while busy", async () => {
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

    // Click twice rapidly
    fireEvent.click(analyzeBtn);
    fireEvent.click(analyzeBtn);

    expect(detectSpy).toHaveBeenCalledTimes(1);

    // Resolve API
    resolveApi!({
      success: true,
      count: 10,
      detections: [],
      annotated_image_url: "/outputs/out.jpg",
      image: { width: 640, height: 640 },
      processing_time_ms: 100,
      quality: {
        density_level: "low",
        confluence_risk: "low",
        review_recommended: false,
        overlap_ratio: 0.01,
        reason: "Well-isolated",
      },
    });
  });

  it("13. Demo load failure does not disable normal upload and preserves demo retry option", async () => {
    vi.spyOn(demoModule, "fetchDemoPlateFile").mockRejectedValue(
      new Error("Failed to fetch demo file from /demo-plates/demo-plate-a-low-density.jpg"),
    );

    render(<ColonyCounterPage />);

    const demoBtn = screen.getByRole("button", { name: "Use Demo Plate A — Low Density" });
    fireEvent.click(demoBtn);

    await waitFor(() => {
      const errorCard = screen.getByTestId("colony-error-card");
      expect(errorCard).toHaveTextContent(
        "Demo plate couldn't be loaded. Unable to load demo image file. Please try again or upload your own image.",
      );
    });

    // Preservation indicator for demo
    const preservationIndicator = screen.getByTestId("state-preservation-indicator");
    expect(preservationIndicator).toHaveTextContent("Demo selection: Demo Plate A — Low Density (Ready to retry)");

    // Retry Demo button is present
    expect(screen.getByRole("button", { name: "Retry demo plate" })).toBeEnabled();

    // Normal upload input remains active and accessible
    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    expect(fileInput).toBeEnabled();
  });

  it("14 & 15. Recovery actions have accessible names and error card uses role=alert", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError("Service error", "INTERNAL_ERROR", 500),
    );

    render(<ColonyCounterPage />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "assertive");
      expect(alert).toHaveAttribute("aria-atomic", "true");
    });

    const retryBtn = screen.getByRole("button", { name: "Retry colony analysis" });
    const useDifferentBtn = screen.getByRole("button", { name: "Use different image" });
    expect(retryBtn).toBeInTheDocument();
    expect(useDifferentBtn).toBeInTheDocument();
  });

  it("16 & 17. Reset clears error and loading state, returning cleanly to EMPTY state", async () => {
    vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
      new apiModule.ColonyDetectionApiError("Network failure", "NETWORK_ERROR"),
    );

    render(<ColonyCounterPage />);

    const fileInput = screen.getByLabelText("Upload Petri dish image file");
    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("colony-error-card")).toBeInTheDocument();
    });

    // Click 'Use Different Image' to reset
    const useDifferentBtn = screen.getByRole("button", { name: "Use different image" });
    fireEvent.click(useDifferentBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("colony-error-card")).not.toBeInTheDocument();
      expect(screen.queryByTestId("analyzing-state-panel")).not.toBeInTheDocument();
      expect(screen.getByTestId("colony-empty-state")).toBeInTheDocument();
    });
  });
});
