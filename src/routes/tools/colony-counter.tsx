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
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PetriDishUploader } from "@/components/tools/PetriDishUploader";
import { ColonyDetectionCanvas } from "@/components/tools/ColonyDetectionCanvas";
import { ColonyResultsPanel } from "@/components/tools/ColonyResultsPanel";
import {
  detectColonies,
  ColonyDetectionApiError,
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

function ColonyCounterPage() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = React.useState<number>(0.3);
  const [pageState, setPageState] = React.useState<PageState>("EMPTY");
  const [analysisResult, setAnalysisResult] = React.useState<ColonyDetectionSuccessResponse | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [errorDetails, setErrorDetails] = React.useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Manage in-memory preview object URL
  React.useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Clean up any in-flight requests on unmount
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleFileSelect = (file: File | null) => {
    // Abort active analysis if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setSelectedFile(file);
    setAnalysisResult(null);
    setErrorMessage(null);
    setErrorDetails(null);

    if (file) {
      setPageState("READY");
    } else {
      setPageState("EMPTY");
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || pageState === "ANALYZING") return;

    setPageState("ANALYZING");
    setErrorMessage(null);
    setErrorDetails(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await detectColonies(selectedFile, {
        confidenceThreshold,
        signal: controller.signal,
      });

      setAnalysisResult(response);
      setPageState("SUCCESS");
    } catch (err: unknown) {
      // Ignore user-initiated aborts
      if (err instanceof ColonyDetectionApiError && err.code === "REQUEST_ABORTED") {
        setPageState(selectedFile ? "READY" : "EMPTY");
        return;
      }

      setPageState("ERROR");

      if (err instanceof ColonyDetectionApiError) {
        setErrorMessage(err.message);
        if (err.code === "NETWORK_ERROR") {
          setErrorDetails(
            "The Colony Detection Python ML service is currently offline or unreachable. Please verify that the microservice is running at the configured endpoint (default: http://localhost:8000).",
          );
        } else if (err.status) {
          setErrorDetails(`Server returned HTTP ${err.status} (${err.code}).`);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          "An unexpected error occurred while analyzing the image. Please try again.",
        );
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPageState(selectedFile ? "READY" : "EMPTY");
  };

  const handleReset = () => {
    handleFileSelect(null);
  };

  const confidencePercentage = Math.round(confidenceThreshold * 100);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Page Header */}
        <section className="relative overflow-hidden border-b border-border/60 bg-surface/30">
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
              Automated computer-vision detection and quantification of bacterial and fungal
              colonies from culture plate images. Designed for rapid screening, lab documentation,
              and research workflows.
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 text-researcher shrink-0" />
              <span>
                Images are processed directly by the colony detection engine and are not permanently
                stored on public servers.
              </span>
            </div>
          </div>
        </section>

        {/* Main Workspace */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
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
                    onFileSelect={handleFileSelect}
                    disabled={pageState === "ANALYZING"}
                  />
                </CardContent>
              </Card>

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
                      disabled={pageState === "ANALYZING"}
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

                  {/* Actions */}
                  <div className="pt-2 flex items-center gap-3">
                    {pageState === "ANALYZING" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        className="w-full text-xs font-medium border-border/80"
                      >
                        Cancel Analysis
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!selectedFile || pageState === "ANALYZING"}
                        className="w-full font-medium text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {pageState === "SUCCESS" ? (
                          <>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Re-analyze Plate
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-researcher" />
                            Analyze Petri Dish
                          </>
                        )}
                      </Button>
                    )}

                    {selectedFile && pageState !== "ANALYZING" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        title="Clear image and results"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Research Guidance Note */}
              <div className="rounded-xl border border-border/60 bg-surface/40 p-4 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Info className="h-3.5 w-3.5 text-student" />
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
                <Card className="border-border/80 bg-surface-elevated p-12 text-center shadow-xs">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-researcher/30 bg-researcher-soft/50 text-researcher shadow-inner">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                    Analyzing Petri dish...
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Executing YOLO colony detection and localization. Processing time is typically
                    under 500 ms.
                  </p>
                </Card>
              )}

              {/* STATE 2: Error Alert */}
              {pageState === "ERROR" && (
                <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                        <AlertCircle className="h-5 w-5" />
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
                        <div className="pt-2 flex items-center gap-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={handleAnalyze}
                            className="text-xs"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Retry Analysis
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleReset}
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
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-researcher" />
                          Detection Overlay
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {analysisResult.count}{" "}
                          {analysisResult.count === 1 ? "colony" : "colonies"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <ColonyDetectionCanvas
                        originalImageUrl={previewUrl}
                        annotatedImageUrl={analysisResult.annotated_image_url}
                        detections={analysisResult.detections}
                        imageMetadata={analysisResult.image}
                      />
                    </CardContent>
                  </Card>

                  {/* Quantification Stats Panel */}
                  <ColonyResultsPanel
                    response={analysisResult}
                    appliedThreshold={confidenceThreshold}
                  />
                </div>
              )}

              {/* STATE 4: Ready / Empty Idle State */}
              {(pageState === "EMPTY" || pageState === "READY") && (
                <Card className="border-dashed border-border/80 bg-surface/30 p-10 text-center shadow-none">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-surface-elevated text-muted-foreground">
                    <FlaskConical className="h-6 w-6 opacity-60" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                    {pageState === "READY" ? "Ready for Analysis" : "No Specimen Selected"}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {pageState === "READY"
                      ? "Click 'Analyze Petri Dish' to run colony detection and view bounding boxes with confidence scores."
                      : "Upload a culture plate image or capture one with your mobile camera to begin automated colony counting."}
                  </p>
                </Card>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
