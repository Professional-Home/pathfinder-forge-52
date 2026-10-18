import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import * as React from "react";
import { ColonyCounterPage } from "@/routes/tools/colony-counter";
import { PetriDishUploader } from "../PetriDishUploader";
import { ColonyDemoPlates } from "../ColonyDemoPlates";
import * as preprocessorModule from "@/lib/colony-image-preprocessor";
import * as apiModule from "@/lib/colony-api";
import * as demoModule from "../ColonyDemoPlates";

// Mock router and heavy subcomponents to optimize test startup
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

// Mock SiteHeader & SiteFooter to avoid router dependency in unit tests
vi.mock("@/components/site-header", () => ({
  SiteHeader: () => <header data-testid="mock-site-header" />,
}));
vi.mock("@/components/site-footer", () => ({
  SiteFooter: () => <footer data-testid="mock-site-footer" />,
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = vi.fn();

describe("Colony Counter Accessibility (a11y) Suite", { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("A. Upload Error Accessibility", () => {
    it("exposes invalid file format error as role='alert' with assertive live region", async () => {
      const handleFileSelect = vi.fn();
      render(<PetriDishUploader selectedFile={null} onFileSelect={handleFileSelect} />);

      const textFile = new File(["not an image"], "test.pdf", { type: "application/pdf" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");

      fireEvent.change(fileInput, { target: { files: [textFile] } });

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
        expect(alert).toHaveAttribute("aria-atomic", "true");
        expect(alert).toHaveTextContent(/unsupported format/i);
      });
    });

    it("ensures upload buttons have clear accessible names and busy states", () => {
      render(<PetriDishUploader selectedFile={null} onFileSelect={vi.fn()} />);

      const browseBtn = screen.getByRole("button", {
        name: "Browse files to upload Petri dish image",
      });
      const cameraBtn = screen.getByRole("button", {
        name: "Capture Petri dish image with mobile camera",
      });

      expect(browseBtn).toBeInTheDocument();
      expect(browseBtn).toHaveAttribute("aria-busy", "false");
      expect(cameraBtn).toBeInTheDocument();
      expect(cameraBtn).toHaveAttribute("aria-busy", "false");
    });
  });

  describe("B. Preprocessing Accessibility", () => {
    it("exposes preprocessing start and progress as polite status with aria-busy='true'", async () => {
      let resolvePreprocess: (value: any) => void;
      const preprocessPromise = new Promise((resolve) => {
        resolvePreprocess = resolve;
      });

      vi.spyOn(preprocessorModule, "preprocessSpecimenImage").mockReturnValue(
        preprocessPromise as any,
      );

      const largeFile = new File([new Uint8Array(8 * 1024 * 1024)], "heavy_plate.jpg", {
        type: "image/jpeg",
      });

      render(<PetriDishUploader selectedFile={null} onFileSelect={vi.fn()} />);

      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      // While preprocessing is active
      await waitFor(() => {
        const statusEl = screen.getByRole("status");
        expect(statusEl).toBeInTheDocument();
        expect(statusEl).toHaveAttribute("aria-live", "polite");
        expect(statusEl).toHaveAttribute("aria-busy", "true");
        expect(statusEl).toHaveTextContent(/optimizing large image for upload/i);
      });

      // Resolve the preprocessing
      const optimizedPayload = new File([new Uint8Array(1.5 * 1024 * 1024)], "heavy_opt.jpg", {
        type: "image/jpeg",
      });
      await act(async () => {
        resolvePreprocess!({
          success: true,
          isOptimized: true,
          uploadFile: optimizedPayload,
          originalFile: largeFile,
          originalSize: largeFile.size,
          optimizedSize: optimizedPayload.size,
          originalDimensions: { width: 4000, height: 3000 },
          optimizedDimensions: { width: 2048, height: 1536 },
          message: preprocessorModule.USER_OPTIMIZATION_SUCCESS_MESSAGE,
        });
      });
    });

    it("exposes preprocessing success feedback with role='status' and aria-live='polite'", () => {
      const mockOptimization = {
        success: true as const,
        isOptimized: true,
        uploadFile: new File([new Uint8Array(1.5 * 1024 * 1024)], "opt.jpg", {
          type: "image/jpeg",
        }),
        originalFile: new File([new Uint8Array(8 * 1024 * 1024)], "orig.jpg", {
          type: "image/jpeg",
        }),
        originalSize: 8 * 1024 * 1024,
        optimizedSize: 1.5 * 1024 * 1024,
        originalDimensions: { width: 4000, height: 3000 },
        optimizedDimensions: { width: 2048, height: 1536 },
        message: preprocessorModule.USER_OPTIMIZATION_SUCCESS_MESSAGE,
      };

      render(
        <PetriDishUploader
          selectedFile={mockOptimization.originalFile}
          optimizationInfo={mockOptimization}
          onFileSelect={vi.fn()}
        />,
      );

      const feedback = screen.getByTestId("optimization-feedback");
      expect(feedback).toHaveAttribute("role", "status");
      expect(feedback).toHaveAttribute("aria-live", "polite");
      expect(feedback).toHaveTextContent(/optimized for upload/i);
    });

    it("announces preprocessing failure as role='alert'", async () => {
      vi.spyOn(preprocessorModule, "preprocessSpecimenImage").mockResolvedValue({
        success: false,
        error: preprocessorModule.USER_OPTIMIZATION_FAILURE_MESSAGE,
        originalFile: new File([new Uint8Array(8 * 1024 * 1024)], "bad.jpg", {
          type: "image/jpeg",
        }),
      });

      render(<PetriDishUploader selectedFile={null} onFileSelect={vi.fn()} />);

      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, {
        target: {
          files: [new File([new Uint8Array(8 * 1024 * 1024)], "bad.jpg", { type: "image/jpeg" })],
        },
      });

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
        expect(alert).toHaveTextContent(/unable to optimize this image/i);
      });
    });
  });

  describe("C. Analysis Workflow & Success Accessibility", () => {
    it("announces 'Analyzing culture plate.' and exposes busy state during analysis", async () => {
      let resolveApi: (value: any) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });

      vi.spyOn(apiModule, "detectColonies").mockReturnValue(apiPromise as any);

      render(<ColonyCounterPage />);

      // Select a valid file
      const smallFile = new File([new Uint8Array(1024)], "plate.jpg", { type: "image/jpeg" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      // Click Analyze
      const analyzeBtn = screen.getByRole("button", { name: "Analyze Petri dish plate" });
      fireEvent.click(analyzeBtn);

      // Verify polite live region announcement
      const announcer = screen.getByTestId("colony-counter-status-announcer");
      expect(announcer).toHaveAttribute("role", "status");
      expect(announcer).toHaveAttribute("aria-live", "polite");
      expect(announcer).toHaveTextContent("Analyzing culture plate.");

      // Verify analyzing card exposes busy state
      const analyzingCards = screen.getAllByRole("status");
      const activeCard = analyzingCards.find((el) => el.getAttribute("aria-busy") === "true");
      expect(activeCard).toBeDefined();
      expect(activeCard).toHaveTextContent(/analyzing petri dish/i);

      // Cancel button should be available with clear label
      const cancelBtn = screen.getByRole("button", { name: "Cancel colony analysis" });
      expect(cancelBtn).toBeInTheDocument();

      // Resolve API response
      act(() => {
        resolveApi!({
          count: 42,
          detections: [],
          processing_time_ms: 120,
          image: { width: 640, height: 640 },
          quality: { density_level: "low", review_recommended: false, confluence_risk: "low" },
        });
      });

      await waitFor(() => {
        expect(announcer).toHaveTextContent("Analysis complete. Colony detection results are ready.");
      });
    });

    it("announces 'Analysis cancelled.' when cancellation is triggered", async () => {
      let abortSignal: AbortSignal | undefined;
      vi.spyOn(apiModule, "detectColonies").mockImplementation((_, opts) => {
        const options = typeof opts === "object" ? opts : undefined;
        abortSignal = options?.signal;
        return new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new apiModule.ColonyDetectionApiError("Analysis cancelled by user", "REQUEST_ABORTED", 499));
          });
        });
      });

      render(<ColonyCounterPage />);

      const smallFile = new File([new Uint8Array(1024)], "plate.jpg", { type: "image/jpeg" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const analyzeBtn = screen.getByRole("button", { name: "Analyze Petri dish plate" });
      fireEvent.click(analyzeBtn);

      const announcer = screen.getByTestId("colony-counter-status-announcer");
      expect(announcer).toHaveTextContent("Analyzing culture plate.");

      const cancelBtn = screen.getByRole("button", { name: "Cancel colony analysis" });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(announcer).toHaveTextContent("Analysis cancelled.");
      });
    });
  });

  describe("D. API Error Accessibility", () => {
    it("exposes network error as alert with non-technical guidance", async () => {
      vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
        new apiModule.ColonyDetectionApiError(
          "Unable to connect to Colony Detection service. Please verify that the microservice is running.",
          "NETWORK_ERROR",
          0,
        ),
      );

      render(<ColonyCounterPage />);

      const smallFile = new File([new Uint8Array(1024)], "plate.jpg", { type: "image/jpeg" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
      await waitFor(() => expect(analyzeBtn).toBeEnabled());
      fireEvent.click(analyzeBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
        expect(alert).toHaveTextContent(/detection request failed/i);
        expect(alert).toHaveTextContent(/offline or unreachable/i);
      });

      const retryBtn = screen.getByRole("button", { name: "Retry colony analysis" });
      expect(retryBtn).toBeInTheDocument();
    });

    it("exposes timeout error as alert explaining latency", async () => {
      vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
        new apiModule.ColonyDetectionApiError(
          "Colony detection request timed out after 30000ms",
          "REQUEST_TIMEOUT",
          408,
        ),
      );

      render(<ColonyCounterPage />);

      const smallFile = new File([new Uint8Array(1024)], "plate.jpg", { type: "image/jpeg" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
      await waitFor(() => expect(analyzeBtn).toBeEnabled());
      fireEvent.click(analyzeBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
        expect(alert).toHaveTextContent(/timed out before receiving a response/i);
      });
    });

    it("exposes rate limit error as alert with compute throttling explanation", async () => {
      vi.spyOn(apiModule, "detectColonies").mockRejectedValue(
        new apiModule.ColonyDetectionApiError(
          "Rate limit exceeded: maximum 10 requests per minute allowed.",
          "RATE_LIMIT_EXCEEDED",
          429,
        ),
      );

      render(<ColonyCounterPage />);

      const smallFile = new File([new Uint8Array(1024)], "plate.jpg", { type: "image/jpeg" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const analyzeBtn = await screen.findByRole("button", { name: "Analyze Petri dish plate" });
      await waitFor(() => expect(analyzeBtn).toBeEnabled());
      fireEvent.click(analyzeBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
        expect(alert).toHaveTextContent(/throttled to protect shared laboratory compute resources/i);
      });
    });
  });

  describe("E. Demo Plate Workflow Accessibility", () => {
    it("announces demo plate selection politely without duplicate announcements", async () => {
      const demoPlate = demoModule.DEMO_PLATES[0];
      const demoFile = new File([new Uint8Array(1024)], demoPlate.filename, {
        type: "image/jpeg",
      });

      vi.spyOn(demoModule, "fetchDemoPlateFile").mockResolvedValue(demoFile);

      render(<ColonyCounterPage />);

      const announcer = screen.getByTestId("colony-counter-status-announcer");
      expect(announcer).toHaveTextContent("");

      const demoBtn = screen.getByRole("button", { name: `Use ${demoPlate.name}` });
      fireEvent.click(demoBtn);

      await waitFor(() => {
        expect(announcer).toHaveTextContent(`Demo plate loaded: ${demoPlate.name}.`);
      });

      // Verify button has aria-pressed="true"
      expect(demoBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("announces error when demo file fails to load", async () => {
      vi.spyOn(demoModule, "fetchDemoPlateFile").mockRejectedValue(
        new Error("Network failed to fetch asset"),
      );

      render(<ColonyCounterPage />);

      const demoPlate = demoModule.DEMO_PLATES[0];
      const demoBtn = screen.getByRole("button", { name: `Use ${demoPlate.name}` });
      fireEvent.click(demoBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute("aria-live", "assertive");
        expect(alert).toHaveTextContent(/unable to load demo image file/i);
      });
    });
  });

  describe("F. Workspace Reset Accessibility", () => {
    it("announces workspace reset when reset button is activated", async () => {
      render(<ColonyCounterPage />);

      const smallFile = new File([new Uint8Array(1024)], "plate.jpg", { type: "image/jpeg" });
      const fileInput = screen.getByLabelText("Upload Petri dish image file");
      fireEvent.change(fileInput, { target: { files: [smallFile] } });

      const announcer = screen.getByTestId("colony-counter-status-announcer");

      const resetBtn = screen.getByRole("button", { name: "Clear image and results" });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(announcer).toHaveTextContent("Workspace reset. No image selected.");
      });
    });
  });

  describe("G. Results Panel Semantics & Announcer Protection", () => {
    it("exposes density advisory with role='region' and accessible label", async () => {
      const { ColonyResultsPanel } = await import("../ColonyResultsPanel");

      const mockResponse: apiModule.ColonyDetectionSuccessResponse = {
        success: true,
        count: 245,
        detections: Array.from({ length: 245 }, (_, i) => ({
          x1: 10 + i,
          y1: 10 + i,
          x2: 20 + i,
          y2: 20 + i,
          confidence: 0.85,
          class_id: 0,
          class_name: "colony",
        })),
        processing_time_ms: 150,
        image: { width: 1000, height: 1000 },
        quality: {
          density_level: "high",
          review_recommended: true,
          confluence_risk: "high",
          overlap_ratio: 0.15,
          reason: "High colony density",
          warning_message: "High-density plate detected. Manual verification is recommended.",
        },
      };

      const { container } = render(
        <ColonyResultsPanel
          response={mockResponse}
          hasModifications={true}
          reviewedCount={240}
          onResetReview={vi.fn()}
          isDemoPlate={true}
        />,
      );

      // Verify the entire results panel does NOT have aria-live (avoids screen-reader dump)
      expect(container.firstElementChild).not.toHaveAttribute("aria-live");

      // Verify advisory has role='region' and clear accessible label
      const advisory = screen.getByRole("region", { name: "High-density culture advisory" });
      expect(advisory).toBeInTheDocument();
      expect(advisory).toHaveTextContent(/high-density plate detected/i);

      // Verify synthetic demo notice has role='note'
      const demoNote = screen.getByRole("note", { name: "Synthetic demonstration plate notice" });
      expect(demoNote).toBeInTheDocument();

      // Verify reset review button has explicit accessible name
      const resetReviewBtn = screen.getByRole("button", {
        name: "Reset all manual corrections to original AI count",
      });
      expect(resetReviewBtn).toBeInTheDocument();
    });
  });
});
