import * as React from "react";
import {
  FlaskConical,
  Clock,
  Gauge,
  ExternalLink,
  Target,
  BarChart3,
  AlertTriangle,
  AlertCircle,
  Info,
  UserCheck,
  RotateCcw,
  CheckCircle2,
  MinusCircle,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CfuCalculator } from "@/components/tools/CfuCalculator";
import { ColonyExportActions } from "@/components/tools/ColonyExportActions";
import { cn } from "@/lib/utils";
import { resolveAnnotatedImageUrl, type ColonyDetectionSuccessResponse } from "@/lib/colony-api";
import type { ManualColony } from "@/hooks/use-colony-review";
import type { CfuExportData } from "@/lib/colony-export";

export interface ColonyResultsPanelProps {
  response: ColonyDetectionSuccessResponse;
  appliedThreshold?: number;
  className?: string;
  /** Human-reviewed colony count derived from AI count - removed + added */
  reviewedCount?: number;
  /** Number of AI detections flagged as false positives / removed */
  removedCount?: number;
  /** Number of missed colonies manually added by reviewer */
  addedCount?: number;
  /** Whether any human corrections exist */
  hasModifications?: boolean;
  /** Reset review callback to clear human adjustments */
  onResetReview?: () => void;
  /** Uploaded image filename for sanitized export naming */
  filename?: string | null;
  /** Source preview image URL for offscreen canvas compositing */
  originalImageUrl?: string | null;
  /** Array of human-placed manual colonies */
  manualColonies?: ManualColony[];
  /** Set of removed AI detection indices */
  removedAiIndices?: Set<number>;
  /** Optional pre-lifted CFU calculation state snapshot */
  cfuData?: CfuExportData | null;
  /** Callback fired when CFU calculator state updates */
  onCalculationChange?: (data: CfuExportData | null) => void;
  /** Callback to store prepared annotated image data URL for print report */
  onSetAnnotatedReportImage?: (url: string) => void;
  /** Whether the analyzed image is a synthetic demonstration plate */
  isDemoPlate?: boolean;
}

