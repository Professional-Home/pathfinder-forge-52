import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FlaskConical,
  Sparkles,
  Sliders,
  Loader2,
  AlertCircle,
  RotateCcw,
  Info,
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PetriDishUploader } from "@/components/tools/PetriDishUploader";
import {
  ColonyDemoPlates,
  fetchDemoPlateFile,
  DEMO_PLATES,
  type DemoPlateItem,
} from "@/components/tools/ColonyDemoPlates";
import { ColonyDetectionCanvas } from "@/components/tools/ColonyDetectionCanvas";
import { ColonyResultsPanel } from "@/components/tools/ColonyResultsPanel";
import { ColonyPrintReport } from "@/components/tools/ColonyPrintReport";
import { ColonyWorkflowGuide } from "@/components/tools/ColonyWorkflowGuide";
import { useColonyReview } from "@/hooks/use-colony-review";
import type { CfuExportData } from "@/lib/colony-export";
import {
  detectColonies,
  ColonyDetectionApiError,
  resolveAnnotatedImageUrl,
  type ColonyDetectionSuccessResponse,
} from "@/lib/colony-api";

export const Route = createFileRoute("/tools/colony-counter")({
  component: ColonyCounterPage,
  head: () => ({
    meta: [
      { title: "AI Petri Dish Colony Counter — Micrylis Biotech" },
      {
        name: "description",
        content:
          "Automated Petri dish colony detection and counting tool powered by computer vision. Upload or capture culture plate images for rapid colony quantification.",
      },
    ],
  }),
});

type PageState = "EMPTY" | "READY" | "ANALYZING" | "SUCCESS" | "ERROR";

