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
  MousePointer,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColonyDetection, ColonyImageMetadata } from "@/lib/colony-api";
import type { ManualColony, ReviewTool } from "@/hooks/use-colony-review";

export interface ColonyDetectionCanvasProps {
  originalImageUrl: string;
  annotatedImageUrl?: string;
  detections: ColonyDetection[];
  imageMetadata: ColonyImageMetadata;
  className?: string;
  /** Set of original detection array indices marked as removed */
  removedAiIndices?: Set<number>;
  /** Array of human-placed manual colonies */
  manualColonies?: ManualColony[];
  /** Active review tool mode */
  activeTool?: ReviewTool;
  /** Callback when user clicks an AI detection to remove or restore it */
  onToggleAiDetection?: (index: number) => void;
  /** Callback when user clicks image surface to place a manual colony */
  onAddManualColony?: (coords: { x: number; y: number }) => void;
  /** Callback when user removes a manual colony */
  onRemoveManualColony?: (id: string) => void;
  /** Callback when user switches review tool */
  onSetActiveTool?: (tool: ReviewTool) => void;
  /** Human-reviewed count for status badge */
  reviewedCount?: number;
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
  removedAiIndices,
  manualColonies = [],
  activeTool = "select",
  onToggleAiDetection,
  onAddManualColony,
  onRemoveManualColony,
  onSetActiveTool,
  reviewedCount,
}: ColonyDetectionCanvasProps) {
  const [showBoxes, setShowBoxes] = React.useState(true);
  const [showLabels, setShowLabels] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<"overlay" | "server-annotated">(
    annotatedImageUrl ? "server-annotated" : "overlay",
  );
  const [hoveredAiIndex, setHoveredAiIndex] = React.useState<number | null>(null);
  const [hoveredManualId, setHoveredManualId] = React.useState<string | null>(null);

  // Zoom and Pan states
  const [zoom, setZoom] = React.useState<number>(1);
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState<boolean>(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Pointer drag vs click disambiguation refs
  const pointerDownPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = React.useRef<boolean>(false);
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
    if (e.button !== 0) return;

    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    if (zoom > 1) {
      panStartRef.current = { ...pan };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || e.buttons !== 1) return;

    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;
    const dist = Math.hypot(dx, dy);

    // Only engage panning after pointer moves past threshold (5px) to prevent accidental drags
    if (dist > 5) {
      if (!isPanning) {
        setIsPanning(true);
        isDraggingRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Safe fallback if pointer capture fails
        }
      }
      const nextX = panStartRef.current.x + dx;
      const nextY = panStartRef.current.y + dy;
      setPan(clampPan(nextX, nextY, zoom));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
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

  // Button actions for zoom controls
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

  // SVG surface click handler for adding manual colonies
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Suppress colony addition if this interaction was a pan drag
    const dragDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y,
    );
    if (dragDist > 5 || isDraggingRef.current) {
      return;
    }

    if (activeTool !== "add" || !onAddManualColony) return;

    const svg = svgRef.current;
    if (!svg) return;

    // Zero-drift image-space coordinate mapping using native SVG transformation matrix
    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());

    // Verify pointer falls within natural image bounds
    if (svgPt.x >= 0 && svgPt.x <= imgWidth && svgPt.y >= 0 && svgPt.y <= imgHeight) {
      onAddManualColony({
        x: Math.round(svgPt.x),
        y: Math.round(svgPt.y),
      });
    }
  };

  // Determine viewport cursor style
  const getViewportCursor = () => {
    if (zoom > 1 && isPanning) return "cursor-grabbing";
    if (activeTool === "add" && viewMode === "overlay") return "cursor-crosshair";
    if (zoom > 1) return "cursor-grab";
    return "cursor-default";
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* View, Review Tools & Overlay Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface/60 p-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Phase 6B-2 Review Tools: [ Select ] [ + Add Colony ] */}
          {viewMode === "overlay" && onSetActiveTool && (
            <div
              className="inline-flex items-center rounded-lg border border-border/80 bg-surface-elevated p-0.5 shadow-xs"
              role="radiogroup"
              aria-label="Colony review tool mode"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="radio"
                aria-checked={activeTool === "select"}
                onClick={() => onSetActiveTool("select")}
                className={cn(
                  "h-7 gap-1 px-2.5 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:ring-primary",
                  activeTool === "select"
                    ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Select tool: click an AI box to mark/restore false positives, or click a manual colony to remove"
                aria-label="Select tool mode"
              >
                <MousePointer className="h-3 w-3" />
                <span>Select</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="radio"
                aria-checked={activeTool === "add"}
                onClick={() => onSetActiveTool("add")}
                className={cn(
                  "h-7 gap-1 px-2.5 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:ring-violet-500",
                  activeTool === "add"
                    ? "bg-violet-600 text-white shadow-xs hover:bg-violet-600 hover:text-white dark:bg-violet-500"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Add Colony tool: click on agar surface to place a manual colony marker"
                aria-label="Add Colony tool mode"
              >
                <Plus className="h-3 w-3" />
                <span>+ Add Colony</span>
              </Button>
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
          getViewportCursor(),
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
              {/* Background Original Specimen Image */}
              <img
                src={originalImageUrl}
                alt="Petri dish specimen"
                className="h-full w-full object-contain pointer-events-none select-none"
                draggable={false}
              />

              {/* Interactive Scaled SVG Overlay */}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${imgWidth} ${imgHeight}`}
                preserveAspectRatio="xMidYMid meet"
                onClick={handleSvgClick}
                className={cn(
                  "pointer-events-auto absolute inset-0 h-full w-full",
                  activeTool === "add" ? "cursor-crosshair" : "",
                )}
                aria-label={`Visual overlay with ${detections.length} AI detections and ${manualColonies.length} manual colonies`}
              >
                {/* 1. AI Detections Layer */}
                {hasDetections &&
                  showBoxes &&
                  detections.map((det, index) => {
                    const isRemoved = removedAiIndices?.has(index) ?? false;
                    const isHovered = hoveredAiIndex === index;
                    const boxWidth = Math.max(1, det.x2 - det.x1);
                    const boxHeight = Math.max(1, det.y2 - det.y1);
                    const confidencePct = Math.round(det.confidence * 100);

                    // Removed vs Active detection styling
                    let strokeColor: string;
                    let fillColor: string;
                    let strokeDasharray: string | undefined;

                    if (isRemoved) {
                      strokeColor = "#ef4444"; // red-500
                      fillColor = isHovered
                        ? "rgba(239, 68, 68, 0.20)"
                        : "rgba(239, 68, 68, 0.08)";
                      strokeDasharray = "4 3";
                    } else if (isHovered) {
                      strokeColor = "#3b82f6"; // blue-500 hover
                      fillColor = "rgba(59, 130, 246, 0.25)";
                      strokeDasharray = undefined;
                    } else {
                      strokeColor = "#10b981"; // emerald-500 normal
                      fillColor = "rgba(16, 185, 129, 0.15)";
                      strokeDasharray = undefined;
                    }

                    const strokeW = isHovered ? baseStrokeWidth * 1.5 : baseStrokeWidth;

                    // Label coordinates
                    const labelY =
                      det.y1 - labelHeight >= 0 ? det.y1 - labelHeight - 2 : det.y2 + 2;
                    const labelX = Math.max(0, det.x1);
                    const labelText = isRemoved
                      ? "REMOVED"
                      : `${det.class_name || "colony"} ${confidencePct}%`;
                    const estLabelWidth =
                      labelText.length * (labelFontSize * 0.65) + labelPaddingX * 2;

                    return (
                      <g
                        key={`ai-colony-det-${index}`}
                        onMouseEnter={() => setHoveredAiIndex(index)}
                        onMouseLeave={() => setHoveredAiIndex(null)}
                        onClick={(e) => {
                          // Only handle click when Select tool is active
                          if (activeTool === "select") {
                            e.stopPropagation();
                            const dragDist = Math.hypot(
                              e.clientX - pointerDownPosRef.current.x,
                              e.clientY - pointerDownPosRef.current.y,
                            );
                            if (dragDist <= 5 && !isDraggingRef.current) {
                              onToggleAiDetection?.(index);
                            }
                          }
                          // In Add mode, let event propagate to handleSvgClick so colonies can be placed
                        }}
                        className={cn(
                          "transition-opacity",
                          activeTool === "select" ? "cursor-pointer" : "",
                          isRemoved ? "opacity-55" : "opacity-100",
                        )}
                        role="button"
                        tabIndex={0}
                        aria-label={
                          isRemoved
                            ? `Removed AI colony detection ${index + 1}. Click to restore.`
                            : `AI colony detection ${index + 1}, confidence ${confidencePct}%. Click to mark as removed.`
                        }
                      >
                        <title>
                          {isRemoved
                            ? `AI detection #${index + 1} marked as removed. Click in Select mode to restore.`
                            : `AI detection #${index + 1} (${confidencePct}%). Click in Select mode to mark as false positive.`}
                        </title>

                        {/* Bounding box rectangle */}
                        <rect
                          x={det.x1}
                          y={det.y1}
                          width={boxWidth}
                          height={boxHeight}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={strokeW}
                          strokeDasharray={strokeDasharray}
                          rx={Math.max(2, Math.round(baseStrokeWidth))}
                        />

                        {/* Optional Confidence or Removed Label Tag */}
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

                {/* 2. Manual Colonies Layer */}
                {manualColonies.map((colony, mIndex) => {
                  const isHovered = hoveredManualId === colony.id;
                  const strokeColor = isHovered ? "#f43f5e" : "#8b5cf6"; // rose on hover for removal cue, violet default
                  const fillColor = isHovered
                    ? "rgba(244, 63, 94, 0.30)"
                    : "rgba(139, 92, 246, 0.25)";
                  const strokeW = isHovered ? baseStrokeWidth * 1.5 : baseStrokeWidth * 1.2;

                  const labelText = "Manual";
                  const estLabelWidth =
                    labelText.length * (labelFontSize * 0.65) + labelPaddingX * 2;
                  const labelY =
                    colony.y - colony.radius - labelHeight - 2 >= 0
                      ? colony.y - colony.radius - labelHeight - 2
                      : colony.y + colony.radius + 2;
                  const labelX = Math.max(0, colony.x - estLabelWidth / 2);

                  return (
                    <g
                      key={`manual-colony-${colony.id}`}
                      onMouseEnter={() => setHoveredManualId(colony.id)}
                      onMouseLeave={() => setHoveredManualId(null)}
                      onClick={(e) => {
                        if (activeTool === "select") {
                          e.stopPropagation();
                          const dragDist = Math.hypot(
                            e.clientX - pointerDownPosRef.current.x,
                            e.clientY - pointerDownPosRef.current.y,
                          );
                          if (dragDist <= 5 && !isDraggingRef.current) {
                            onRemoveManualColony?.(colony.id);
                          }
                        }
                      }}
                      className={cn(
                        "transition-opacity",
                        activeTool === "select" ? "cursor-pointer" : "",
                      )}
                      role="button"
                      tabIndex={0}
                      aria-label={`Manual colony marker #${mIndex + 1}. Click in Select mode to remove.`}
                    >
                      <title>{`Manual colony #${mIndex + 1}. Click in Select mode to remove.`}</title>

                      {/* Circular colony reticle */}
                      <circle
                        cx={colony.x}
                        cy={colony.y}
                        r={colony.radius}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                      />

                      {/* Center reticle dot */}
                      <circle
                        cx={colony.x}
                        cy={colony.y}
                        r={Math.max(2, Math.round(baseStrokeWidth * 0.7))}
                        fill={strokeColor}
                      />

                      {/* Crosshairs reticle */}
                      <line
                        x1={colony.x - colony.radius * 0.55}
                        y1={colony.y}
                        x2={colony.x + colony.radius * 0.55}
                        y2={colony.y}
                        stroke={strokeColor}
                        strokeWidth={Math.max(1, Math.round(baseStrokeWidth * 0.6))}
                      />
                      <line
                        x1={colony.x}
                        y1={colony.y - colony.radius * 0.55}
                        x2={colony.x}
                        y2={colony.y + colony.radius * 0.55}
                        stroke={strokeColor}
                        strokeWidth={Math.max(1, Math.round(baseStrokeWidth * 0.6))}
                      />

                      {/* Manual Label Tag */}
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
            </>
          )}
        </div>

        {/* Floating summary badge in bottom-left */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1 text-[11px] font-mono text-foreground backdrop-blur-md shadow-sm border border-border/60">
          <CheckCircle2 className="h-3.5 w-3.5 text-researcher" />
          <span>AI: {detections.length}</span>
          {removedAiIndices && removedAiIndices.size > 0 && (
            <span className="text-rose-500 font-semibold">−{removedAiIndices.size}</span>
          )}
          {manualColonies.length > 0 && (
            <span className="text-violet-500 font-semibold">+{manualColonies.length}</span>
          )}
          {typeof reviewedCount === "number" && (
            <span className="text-foreground font-bold">· Reviewed: {reviewedCount}</span>
          )}
          <span className="text-muted-foreground">
            ({imgWidth}×{imgHeight}px)
          </span>
          {zoom > 1 && (
            <span className="text-researcher font-semibold">
              · {Math.round(zoom * 100)}% zoom
            </span>
          )}
        </div>

        {/* Dynamic Tool Mode / Navigation Hint */}
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground backdrop-blur-sm border border-border/40">
          {activeTool === "add" ? (
            <span className="text-violet-500 font-semibold">
              Click agar to add colony · Drag to pan
            </span>
          ) : zoom > 1 ? (
            <span>Drag to pan · Scroll to zoom · Click to select</span>
          ) : (
            <span>Click detection to remove / restore</span>
          )}
        </div>
      </div>

      {/* Zero Detections Notice */}
      {!hasDetections && manualColonies.length === 0 && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-surface-elevated p-3 text-xs text-muted-foreground"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-startup" />
          <span>
            No colonies were detected at the current confidence threshold. Use "Add Colony" mode
            to mark colonies manually, or adjust the sensitivity threshold.
          </span>
        </div>
      )}
    </div>
  );
}
