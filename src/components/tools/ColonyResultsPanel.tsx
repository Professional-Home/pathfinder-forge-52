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
  const { count, detections, processing_time_ms, image, annotated_image_url } = response;

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
