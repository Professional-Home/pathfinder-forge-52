import * as React from "react";
import { Eye, EyeOff, Tag, Layers, CheckCircle2, AlertCircle, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColonyDetection, ColonyImageMetadata } from "@/lib/colony-api";

export interface ColonyDetectionCanvasProps {
  originalImageUrl: string;
  annotatedImageUrl?: string;
  detections: ColonyDetection[];
  imageMetadata: ColonyImageMetadata;
  className?: string;
}

export function ColonyDetectionCanvas({
  originalImageUrl,
  annotatedImageUrl,
  detections,
  imageMetadata,
  className,
}: ColonyDetectionCanvasProps) {
  const [showBoxes, setShowBoxes] = React.useState(true);
  const [showLabels, setShowLabels] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<"overlay" | "server-annotated">(
    annotatedImageUrl ? "server-annotated" : "overlay",
  );
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const imgWidth = imageMetadata?.width > 0 ? imageMetadata.width : 1024;
  const imgHeight = imageMetadata?.height > 0 ? imageMetadata.height : 1024;

  // Adaptive stroke & font sizing relative to image resolution
  const baseStrokeWidth = Math.max(2, Math.round(imgWidth / 400));
  const labelFontSize = Math.max(12, Math.round(imgWidth / 65));
  const labelPaddingX = Math.round(labelFontSize * 0.4);
  const labelHeight = Math.round(labelFontSize * 1.5);

  const hasDetections = detections.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* View & Overlay Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface/60 p-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          {annotatedImageUrl ? (
            <div className="inline-flex rounded-lg border border-border/80 bg-surface-elevated p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("overlay")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "overlay"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Interactive Overlay
              </button>
              <button
                type="button"
                onClick={() => setViewMode("server-annotated")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  viewMode === "server-annotated"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Server Annotated
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-researcher" />
              <span className="font-medium text-foreground">Colony Detection Overlay</span>
            </div>
          )}
        </div>

        {/* Toggles available in overlay view mode */}
        {viewMode === "overlay" && hasDetections && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowBoxes((prev) => !prev)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {showBoxes ? (
                <>
                  <Eye className="mr-1 h-3 w-3 text-researcher" />
                  Boxes On
                </>
              ) : (
                <>
                  <EyeOff className="mr-1 h-3 w-3" />
                  Boxes Off
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowLabels((prev) => !prev)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Tag className={cn("mr-1 h-3 w-3", showLabels ? "text-student" : "")} />
              {showLabels ? "Labels On" : "Labels Off"}
            </Button>
          </div>
        )}
      </div>

      {/* Main Image Container */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-black/90 shadow-sm">
        {viewMode === "server-annotated" && annotatedImageUrl ? (
          /* Mode 1: Server Annotated Image */
          <div className="relative aspect-square max-h-[560px] w-full overflow-hidden flex items-center justify-center">
            <img
              src={annotatedImageUrl}
              alt="Server-annotated Petri dish colony detections"
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          /* Mode 2: Interactive SVG Vector Scaled Overlay */
          <div className="relative aspect-square max-h-[560px] w-full overflow-hidden flex items-center justify-center">
            {/* Background Original Image */}
            <img
              src={originalImageUrl}
              alt="Petri dish specimen"
              className="h-full w-full object-contain select-none"
            />

            {/* SVG Scaled Overlay */}
            {hasDetections && showBoxes && (
              <svg
                viewBox={`0 0 ${imgWidth} ${imgHeight}`}
                preserveAspectRatio="xMidYMid meet"
                className="pointer-events-auto absolute inset-0 h-full w-full"
                aria-label={`Visual overlay with ${detections.length} colony bounding boxes`}
              >
                {detections.map((det, index) => {
                  const boxWidth = Math.max(1, det.x2 - det.x1);
                  const boxHeight = Math.max(1, det.y2 - det.y1);
                  const isHovered = hoveredIndex === index;
                  const confidencePct = Math.round(det.confidence * 100);

                  const strokeColor = isHovered ? "#3b82f6" : "#10b981"; // blue when hovered, emerald default
                  const fillColor = isHovered
                    ? "rgba(59, 130, 246, 0.25)"
                    : "rgba(16, 185, 129, 0.15)";
                  const strokeW = isHovered ? baseStrokeWidth * 1.5 : baseStrokeWidth;

                  // Label coordinates (position above box, or below if near top)
                  const labelY = det.y1 - labelHeight >= 0 ? det.y1 - labelHeight - 2 : det.y2 + 2;
                  const labelX = Math.max(0, det.x1);
                  const labelText = `${det.class_name || "colony"} ${confidencePct}%`;
                  const estLabelWidth =
                    labelText.length * (labelFontSize * 0.65) + labelPaddingX * 2;

                  return (
                    <g
                      key={`colony-det-${index}`}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer transition-opacity"
                    >
                      {/* Bounding box rectangle */}
                      <rect
                        x={det.x1}
                        y={det.y1}
                        width={boxWidth}
                        height={boxHeight}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        rx={Math.max(2, Math.round(baseStrokeWidth))}
                      />

                      {/* Optional Confidence/Class Tag */}
                      {showLabels && (
                        <g transform={`translate(${labelX}, ${labelY})`}>
                          <rect
                            width={estLabelWidth}
                            height={labelHeight}
                            rx={Math.max(2, Math.round(labelHeight * 0.2))}
                            fill={strokeColor}
                            opacity={0.92}
                          />
                          <text
                            x={labelPaddingX}
                            y={labelHeight * 0.72}
                            fill="#ffffff"
                            fontSize={labelFontSize}
                            fontFamily="ui-monospace, monospace"
                            fontWeight="600"
                          >
                            {labelText}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}

        {/* Floating summary badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1 text-[11px] font-mono text-foreground backdrop-blur-md shadow-sm border border-border/60">
          <CheckCircle2 className="h-3.5 w-3.5 text-researcher" />
          <span>
            {hasDetections
              ? `${detections.length} ${detections.length === 1 ? "colony" : "colonies"} detected`
              : "0 colonies detected"}
          </span>
          <span className="text-muted-foreground">
            ({imgWidth}×{imgHeight}px)
          </span>
        </div>
      </div>

      {/* Zero Detections Notice */}
      {!hasDetections && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-surface-elevated p-3 text-xs text-muted-foreground"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-startup" />
          <span>
            No colonies were detected at the current confidence threshold. Try lowering the
            threshold or using a higher-contrast image.
          </span>
        </div>
      )}
    </div>
  );
}
