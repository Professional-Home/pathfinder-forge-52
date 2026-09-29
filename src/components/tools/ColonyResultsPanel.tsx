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
import type { ColonyDetectionSuccessResponse } from "@/lib/colony-api";
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

      {/* Human-in-the-Loop Manual Review Summary Section */}
      <Card className="border-border/80 bg-surface-elevated shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-violet-500" />
              <CardTitle className="text-sm font-semibold">Human-in-the-Loop Review</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasModifications ? (
                <>
                  <Badge
                    variant="outline"
                    className="border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-mono text-[10px]"
                  >
                    Human Reviewed
                  </Badge>
                  {onResetReview && (
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
                </>
              ) : (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                  No manual corrections
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {/* Metrics comparison grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
            {/* 1. Original AI Count */}
            <div className="rounded-lg border border-border/60 bg-surface/50 p-2.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                AI Count
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-foreground">{count}</div>
              <span className="text-[10px] text-muted-foreground">Automated result</span>
            </div>

            {/* 2. Removed AI False Positives */}
            <div className="rounded-lg border border-border/60 bg-surface/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Removed AI
                </span>
                <MinusCircle className="h-3 w-3 text-rose-500/70" />
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-rose-500">
                {removedCount > 0 ? `−${removedCount}` : "0"}
              </div>
              <span className="text-[10px] text-muted-foreground">False positives</span>
            </div>

            {/* 3. Manual Added Missed Colonies */}
            <div className="rounded-lg border border-border/60 bg-surface/50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Manual Added
                </span>
                <PlusCircle className="h-3 w-3 text-violet-500/70" />
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-violet-500">
                {addedCount > 0 ? `+${addedCount}` : "0"}
              </div>
              <span className="text-[10px] text-muted-foreground">Missed colonies</span>
            </div>

            {/* 4. Reviewed Count */}
            <div
              className={cn(
                "rounded-lg border p-2.5 transition-colors",
                hasModifications
                  ? "border-violet-500/50 bg-violet-500/5"
                  : "border-border/60 bg-surface/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Reviewed Count
                </span>
                <CheckCircle2 className="h-3 w-3 text-researcher" />
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-foreground">
                {effectiveReviewedCount}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {hasModifications ? "Human-reviewed result" : "Matches AI baseline"}
              </span>
            </div>
          </div>

          {/* Concise Review Guidance Notice */}
          <div className="rounded-lg border border-border/50 bg-surface/30 p-2.5 text-[11px] text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground font-medium">Review Guidance: </strong>
              Use Select to remove false positives or Add Colony to mark missed colonies.
            </p>
            <p className="text-[10px] text-muted-foreground/90">
              Manual changes affect the Reviewed Count only. The original AI count is preserved.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Effective Colony Count (Reviewed if modified, otherwise AI baseline) */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">
                {hasModifications ? "Reviewed Count" : "Total AI Count"}
              </span>
              <FlaskConical className="h-4 w-4 text-researcher" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {effectiveReviewedCount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {hasModifications
                ? `AI baseline: ${count} (${removedCount > 0 ? `−${removedCount}` : ""} ${addedCount > 0 ? `+${addedCount}` : ""})`
                : count === 1
                  ? "Colony identified"
                  : "Colonies identified"}
            </p>
          </CardContent>
        </Card>

        {/* Processing Time */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Latency</span>
              <Clock className="h-4 w-4 text-student" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {processing_time_ms}
              <span className="ml-1 text-sm font-normal text-muted-foreground">ms</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">YOLO inference time</p>
          </CardContent>
        </Card>

        {/* Average Confidence */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Avg Confidence</span>
              <Gauge className="h-4 w-4 text-startup" />
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

        {/* Resolution & Filter */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Filter Applied</span>
              <Target className="h-4 w-4 text-muted-foreground" />
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

      {/* Scientific Utilities: Concentration Analysis */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground font-medium">
          <Sparkles className="h-3.5 w-3.5 text-student" />
          <span>Scientific Utilities & Concentration Analysis</span>
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
            <span className="font-mono font-medium text-foreground">Python + YOLO (best.pt)</span>
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
                href={annotated_image_url}
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
