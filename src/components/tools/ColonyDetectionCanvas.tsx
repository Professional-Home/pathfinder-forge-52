import * as React from "react";
import {
  Eye,
  EyeOff,
  Tag,
  Layers,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
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

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.5;

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

  // Zoom and Pan states
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState<boolean>(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistanceRef = React.useRef<number | null>(null);
  const initialTouchZoomRef = React.useRef<number>(1);

  const imgWidth = imageMetadata?.width > 0 ? imageMetadata.width : 1024;
  const imgHeight = imageMetadata?.height > 0 ? imageMetadata.height : 1024;

  // Adaptive stroke & font sizing relative to image resolution
  const baseStrokeWidth = Math.max(2, Math.round(imgWidth / 400));
  const labelFontSize = Math.max(12, Math.round(imgWidth / 65));
  const labelPaddingX = Math.round(labelFontSize * 0.4);
  const labelHeight = Math.round(labelFontSize * 1.5);

  const hasDetections = detections.length > 0;

  // Clamps pan coordinates so the image doesn't get dragged completely off screen
  const clampPan = React.useCallback(
    (newX: number, newY: number, currentZoom: number): { x: number; y: number } => {
      if (currentZoom <= 1 || !containerRef.current) {
        return { x: 0, y: 0 };
      }

      const { clientWidth, clientHeight } = containerRef.current;
      const maxPanX = Math.max(0, (clientWidth * (currentZoom - 1)) / 2 + clientWidth * 0.15);
      const maxPanY = Math.max(0, (clientHeight * (currentZoom - 1)) / 2 + clientHeight * 0.15);

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
      };
    },
    [],
  );

  // Wheel zoom with passive: false to prevent scrolling page during Petri dish inspection
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((prevZoom) => {
        const nextZoom = Number(
          Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor)).toFixed(2),
        );
        if (nextZoom === 1) {
          setPan({ x: 0, y: 0 });
        } else {
          setPan((prevPan) => clampPan(prevPan.x, prevPan.y, nextZoom));
        }
        return nextZoom;
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [clampPan]);

  // Pointer drag panning (mouse and single-finger)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || e.button !== 0) return;

    setIsPanning(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || zoom <= 1) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const nextX = panStartRef.current.x + dx;
    const nextY = panStartRef.current.y + dy;

    setPan(clampPan(nextX, nextY, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may have already been released
      }
    }
  };

  // Two-finger pinch-to-zoom on touch devices
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      touchDistanceRef.current = dist;
      initialTouchZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const scale = dist / touchDistanceRef.current;
      const nextZoom = Number(
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialTouchZoomRef.current * scale)).toFixed(2),
      );
      setZoom(nextZoom);
      if (nextZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchDistanceRef.current = null;
    }
  };

  // Button actions
  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2)));
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2)));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      } else {
        setPan((curr) => clampPan(curr.x, curr.y, next));
      }
      return next;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

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

        {/* Right side: Zoom & Pan Toolbar + Detection Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Professional Zoom Controls Bar */}
          <div
            className="inline-flex items-center gap-0.5 rounded-lg border border-border/80 bg-surface-elevated p-0.5 shadow-xs"
            role="toolbar"
            aria-label="Zoom and pan view controls"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              title="Zoom Out (Mouse wheel down)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>

            <span
              className="min-w-[42px] px-1 text-center font-mono text-[11px] font-semibold text-foreground select-none"
              aria-live="polite"
              aria-label={`Current zoom level: ${Math.round(zoom * 100)} percent`}
            >
              {Math.round(zoom * 100)}%
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              title="Zoom In (Mouse wheel up)"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>

            <div className="h-4 w-px bg-border/80 mx-0.5" aria-hidden="true" />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetView}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              title="Reset zoom and framing (Fit to view)"
              aria-label="Reset View"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
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
      </div>

      {/* Main Image Viewport Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/80 bg-black/90 shadow-sm touch-none select-none",
          zoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default",
        )}
      >
        {/* Transform Layer applying synchronized zoom and pan to image and overlay */}
        <div
          className={cn(
            "relative aspect-square max-h-[560px] w-full overflow-hidden flex items-center justify-center",
            isPanning ? "transition-none" : "transition-transform duration-100 ease-out",
          )}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {viewMode === "server-annotated" && annotatedImageUrl ? (
            /* Mode 1: Server Annotated Image */
            <img
              src={annotatedImageUrl}
              alt="Server-annotated Petri dish colony detections"
              className="h-full w-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          ) : (
            /* Mode 2: Interactive SVG Vector Scaled Overlay */
            <>
              {/* Background Original Image */}
              <img
                src={originalImageUrl}
                alt="Petri dish specimen"
                className="h-full w-full object-contain pointer-events-none select-none"
                draggable={false}
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
                    const labelY =
                      det.y1 - labelHeight >= 0 ? det.y1 - labelHeight - 2 : det.y2 + 2;
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
            </>
          )}
        </div>

        {/* Floating summary badge */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1 text-[11px] font-mono text-foreground backdrop-blur-md shadow-sm border border-border/60">
          <CheckCircle2 className="h-3.5 w-3.5 text-researcher" />
          <span>
            {hasDetections
              ? `${detections.length} ${detections.length === 1 ? "colony" : "colonies"} detected`
              : "0 colonies detected"}
          </span>
          <span className="text-muted-foreground">
            ({imgWidth}×{imgHeight}px)
          </span>
          {zoom > 1 && (
            <span className="text-researcher font-semibold">
              · {Math.round(zoom * 100)}% zoom
            </span>
          )}
        </div>

        {/* Helper Hint when Zoomed */}
        {zoom > 1 && (
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground backdrop-blur-sm border border-border/40">
            <span>Drag to pan · Scroll to zoom</span>
          </div>
        )}
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