export function ColonyResultsPanel({
  response,
  appliedThreshold = 0.3,
  className,
  reviewedCount,
  removedCount = 0,
  addedCount = 0,
  hasModifications = false,
  onResetReview,
  filename,
  originalImageUrl,
  manualColonies = [],
  removedAiIndices = new Set(),
  cfuData: externalCfuData,
  onCalculationChange,
  onSetAnnotatedReportImage,
  isDemoPlate = false,
}: ColonyResultsPanelProps) {
  const { count, detections, processing_time_ms, image, annotated_image_url, quality } = response;

  // Local CFU calculation state if not provided externally
  const [internalCfuData, setInternalCfuData] = React.useState<CfuExportData | null>(null);
  const activeCfuData = externalCfuData !== undefined ? externalCfuData : internalCfuData;

  const handleCfuCalculationChange = React.useCallback(
    (data: CfuExportData | null) => {
      setInternalCfuData((prev) => {
        if (!prev && !data) return prev;
        if (prev && data && JSON.stringify(prev) === JSON.stringify(data)) return prev;
        return data;
      });
      onCalculationChange?.(data);
    },
    [onCalculationChange],
  );

  // Effective reviewed count (defaults to automated AI count if no review in progress)
  const effectiveReviewedCount = typeof reviewedCount === "number" ? reviewedCount : count;

  // Resolve density tier & review recommendation with fallback
  const densityLevel =
    quality?.density_level ??
    (count > 400 ? "ultra_high" : count > 200 ? "high" : count >= 50 ? "medium" : "low");

  const reviewRecommended = quality?.review_recommended ?? count > 200;

  const warningMessage =
    quality?.warning_message ??
    (count > 400
      ? "Very high-density plate detected. Individual colonies may overlap or form confluent regions. Manual verification is strongly recommended."
      : count > 200
        ? "High-density plate detected. Automated count may be less reliable in crowded colony regions. Manual verification is recommended."
        : null);

  const confluenceRisk = quality?.confluence_risk ?? (count > 200 ? "high" : "low");
  const overlapRatio = quality?.overlap_ratio;

  // Calculate statistics from the real detection list
  const stats = React.useMemo(() => {
    if (!detections || detections.length === 0) {
      return {
        avgConfidence: 0,
        minConfidence: 0,
        maxConfidence: 0,
      };
    }

    const confidences = detections.map((d) => d.confidence);
    const sum = confidences.reduce((acc, val) => acc + val, 0);
    const avg = sum / confidences.length;
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);

    return {
      avgConfidence: Math.round(avg * 100),
      minConfidence: Math.round(min * 100),
      maxConfidence: Math.round(max * 100),
    };
  }, [detections]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Synthetic Demonstration Plate Notice */}
      {isDemoPlate && (
        <div
          role="note"
          aria-label="Synthetic demonstration plate notice"
          className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
        >
          <Info className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p>
            <strong>Synthetic Demonstration Plate:</strong> This plate is provided for software demonstration and user evaluation. Detections and quantification are generated by the production YOLO model on a synthetic test plate.
          </p>
        </div>
      )}

      {/* Density & Confluence Advisory Banner */}
      {reviewRecommended && warningMessage && (
        <div
          role="region"
          aria-label={
            densityLevel === "ultra_high"
              ? "Ultra-high density culture warning"
              : "High-density culture advisory"
          }
          className={cn(
            "rounded-xl border p-4 shadow-xs transition-all",
            densityLevel === "ultra_high"
              ? "border-rose-500/40 bg-rose-500/10 text-foreground"
              : "border-amber-500/40 bg-amber-500/10 text-foreground",
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                densityLevel === "ultra_high"
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400",
              )}
            >
              {densityLevel === "ultra_high" ? (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div className="flex-1 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">
                  {densityLevel === "ultra_high"
                    ? "Ultra-High Density Culture Warning"
                    : "High-Density Culture Advisory"}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-mono tracking-wider font-semibold",
                    densityLevel === "ultra_high"
                      ? "border-rose-500/50 text-rose-600 dark:text-rose-400"
                      : "border-amber-500/50 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {densityLevel === "ultra_high" ? "Confluence Risk" : "Review Recommended"}
                </Badge>
                {(densityLevel === "ultra_high" || confluenceRisk === "high") && (
                  <Badge
                    variant="outline"
                    className="border-rose-500/50 text-rose-600 dark:text-rose-400 font-mono text-[10px]"
                  >
                    Provisional — Potential TNTC
                  </Badge>
                )}
              </div>
              <p className="text-foreground/90 leading-relaxed">{warningMessage}</p>
              {(densityLevel === "ultra_high" || confluenceRisk === "high") && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Plate exceeds the recommended countable-density range (30–300 CFU). The
                  concentration estimate may undercount the true population when colonies are
                  crowded or confluent.
                </p>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span>
                  Operational Notice: Automated detection is calibrated for individual colonies. In
                  confluent lawns or dense clusters, physical boundaries merge. Serial dilution or
                  manual verification is recommended.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Result Summary & Count Lineage Card */}
      <Card
        className="border-border/80 bg-surface-elevated shadow-xs overflow-hidden"
        data-testid="primary-result-card"
        role="region"
        aria-label="Colony detection primary result and count lineage"
      >
        <CardHeader className="p-4 pb-3 border-b border-border/50 bg-surface/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Primary Result
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-[10px] gap-1 px-2 py-0.5",
                  hasModifications
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold"
                    : "border-border text-muted-foreground",
                )}
                data-testid="count-provenance-badge"
              >
                {hasModifications ? (
                  <>
                    <UserCheck className="h-3 w-3 text-violet-500" aria-hidden="true" />
                    <span>Human-reviewed count</span>
                  </>
                ) : (
                  <>
                    <FlaskConical className="h-3 w-3 text-researcher" aria-hidden="true" />
                    <span>AI detections</span>
                  </>
                )}
              </Badge>
            </div>

            {hasModifications && onResetReview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResetReview}
                aria-label="Reset all manual corrections to original AI count"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                title="Reset all manual corrections to original AI count"
              >
                <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
                Reset Review
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Main Colony Count Hero & Concise Provenance Line */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Reviewed colony count
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-foreground"
                  data-testid="primary-reviewed-count"
                >
                  {effectiveReviewedCount}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {effectiveReviewedCount === 1 ? "colony" : "colonies"}
                </span>
              </div>
              <p
                className="mt-1 text-xs text-muted-foreground font-medium"
                data-testid="provenance-summary-line"
              >
                {hasModifications
                  ? `AI detected ${count} · ${removedCount} removed · ${addedCount} manually added`
                  : `AI detected ${count} · No manual changes`}
              </p>
            </div>

            {/* Factual explanation of count source */}
            <div className="max-w-xs text-left sm:text-right text-[11px] text-muted-foreground" data-testid="count-provenance-explanation">
              <span className="block font-medium text-foreground/80">
                {hasModifications ? "Source: Human-reviewed count" : "Source: AI detections baseline"}
              </span>
              <span className="block text-[10px] mt-0.5 leading-relaxed">
                {hasModifications
                  ? "Human-reviewed count includes AI detections after removals and manual additions."
                  : "Review detections on the canvas using Select to remove false detections or Add Colony to add missed colonies."}
              </span>
            </div>
          </div>

          {/* Mathematical Count Lineage Breakdown */}
          <div
            className="rounded-xl border border-border/70 bg-surface/50 p-3 text-xs"
            data-testid="count-lineage-block"
            aria-label="Colony count calculation lineage"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
              <span>Count Lineage</span>
              <span className="font-mono text-[10px] normal-case text-muted-foreground">
                Mathematical Lineage
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* Lineage Item 1: AI Detected */}
              <div className="rounded-lg border border-border/60 bg-surface/80 p-2">
                <span className="text-[10px] text-muted-foreground block">AI detected</span>
                <div className="mt-0.5 font-mono text-base font-bold text-foreground" data-testid="lineage-ai-count">
                  {count}
                </div>
                <span className="text-[9px] text-muted-foreground">Automated model</span>
              </div>

              {/* Lineage Item 2: Removed */}
              <div className="rounded-lg border border-border/60 bg-surface/80 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground block">− Removed</span>
                  <MinusCircle className="h-3 w-3 text-rose-500/70" aria-hidden="true" />
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-base font-bold",
                    removedCount > 0 ? "text-rose-500" : "text-muted-foreground",
                  )}
                  data-testid="lineage-removed-count"
                >
                  {removedCount > 0 ? `−${removedCount}` : "0"}
                </div>
                <span className="text-[9px] text-muted-foreground">False positives</span>
              </div>

              {/* Lineage Item 3: Manual Added */}
              <div className="rounded-lg border border-border/60 bg-surface/80 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground block">+ Manual</span>
                  <PlusCircle className="h-3 w-3 text-violet-500/70" aria-hidden="true" />
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-base font-bold",
                    addedCount > 0 ? "text-violet-500" : "text-muted-foreground",
                  )}
                  data-testid="lineage-added-count"
                >
                  {addedCount > 0 ? `+${addedCount}` : "0"}
                </div>
                <span className="text-[9px] text-muted-foreground">Missed colonies</span>
              </div>

              {/* Lineage Item 4: Reviewed Count */}
              <div
                className={cn(
                  "rounded-lg border p-2 transition-colors",
                  hasModifications
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-border/70 bg-surface/80",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground block">= Reviewed count</span>
                  <CheckCircle2 className="h-3 w-3 text-researcher" aria-hidden="true" />
                </div>
                <div className="mt-0.5 font-mono text-base font-bold text-foreground" data-testid="lineage-reviewed-count">
                  {effectiveReviewedCount}
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {hasModifications ? "Human-reviewed count" : "Matches AI baseline"}
                </span>
              </div>
            </div>

            {/* Screen-reader accessible complete lineage string */}
            <p className="sr-only">
              Count lineage: AI detected {count} minus {removedCount} removed plus {addedCount} manual equals reviewed count {effectiveReviewedCount}.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plate Quality, Density & Screening Summary */}
      <Card
        className="border-border/80 bg-surface-elevated shadow-xs"
        data-testid="quality-density-summary"
        role="region"
        aria-label="Plate density, crowding, and review recommendation summary"
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Gauge className="h-4 w-4 text-startup" aria-hidden="true" />
              <span>Plate Density & Screening Indicators</span>
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-mono font-semibold uppercase tracking-wider",
                reviewRecommended
                  ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                  : "border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
              )}
              data-testid="review-recommendation-badge"
            >
              {reviewRecommended ? "Review Recommended" : "Review Available"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 space-y-3">
          {/* 3-Column Indicator Grid: Density, Overlap/Crowding, Review Recommendation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {/* 1. Density Tier */}
            <div className="rounded-lg border border-border/60 bg-surface/40 p-2.5 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Colony Density
              </span>
              <div className="font-medium text-foreground text-xs" data-testid="density-tier-label">
                {densityLevel === "ultra_high" && `Ultra-high density — ${count} detected colonies`}
                {densityLevel === "high" && `High density — ${count} detected colonies`}
                {densityLevel === "medium" && `Medium density — ${count} detected colonies`}
                {densityLevel === "low" && `Low density — ${count} detected colonies`}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {densityLevel === "ultra_high" && "Over 400 colonies. Confluent lawn / TNTC risk."}
                {densityLevel === "high" && "201–400 colonies. Crowded colony distribution."}
                {densityLevel === "medium" && "50–200 colonies. Standard countable range (30–300 CFU)."}
                {densityLevel === "low" && "Under 50 colonies. Dispersed colony distribution."}
              </p>
            </div>

            {/* 2. Detected Overlap & Crowding */}
            <div className="rounded-lg border border-border/60 bg-surface/40 p-2.5 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Detected Overlap & Crowding
              </span>
              <div className="font-medium text-foreground text-xs" data-testid="overlap-crowding-label">
                {typeof overlapRatio === "number" ? (
                  overlapRatio >= 0.25
                    ? `High detected overlap — ${Math.round(overlapRatio * 100)}%`
                    : overlapRatio >= 0.10
                      ? `Moderate detected overlap — ${Math.round(overlapRatio * 100)}%`
                      : `Low detected overlap — ${Math.round(overlapRatio * 100)}%`
                ) : (
                  `Confluence risk: ${confluenceRisk}`
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {confluenceRisk === "high"
                  ? "Adjacent colony borders merge; cluster separation may be required."
                  : confluenceRisk === "medium"
                    ? "Minor spatial overlap between nearby colonies."
                    : "Low spatial clustering; boundaries are well-separated."}
              </p>
            </div>

            {/* 3. Review Recommendation */}
            <div className="rounded-lg border border-border/60 bg-surface/40 p-2.5 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Review Status
              </span>
              <div className="font-medium text-foreground text-xs" data-testid="review-status-label">
                {reviewRecommended ? "Human review recommended" : "Human review is available"}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {reviewRecommended
                  ? (quality?.reason || "Plate density or detected overlap suggests human verification before reporting.")
                  : "Plate is within standard countable density. Detections can be refined as desired."}
              </p>
            </div>
          </div>

          {/* Contextual Non-ML Screening Explanation */}
          <div
            className="rounded-lg border border-border/50 bg-surface/30 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2"
            data-testid="quality-signal-explanation"
          >
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong>Quality Screening Notice: </strong>
              Density and overlap are screening indicators that help identify plates that may need closer human review. They do not represent model accuracy scores or certainty percentages.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: AI Baseline Count */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">AI Baseline Count</span>
              <FlaskConical className="h-4 w-4 text-researcher" aria-hidden="true" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl" data-testid="kpi-ai-count">
              {count}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {count === 1 ? "1 detection baseline" : `${count} detections baseline`}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Inference Latency */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Latency</span>
              <Clock className="h-4 w-4 text-student" aria-hidden="true" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {processing_time_ms}
              <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">YOLO inference time</p>
          </CardContent>
        </Card>

        {/* Card 3: Average Confidence */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Avg Confidence</span>
              <Gauge className="h-4 w-4 text-startup" aria-hidden="true" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {stats.avgConfidence}%
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {detections.length > 0
                ? `Range: ${stats.minConfidence}% - ${stats.maxConfidence}%`
                : "No detections"}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Cutoff Threshold */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Filter Applied</span>
              <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {typeof appliedThreshold === "number"
                ? `${Math.round(appliedThreshold * 100)}%`
                : "Default"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {image?.width && image?.height
                ? `${image.width}×${image.height} px source`
                : "Cutoff threshold"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scientific Utilities: Concentration Analysis & CFU Connection */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-student" aria-hidden="true" />
            <span>Scientific Utilities & Concentration Analysis</span>
          </div>
          <div
            className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"
            data-testid="cfu-source-connection"
          >
            <Info className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>
              {activeCfuData?.countSource === "custom"
                ? "CFU/mL uses a custom laboratory count."
                : activeCfuData?.countSource === "ai"
                  ? "CFU/mL uses the automated AI count."
                  : "CFU/mL uses the reviewed colony count."}
            </span>
          </div>
        </div>
        <CfuCalculator
          aiCount={count}
          reviewedCount={effectiveReviewedCount}
          hasModifications={hasModifications}
          quality={quality}
          onCalculationChange={handleCfuCalculationChange}
        />
      </div>

      {/* Breakdown Card: Quantification Summary */}
      <Card className="border-border/80 bg-surface-elevated shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-researcher" />
              Quantification Summary
            </CardTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              Class: colony (0)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Automated AI Detection Count</span>
            <span className="font-mono font-medium text-foreground">{count}</span>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Human-Reviewed Count</span>
            <span className="font-mono font-medium text-foreground">
              {effectiveReviewedCount}
              {hasModifications && (
                <span className="ml-1.5 text-[11px] text-violet-500 font-normal">
                  ({removedCount > 0 ? `−${removedCount} removed` : ""}{" "}
                  {addedCount > 0 ? `+${addedCount} added` : ""})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Manual Corrections</span>
            <span className="font-mono font-medium text-foreground">
              {hasModifications
                ? `${removedCount} removed, ${addedCount} added`
                : "No manual corrections"}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Operational Density Tier</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-mono",
                densityLevel === "ultra_high"
                  ? "border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                  : densityLevel === "high"
                    ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                    : "border-border text-foreground",
              )}
            >
              {densityLevel === "ultra_high"
                ? "Ultra-High (>400)"
                : densityLevel === "high"
                  ? "High (201-400)"
                  : densityLevel === "medium"
                    ? "Medium (50-200)"
                    : "Low (<50)"}
            </Badge>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Crowding / Confluence Risk</span>
            <div className="flex items-center gap-2">
              {typeof overlapRatio === "number" && (
                <span className="font-mono text-muted-foreground text-[11px]">
                  {Math.round(overlapRatio * 100)}% overlapping
                </span>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono",
                  confluenceRisk === "high"
                    ? "border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                    : confluenceRisk === "medium"
                      ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : "border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                )}
              >
                {confluenceRisk.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Inference Pipeline</span>
            <span className="font-mono font-medium text-foreground">Python + YOLO11n (best.pt)</span>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 py-1.5">
            <span className="text-muted-foreground">Analyzed Image Dimensions</span>
            <span className="font-mono font-medium text-foreground">
              {image?.width ?? "—"} × {image?.height ?? "—"} pixels
            </span>
          </div>

          {annotated_image_url && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">Server Annotation Artifact</span>
              <a
                href={resolveAnnotatedImageUrl(annotated_image_url) || annotated_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-student hover:underline"
              >
                View Full Image
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export & Lab Reports Action Area */}
      <ColonyExportActions
        filename={filename}
        response={response}
        appliedThreshold={appliedThreshold}
        reviewedCount={effectiveReviewedCount}
        removedCount={removedCount}
        addedCount={addedCount}
        manualColonies={manualColonies}
        removedAiIndices={removedAiIndices}
        cfuData={activeCfuData}
        originalImageUrl={originalImageUrl}
        onSetAnnotatedReportImage={onSetAnnotatedReportImage}
      />
    </div>
  );
}
