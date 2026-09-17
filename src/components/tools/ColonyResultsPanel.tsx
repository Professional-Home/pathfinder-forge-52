import * as React from "react";
import {
  FlaskConical,
  Clock,
  Sparkles,
  Gauge,
  ExternalLink,
  Target,
  BarChart3,
  Layers,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColonyDetectionSuccessResponse } from "@/lib/colony-api";

export interface ColonyResultsPanelProps {
  response: ColonyDetectionSuccessResponse;
  appliedThreshold?: number;
  className?: string;
}

export function ColonyResultsPanel({
  response,
  appliedThreshold,
  className,
}: ColonyResultsPanelProps) {
  const { count, detections, processing_time_ms, image, annotated_image_url, quality } = response;

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
      {/* Density & Confluence Advisory Banner */}
      {reviewRecommended && warningMessage && (
        <div
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
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
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
              </div>
              <p className="text-foreground/90 leading-relaxed">{warningMessage}</p>
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

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Colony Count */}
        <Card className="border-border/80 bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">Total Count</span>
              <FlaskConical className="h-4 w-4 text-researcher" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-foreground sm:text-3xl">
              {count}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {count === 1 ? "Colony identified" : "Colonies identified"}
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

      {/* Breakdown Card */}
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
            <span className="text-muted-foreground">Verified Model Detections</span>
            <span className="font-mono font-medium text-foreground">{detections.length}</span>
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
    </div>
  );
}