export function ColonyCounterPage() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadPayload, setUploadPayload] = React.useState<File | null>(null);
  const [optimizationInfo, setOptimizationInfo] =
    React.useState<import("@/lib/colony-image-preprocessor").ImageOptimizationSuccess | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = React.useState<number>(0.3);
  const [pageState, setPageState] = React.useState<PageState>("EMPTY");
  const [analysisResult, setAnalysisResult] = React.useState<ColonyDetectionSuccessResponse | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [errorDetails, setErrorDetails] = React.useState<string | null>(null);
  const [failedDemo, setFailedDemo] = React.useState<DemoPlateItem | null>(null);
  const [cfuData, setCfuData] = React.useState<CfuExportData | null>(null);
  const [annotatedReportImageUrl, setAnnotatedReportImageUrl] = React.useState<string | null>(null);
  const [activeDemo, setActiveDemo] = React.useState<DemoPlateItem | null>(null);
  const [loadingDemoId, setLoadingDemoId] = React.useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = React.useState<string>("");
  const [isPreprocessing, setIsPreprocessing] = React.useState<boolean>(false);
  const [analyzingSubStage, setAnalyzingSubStage] = React.useState<"initial" | "waiting">("initial");
  const [measuredDurationSec, setMeasuredDurationSec] = React.useState<string | null>(null);
  const waitingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCalculationChange = React.useCallback((data: CfuExportData | null) => {
    setCfuData((prev) => {
      if (!prev && !data) return prev;
      if (prev && data && JSON.stringify(prev) === JSON.stringify(data)) return prev;
      return data;
    });
  }, []);

  // Human-in-the-loop colony review layer (preserves immutable AI baseline)
  const review = useColonyReview({
    aiDetections: analysisResult?.detections,
    aiCount: analysisResult?.count,
    imageWidth: analysisResult?.image?.width,
    imageHeight: analysisResult?.image?.height,
  });

  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Manage in-memory preview object URL
  React.useEffect(() => {
    const fileForPreview = uploadPayload || selectedFile;
    if (!fileForPreview) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(fileForPreview);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile, uploadPayload]);

  // Manage annotated report image object URL lifecycle in memory (avoid memory leaks)
  const prevAnnotatedUrlRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (
      prevAnnotatedUrlRef.current &&
      prevAnnotatedUrlRef.current !== annotatedReportImageUrl &&
      prevAnnotatedUrlRef.current.startsWith("blob:")
    ) {
      URL.revokeObjectURL(prevAnnotatedUrlRef.current);
    }
    prevAnnotatedUrlRef.current = annotatedReportImageUrl;

    return () => {
      if (prevAnnotatedUrlRef.current && prevAnnotatedUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(prevAnnotatedUrlRef.current);
        prevAnnotatedUrlRef.current = null;
      }
    };
  }, [annotatedReportImageUrl]);

  // Clean up any in-flight requests and timers on unmount
  React.useEffect(() => {
    return () => {
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const handlePreprocessingChange = React.useCallback((preprocessing: boolean) => {
    setIsPreprocessing(preprocessing);
    if (preprocessing) {
      setStatusAnnouncement("Preparing image…");
    }
  }, []);

  const handleFileSelect = (
    file: File | null,
    payload?: File | null,
    optimization?: import("@/lib/colony-image-preprocessor").ImageOptimizationSuccess | null,
  ) => {
    // Abort active analysis and clear timer if any
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!file) {
      setActiveDemo(null);
      setStatusAnnouncement("Image removed. Upload a new specimen to begin.");
    } else if (activeDemo && file.name !== activeDemo.filename) {
      setActiveDemo(null);
    }

    setFailedDemo(null);
    setSelectedFile(file);
    setUploadPayload(payload ?? file);
    setOptimizationInfo(optimization ?? null);
    setAnalysisResult(null);
    setErrorMessage(null);
    setErrorDetails(null);
    setCfuData(null);
    setAnnotatedReportImageUrl(null);
    setAnalyzingSubStage("initial");
    setMeasuredDurationSec(null);

    if (file) {
      setPageState("READY");
    } else {
      setPageState("EMPTY");
    }
  };

  const handleSelectDemo = async (demo: DemoPlateItem) => {
    if (pageState === "ANALYZING") return;
    setLoadingDemoId(demo.id);
    setFailedDemo(null);
    try {
      const file = await fetchDemoPlateFile(demo);
      setActiveDemo(demo);
      handleFileSelect(file, file, null);
      setStatusAnnouncement(`Demo plate loaded: ${demo.name}.`);
    } catch (err: unknown) {
      console.error("Failed to load demo plate file:", err);
      setFailedDemo(demo);
      setPageState("ERROR");
      setErrorMessage(
        "Demo plate couldn't be loaded. Unable to load demo image file. Please try again or upload your own image.",
      );
      setErrorDetails(
        `Failed to retrieve demonstration image (${demo.name}). You can retry loading the demo plate or upload your own Petri dish photo.`,
      );
      setStatusAnnouncement(`Unable to load demo image file: ${demo.name}. Please try again.`);
    } finally {
      setLoadingDemoId(null);
    }
  };

  const handleAnalyze = async () => {
    const fileToUpload = uploadPayload || selectedFile;
    if (!fileToUpload || pageState === "ANALYZING" || isPreprocessing) return;

    setPageState("ANALYZING");
    setAnalyzingSubStage("initial");
    setMeasuredDurationSec(null);
    setErrorMessage(null);
    setErrorDetails(null);

    const startAnnouncement = activeDemo
      ? "Analyzing demo plate. Analyzing culture plate."
      : "Analyzing culture plate. Analyzing colony image…";
    setStatusAnnouncement(startAnnouncement);

    if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
    waitingTimerRef.current = setTimeout(() => {
      setAnalyzingSubStage("waiting");
      setStatusAnnouncement("Detecting colonies and preparing results…");
    }, 1200);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startTime = performance.now();

    try {
      const response = await detectColonies(fileToUpload, {
        confidenceThreshold,
        signal: controller.signal,
      });

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      setMeasuredDurationSec(elapsed);
      setAnalysisResult(response);
      setPageState("SUCCESS");
      setStatusAnnouncement("Analysis complete. Colony detection results are ready.");
    } catch (err: unknown) {
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      setAnalyzingSubStage("initial");

      // Ignore user-initiated aborts
      if (err instanceof ColonyDetectionApiError && err.code === "REQUEST_ABORTED") {
        setPageState(selectedFile ? "READY" : "EMPTY");
        setStatusAnnouncement("Analysis cancelled.");
        return;
      }

      setPageState("ERROR");

      if (err instanceof ColonyDetectionApiError) {
        if (err.code === "NETWORK_ERROR") {
          setErrorMessage(
            "We couldn't reach the colony analysis service. Check your connection and try again.",
          );
          setErrorDetails(
            (err.message ? `${err.message} ` : "") +
              "The Colony Detection Python ML service is currently offline or unreachable. Please verify network connectivity and ensure the local backend server is running.",
          );
          setStatusAnnouncement(
            "We couldn't reach the colony analysis service. Check your connection and try again.",
          );
        } else if (err.code === "REQUEST_TIMEOUT") {
          setErrorMessage("Analysis timed out. Please try again.");
          setErrorDetails(
            "The colony detection request timed out before receiving a response from the ML microservice. The server may be busy or experiencing high latency. Your uploaded image is still loaded and ready to retry.",
          );
          setStatusAnnouncement("Analysis timed out. Please try again.");
        } else if (err.code === "RATE_LIMIT_EXCEEDED" || err.status === 429) {
          setErrorMessage("Too many analysis requests. Please wait and try again.");
          setErrorDetails(
            "Colony analysis requests are throttled to protect shared laboratory compute resources. Please wait a moment before analyzing your next plate. Your uploaded image is still loaded.",
          );
          setStatusAnnouncement("Too many analysis requests. Please wait and try again.");
        } else if (err.status === 413 || err.code === "PAYLOAD_TOO_LARGE") {
          setErrorMessage("The image is too large to process. Try a smaller image.");
          setErrorDetails(
            "Image file exceeds maximum upload size. The image file size exceeds the server's maximum upload limit. Please select an image under 10 MB or use an optimized photograph.",
          );
          setStatusAnnouncement("The image is too large to process. Try a smaller image.");
        } else if (err.status) {
          setErrorMessage("Analysis service returned an error. Please try again.");
          setErrorDetails(
            `Server returned HTTP ${err.status} (${err.code || "SERVICE_ERROR"}). Your specimen image is still loaded and ready to retry.`,
          );
          setStatusAnnouncement("Analysis service returned an error. Please try again.");
        } else {
          setErrorMessage("Analysis service returned an error. Please try again.");
          setErrorDetails(
            err.message ||
              "An unexpected error occurred while analyzing the image. Your specimen image is still loaded and ready to retry.",
          );
          setStatusAnnouncement("Analysis service returned an error. Please try again.");
        }
      } else if (err instanceof Error) {
        setErrorMessage("Analysis service returned an error. Please try again.");
        setErrorDetails(err.message);
        setStatusAnnouncement("Analysis service returned an error. Please try again.");
      } else {
        setErrorMessage("Analysis service returned an error. Please try again.");
        setErrorDetails(
          "An unexpected error occurred while analyzing the image. Your specimen image is still loaded. Please try again.",
        );
        setStatusAnnouncement("Analysis service returned an error. Please try again.");
      }
    } finally {
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current);
        waitingTimerRef.current = null;
      }
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPageState(selectedFile ? "READY" : "EMPTY");
    setAnalyzingSubStage("initial");
    setStatusAnnouncement("Analysis cancelled.");
  };

  const handleReset = () => {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setFailedDemo(null);
    setAnalyzingSubStage("initial");
    setMeasuredDurationSec(null);
    handleFileSelect(null);
    setStatusAnnouncement("Workspace reset. No image selected.");
  };

  const confidencePercentage = Math.round(confidenceThreshold * 100);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main className="flex-1">
        {/* Screen-reader live region for asynchronous workflow status updates */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="colony-counter-status-announcer"
        >
          {statusAnnouncement}
        </div>

        {/* Page Header */}
        <section className="relative overflow-hidden border-b border-border/60 bg-surface/30 print:hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-40">
            <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-researcher/10 blur-3xl" />
            <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-student/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-6 sm:pb-12 sm:pt-32">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge
                variant="outline"
                className="border-researcher/40 text-researcher bg-researcher-soft/40 gap-1.5 py-1 px-3"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Microbiology AI Suite
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">v1.0-preview</span>
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              AI Petri Dish Colony Counter
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Upload a Petri dish image to detect colonies, review the detections, calculate CFU/mL,
              and export the analysis.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 text-researcher shrink-0" />
              <span>
                Images are processed directly by the colony detection engine and are not permanently
                stored on public servers.
              </span>
            </div>

            {/* Product Overview: Judge-Friendly Key Capabilities & Transparency */}
            <div
              className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-4xl"
              data-testid="product-overview-card"
            >
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 backdrop-blur-xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-researcher shrink-0" aria-hidden="true" />
                  <span>Automated Detection</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Colonies detected automatically from the image using YOLO11n object localization
                  with configurable confidence cutoff.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 backdrop-blur-xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                  <UserCheck className="h-3.5 w-3.5 text-student shrink-0" aria-hidden="true" />
                  <span>Human Review</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Review the detections and remove or add colonies when needed. Detections can be
                  reviewed and manually adjusted before using the reviewed count.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-surface/60 p-3.5 backdrop-blur-xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                  <span>Quantify & Export</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Calculate CFU/mL using the reviewed count, then export summary CSV, detection
                  coordinates, or printable PDF lab documentation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Workspace */}
        <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 print:hidden">
          {/* Guided Workflow Tracker */}
          <div className="mb-6 sm:mb-8">
            <ColonyWorkflowGuide
              selectedFile={selectedFile}
              activeDemo={activeDemo}
              pageState={pageState}
              hasModifications={review.hasModifications}
              cfuCalculated={!!cfuData?.isValid}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Upload & Controls (5 cols on desktop) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Image Upload Card */}
              <Card className="border-border/80 bg-surface-elevated shadow-xs">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-base font-semibold">Specimen Image</CardTitle>
                  <CardDescription className="text-xs">
                    Upload a high-contrast top-down photo of your agar Petri dish.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  <PetriDishUploader
                    selectedFile={selectedFile}
                    previewUrl={previewUrl}
                    optimizationInfo={optimizationInfo}
                    onFileSelect={handleFileSelect}
                    onPreprocessingChange={handlePreprocessingChange}
                    disabled={pageState === "ANALYZING" || isPreprocessing}
                    isDemo={!!activeDemo}
                  />
                </CardContent>
              </Card>

              {/* Try a Demo Plate Card */}
              <ColonyDemoPlates
                onSelectDemo={handleSelectDemo}
                selectedDemoId={activeDemo?.id}
                loadingDemoId={loadingDemoId}
                disabled={pageState === "ANALYZING" || isPreprocessing}
              />

              {/* Analysis Parameters Card */}
              <Card className="border-border/80 bg-surface-elevated shadow-xs">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Sliders className="h-4 w-4 text-researcher" />
                      Detection Parameters
                    </CardTitle>
                    <span className="font-mono text-xs font-semibold text-foreground bg-surface px-2 py-0.5 rounded border border-border">
                      {confidencePercentage}%
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Adjust model sensitivity cutoff for colony classification.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-2 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Confidence Threshold</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        0.20 – 0.90
                      </span>
                    </div>

                    <Slider
                      value={[confidenceThreshold]}
                      min={0.2}
                      max={0.9}
                      step={0.05}
                      disabled={pageState === "ANALYZING" || isPreprocessing}
                      onValueChange={(val) => {
                        if (val[0] !== undefined) {
                          setConfidenceThreshold(Number(val[0].toFixed(2)));
                        }
                      }}
                      className="py-1 cursor-pointer"
                      aria-label="Confidence threshold slider"
                    />

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Higher Recall (0.20)</span>
                      <span>Initial Default (0.30)</span>
                      <span>Higher Precision (0.90)</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Detections with model confidence below this score are excluded from the total
                    count. Note that 30% is an initial UI default and should be calibrated based on
                    plate lighting and culture density.
                  </p>

                  {/* Actions & Staged Loading Area */}
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!selectedFile || pageState === "ANALYZING" || isPreprocessing}
                        aria-busy={pageState === "ANALYZING" || isPreprocessing}
                        aria-label={
                          pageState === "ANALYZING"
                            ? activeDemo
                              ? "Analyzing demo plate…"
                              : "Analyzing colony image…"
                            : isPreprocessing
                              ? "Preparing image…"
                              : pageState === "SUCCESS"
                                ? "Re-analyze Petri dish plate"
                                : "Analyze Petri dish plate"
                        }
                        className="flex-1 font-medium text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {pageState === "ANALYZING" || isPreprocessing ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                            <span>
                              {isPreprocessing
                                ? "Preparing image…"
                                : activeDemo
                                  ? "Analyzing demo plate…"
                                  : "Analyzing colony image…"}
                            </span>
                          </>
                        ) : pageState === "SUCCESS" ? (
                          <>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Re-analyze Plate
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-researcher" aria-hidden="true" />
                            Analyze Petri Dish
                          </>
                        )}
                      </Button>

                      {pageState === "ANALYZING" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          aria-label="Cancel colony analysis"
                          className="text-xs font-medium border-border/80 shrink-0"
                        >
                          Cancel Analysis
                        </Button>
                      )}

                      {selectedFile && pageState !== "ANALYZING" && !isPreprocessing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleReset}
                          aria-label="Clear image and results"
                          className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                          title="Clear image and results"
                        >
                          Reset
                        </Button>
                      )}
                    </div>

                    {/* Compact Analysis Loading Status Area */}
                    {(pageState === "READY" ||
                      pageState === "ANALYZING" ||
                      isPreprocessing ||
                      pageState === "ERROR" ||
                      (pageState === "SUCCESS" && measuredDurationSec)) && (
                      <div
                        data-testid="analysis-loading-status"
                        className={cn(
                          "rounded-lg border p-2.5 text-xs transition-colors",
                          pageState === "ANALYZING" || isPreprocessing
                            ? "border-researcher/30 bg-researcher-soft/20 text-foreground"
                            : pageState === "SUCCESS"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                              : pageState === "ERROR"
                                ? "border-destructive/30 bg-destructive/5 text-foreground"
                                : "border-border/60 bg-surface/50 text-muted-foreground",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          {pageState === "ANALYZING" || isPreprocessing ? (
                            <Loader2
                              className="h-4 w-4 animate-spin text-researcher shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          ) : pageState === "SUCCESS" ? (
                            <CheckCircle2
                              className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <Sparkles
                              className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          )}
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="font-semibold text-xs text-foreground flex items-center justify-between gap-2">
                              <span data-testid="analysis-status-text">
                                {isPreprocessing
                                  ? "Preparing image…"
                                  : pageState === "ANALYZING"
                                    ? analyzingSubStage === "waiting"
                                      ? "Detecting colonies and preparing results…"
                                      : activeDemo
                                        ? "Analyzing demo plate…"
                                        : "Analyzing colony image…"
                                    : pageState === "SUCCESS"
                                      ? "Analysis complete."
                                      : pageState === "ERROR"
                                        ? "Ready to retry"
                                        : "Ready to analyze"}
                              </span>
                              {pageState === "SUCCESS" && measuredDurationSec && (
                                <span className="font-mono text-[11px] text-muted-foreground font-normal shrink-0">
                                  {measuredDurationSec}s
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {isPreprocessing
                                ? "Optimizing high-resolution photograph for colony detection."
                                : pageState === "ANALYZING"
                                  ? analyzingSubStage === "waiting"
                                    ? "Detecting colonies and preparing results…"
                                    : "Colony detection may take a few moments for larger images."
                                  : pageState === "SUCCESS" && measuredDurationSec
                                    ? `Analysis completed in ${measuredDurationSec}s`
                                    : pageState === "ERROR"
                                      ? "Analysis encountered an issue. Click Retry to run analysis again."
                                      : activeDemo
                                        ? "Demo plate loaded. Click Analyze to start detection."
                                        : "Image loaded. Click Analyze to run YOLO colony detection."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Post-Analysis Process Explanation */}
                  <div
                    className="rounded-lg border border-border/60 bg-surface/60 p-2.5 text-[11px] text-muted-foreground leading-relaxed"
                    data-testid="post-analyze-explanation"
                  >
                    <span className="font-semibold text-foreground block mb-0.5">
                      What happens after Analyze?
                    </span>
                    After analysis, detected colonies are shown on the plate. You can review the
                    detections, remove false detections, add missed colonies, and use the reviewed
                    count for downstream calculations.
                  </div>
                </CardContent>
              </Card>

              {/* Research Guidance Note */}
              <div className="rounded-xl border border-border/60 bg-surface/40 p-4 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="h-3.5 w-3.5 text-student" aria-hidden="true" />
                  Best Practices for Reliable Detection
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
                  <li>Use uniform, diffuse illumination to minimize Petri dish lid glare.</li>
                  <li>Position camera directly perpendicular (top-down) to the agar surface.</li>
                  <li>Ensure agar plate fills the majority of the image frame.</li>
                </ul>
              </div>
            </div>

            {/* Right Column: Visualization & Results (7 cols on desktop) */}
            <div className="space-y-6 lg:col-span-7">
              {/* STATE 1: Analyzing in Progress */}
              {pageState === "ANALYZING" && (
                <Card
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  data-testid="analyzing-state-panel"
                  className="border-border/80 bg-surface-elevated p-12 text-center shadow-xs"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-researcher/30 bg-researcher-soft/50 text-researcher shadow-inner">
                    <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                    {activeDemo ? "Analyzing Demo Plate…" : "Analyzing Petri dish..."}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    {analyzingSubStage === "waiting"
                      ? "Detecting colonies and preparing results…"
                      : "Executing YOLO colony detection and localization. Colony detection may take a few moments for larger images."}
                  </p>
                </Card>
              )}

              {/* STATE 2: Error Alert */}
              {pageState === "ERROR" && (
                <Card
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                  data-testid="colony-error-card"
                  className="border-destructive/30 bg-destructive/5 shadow-xs"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                        <AlertCircle className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="text-sm font-semibold text-destructive">
                          Detection Request Failed
                        </h3>
                        <p className="text-xs text-foreground/90 font-medium">{errorMessage}</p>
                        {errorDetails && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {errorDetails}
                          </p>
                        )}
                        {/* State preservation indicator: communicates if user image/data is preserved */}
                        {selectedFile ? (
                          <div
                            data-testid="state-preservation-indicator"
                            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                          >
                            <Sparkles className="h-3 w-3 text-researcher shrink-0" aria-hidden="true" />
                            <span>
                              Specimen retained: <strong className="font-medium text-foreground">{selectedFile.name}</strong> (Ready to retry)
                            </span>
                          </div>
                        ) : failedDemo ? (
                          <div
                            data-testid="state-preservation-indicator"
                            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-surface/60 px-2.5 py-1 text-[11px] text-muted-foreground"
                          >
                            <FlaskConical className="h-3 w-3 text-student shrink-0" aria-hidden="true" />
                            <span>
                              Demo selection: <strong className="font-medium text-foreground">{failedDemo.name}</strong> (Ready to retry)
                            </span>
                          </div>
                        ) : null}

                        <div className="pt-2 flex flex-wrap items-center gap-3">
                          {selectedFile && (
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              onClick={handleAnalyze}
                              aria-label="Retry colony analysis"
                              className="text-xs"
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Retry Analysis
                            </Button>
                          )}
                          {failedDemo && (
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              onClick={() => handleSelectDemo(failedDemo)}
                              aria-label="Retry demo plate"
                              className="text-xs"
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Retry Demo
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleReset}
                            aria-label="Use different image"
                            className="text-xs"
                          >
                            Use Different Image
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* STATE 3: Success with real API response */}
              {pageState === "SUCCESS" && analysisResult && previewUrl && (
                <div className="space-y-6">
                  {/* Visual Detection Canvas */}
                  <Card className="border-border/80 bg-surface-elevated overflow-hidden shadow-xs">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-researcher" />
                          Detection & Review Canvas
                        </CardTitle>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Badge variant="outline">
                            AI: {analysisResult.count}
                          </Badge>
                          {review.hasModifications && (
                            <Badge
                              variant="outline"
                              className="border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold"
                            >
                              Reviewed: {review.reviewedCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Review the detections and remove or add colonies when needed. AI detections:
                        Colonies detected automatically from the image. Reviewed count: The count
                        after the available review changes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <ColonyDetectionCanvas
                        originalImageUrl={previewUrl}
                        annotatedImageUrl={resolveAnnotatedImageUrl(analysisResult.annotated_image_url)}
                        detections={analysisResult.detections}
                        imageMetadata={analysisResult.image}
                        removedAiIndices={review.removedAiIndices}
                        manualColonies={review.manualColonies}
                        activeTool={review.activeTool}
                        onToggleAiDetection={review.toggleAiDetection}
                        onAddManualColony={review.addManualColony}
                        onRemoveManualColony={review.removeManualColony}
                        onSetActiveTool={review.setActiveTool}
                        reviewedCount={review.reviewedCount}
                      />
                    </CardContent>
                  </Card>

                  {/* Quantification Stats Panel */}
                  <ColonyResultsPanel
                    response={analysisResult}
                    appliedThreshold={confidenceThreshold}
                    reviewedCount={review.reviewedCount}
                    removedCount={review.removedCount}
                    addedCount={review.addedCount}
                    hasModifications={review.hasModifications}
                    onResetReview={review.resetReview}
                    filename={selectedFile?.name}
                    originalImageUrl={previewUrl || undefined}
                    manualColonies={review.manualColonies}
                    removedAiIndices={review.removedAiIndices}
                    cfuData={cfuData}
                    onCalculationChange={handleCalculationChange}
                    onSetAnnotatedReportImage={setAnnotatedReportImageUrl}
                    isDemoPlate={!!activeDemo}
                  />
                </div>
              )}

              {/* STATE 4: Empty Idle State */}
              {pageState === "EMPTY" && (
                <Card
                  data-testid="colony-empty-state"
                  className="border-dashed border-border/80 bg-surface/30 p-10 text-center shadow-none"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-surface-elevated text-muted-foreground">
                    <FlaskConical className="h-6 w-6 opacity-60" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                    No Specimen Selected
                  </h3>
                  <p className="mt-1 text-xs font-medium text-foreground max-w-sm mx-auto leading-relaxed">
                    Upload a Petri dish image or choose a demo plate to begin.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Upload a culture plate image or choose a demo plate to begin automated colony counting.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById("petri-dish-file-input");
                        if (input) input.click();
                      }}
                      aria-label="Upload Petri dish specimen"
                      className="text-xs"
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Upload Specimen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSelectDemo(DEMO_PLATES[0])}
                      aria-label="Try demo plate A"
                      className="text-xs"
                    >
                      <FlaskConical className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Try Demo Plate A
                    </Button>
                  </div>
                </Card>
              )}

              {/* STATE 5: Ready for Analysis State */}
              {pageState === "READY" && (
                <Card
                  data-testid="colony-ready-state"
                  className="border-dashed border-border/80 bg-surface/30 p-10 text-center shadow-none"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-surface-elevated text-muted-foreground">
                    <FlaskConical className="h-6 w-6 opacity-60" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                    Ready for Analysis
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Click 'Analyze Petri Dish' to run colony detection. After analysis, detected colonies are shown on the plate. You can review the detections, remove false detections, add missed colonies, and use the reviewed count for downstream calculations.
                  </p>
                  {selectedFile && (
                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-researcher" aria-hidden="true" />
                      <span>Specimen selected: <strong className="font-medium text-foreground">{selectedFile.name}</strong></span>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </section>
      </main>

      <div className="print:hidden">
        <SiteFooter />
      </div>

      {/* Dedicated Printable PDF Lab Report */}
      {analysisResult && (
        <ColonyPrintReport
          filename={selectedFile?.name}
          response={analysisResult}
          appliedThreshold={confidenceThreshold}
          reviewedCount={review.reviewedCount}
          removedCount={review.removedCount}
          addedCount={review.addedCount}
          hasModifications={review.hasModifications}
          cfuData={cfuData}
          annotatedImageUrl={annotatedReportImageUrl || previewUrl || undefined}
          isDemoPlate={!!activeDemo}
        />
      )}
    </div>
  );
}
