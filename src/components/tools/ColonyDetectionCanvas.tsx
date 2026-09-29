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
  Info,
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
  const [focusedAiIndex, setFocusedAiIndex] = React.useState<number | null>(null);
  const [focusedManualId, setFocusedManualId] = React.useState<string | null>(null);

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
  const aiCount = detections.length;
  const removedCount = removedAiIndices ? removedAiIndices.size : 0;
  const addedCount = manualColonies.length;
  const hasModifications = removedCount > 0 || addedCount > 0;
  const effectiveReviewedCount =
    reviewedCount !== undefined
      ? reviewedCount
      : Math.max(0, aiCount - removedCount + addedCount);

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
                aria-pressed={activeTool === "select"}
                data-state={activeTool === "select" ? "active" : "inactive"}
                data-testid="tool-select-button"
                onClick={() => onSetActiveTool("select")}
                className={cn(
                  "h-7 gap-1 px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  activeTool === "select"
                    ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Select tool: click an AI marker to remove/restore, or click a manual colony to remove"
                aria-label="Select tool mode (Active: select detections to remove or restore)"
              >
                <MousePointer className="h-3 w-3" aria-hidden="true" />
                <span>Select</span>
                {activeTool === "select" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground ml-0.5" aria-hidden="true" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                role="radio"
                aria-checked={activeTool === "add"}
                aria-pressed={activeTool === "add"}
                data-state={activeTool === "add" ? "active" : "inactive"}
                data-testid="tool-add-button"
                onClick={() => onSetActiveTool("add")}
                className={cn(
                  "h-7 gap-1 px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1",
                  activeTool === "add"
                    ? "bg-violet-600 text-white shadow-xs hover:bg-violet-600 hover:text-white dark:bg-violet-500"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Add Colony tool: click or tap on agar surface to place a manual colony marker"
                aria-label="Add Colony tool mode (Active: click or tap plate to place colony marker)"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span>+ Add Colony</span>
                {activeTool === "add" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white ml-0.5" aria-hidden="true" />
                )}
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

      {/* Review Guidance Area (User UX & Interaction Guidance) */}
      {viewMode === "overlay" && (
        <div
          className="rounded-xl border border-border/70 bg-surface/50 p-2.5 text-xs shadow-xs"
          data-testid="canvas-review-guidance"
          aria-label="How to review colony detections"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="h-3.5 w-3.5 text-researcher" aria-hidden="true" />
              <span>Review detections</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {hasModifications ? (
                <span className="font-mono text-foreground font-medium">
                  AI: {aiCount} · Removed: {removedCount} · Manual: +{addedCount} · Reviewed: {effectiveReviewedCount}
                </span>
              ) : (
                <span className="italic text-muted-foreground">
                  Review the highlighted detections before using the final count.
                </span>
              )}
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 text-[11px] text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>Select an AI marker to remove a false detection.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
              <span>Select a removed marker to restore it.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden="true" />
              <span>Switch to Add Colony to mark a colony the AI missed.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
              <span>Use the mouse, touch, or keyboard to review detections.</span>
            </li>
          </ul>
        </div>
      )}

      {/* Visual Distinction & Accessibility Legend (Phase 6C-3) */}
      {viewMode === "overlay" && (
        <div
          className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-surface/60 border border-border/60 text-xs"
          role="region"
          aria-label="Colony review visual legend"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Legend:
            </span>

            {/* 1. AI Active Detection */}
            <div className="flex items-center gap-1.5" data-testid="legend-ai-active">
              <span
                className="inline-block h-3.5 w-3.5 rounded-xs border-2 border-emerald-500 bg-emerald-500/20 shadow-xs"
                aria-hidden="true"
              />
              <span className="font-medium text-foreground">AI Detected</span>
              <span className="text-[10px] text-muted-foreground">(Solid Box)</span>
              <span className="sr-only">: Active AI colony detection marker with solid outline</span>
            </div>

            {/* 2. AI Excluded / Removed */}
            <div className="flex items-center gap-1.5" data-testid="legend-ai-excluded">
              <span
                className="relative inline-flex items-center justify-center h-3.5 w-3.5 rounded-xs border-2 border-dashed border-rose-500 bg-rose-500/10"
                aria-hidden="true"
              >
                <span className="text-[9px] font-bold text-rose-500 leading-none">✕</span>
              </span>
              <span className="font-medium text-foreground">Excluded</span>
              <span className="text-[10px] text-muted-foreground">(Dashed + ✕)</span>
              <span className="sr-only">: Removed AI detection marker, excluded from count, dashed outline with ✕ symbol</span>
            </div>

            {/* 3. Manually Added */}
            <div className="flex items-center gap-1.5" data-testid="legend-manual">
              <span
                className="relative inline-flex items-center justify-center h-3.5 w-3.5 rounded-full border-2 border-violet-500 bg-violet-500/20"
                aria-hidden="true"
              >
                <span className="text-[9px] font-bold text-violet-500 leading-none">+</span>
              </span>
              <span className="font-medium text-foreground">Manual</span>
              <span className="text-[10px] text-muted-foreground">(Reticle +)</span>
              <span className="sr-only">: Manually added colony marker, circular reticle with + symbol</span>
            </div>

            {/* 4. Keyboard Focused */}
            <div className="flex items-center gap-1.5" data-testid="legend-focus">
              <span
                className="inline-block h-3.5 w-3.5 rounded-xs border-2 border-dashed border-blue-600 outline outline-1 outline-white/80"
                aria-hidden="true"
              />
              <span className="font-medium text-foreground">Focused</span>
              <span className="text-[10px] text-muted-foreground">(Tab / Ring)</span>
              <span className="sr-only">: Keyboard focused detection marker, dashed highlight ring</span>
            </div>
          </div>

          {reviewedCount !== undefined && (
            <div className="font-mono text-xs text-foreground font-semibold shrink-0">
              Reviewed: {reviewedCount}
            </div>
          )}
        </div>
      )}

      {/* Active tool helper banner for keyboard and screen-reader accessibility (Phase 6C-2) */}
      {viewMode === "overlay" && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface/50 border border-border/50 text-[11px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-1.5">
            {activeTool === "add" ? (
              <>
                <Plus className="h-3.5 w-3.5 text-violet-500 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">Add Colony Mode:</strong> Click or tap a colony location on the agar image to add it. Switch back to Select to review or remove existing markers.
                </span>
              </>
            ) : (
              <>
                <MousePointer className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                <span>
                  <strong className="text-foreground">Select Mode:</strong> Select a detection to remove or restore it. Tab to a detection. Press <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Space</kbd> to toggle it.
                </span>
              </>
            )}
          </div>
          {reviewedCount !== undefined && (
            <span className="font-mono text-foreground font-semibold shrink-0">
              Reviewed: {reviewedCount}
            </span>
          )}
        </div>
      )}

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
                role="region"
                aria-label={`Petri dish detection overlay. ${detections.length} AI detections, ${manualColonies.length} manual colonies.${activeTool === "add" ? " Add Colony tool is active: click or tap the agar image to place a colony marker." : " Select tool is active: use Tab to inspect detections, Enter or Space to toggle."}`}
              >
                {/* 1. AI Detections Layer */}
                {hasDetections &&
                  showBoxes &&
                  detections.map((det, index) => {
                    const isRemoved = removedAiIndices?.has(index) ?? false;
                    const isHovered = hoveredAiIndex === index;
                    const isFocused = focusedAiIndex === index;
                    const isHighlighted = isHovered || isFocused;
                    const boxWidth = Math.max(1, det.x2 - det.x1);
                    const boxHeight = Math.max(1, det.y2 - det.y1);
                    const confidencePct = Math.round(det.confidence * 100);

                    // Removed vs Active detection styling
                    let strokeColor: string;
                    let fillColor: string;
                    let strokeDasharray: string | undefined;

                    if (isRemoved) {
                      strokeColor = "#ef4444"; // red-500
                      fillColor = isHighlighted
                        ? "rgba(239, 68, 68, 0.20)"
                        : "rgba(239, 68, 68, 0.08)";
                      strokeDasharray = "5 3";
                    } else if (isHighlighted) {
                      strokeColor = "#3b82f6"; // blue-500 hover/focus
                      fillColor = "rgba(59, 130, 246, 0.25)";
                      strokeDasharray = undefined;
                    } else {
                      strokeColor = "#10b981"; // emerald-500 normal
                      fillColor = "rgba(16, 185, 129, 0.15)";
                      strokeDasharray = undefined;
                    }

                    const strokeW = isHighlighted ? baseStrokeWidth * 1.5 : baseStrokeWidth;

                    // Label coordinates
                    const labelY =
                      det.y1 - labelHeight >= 0 ? det.y1 - labelHeight - 2 : det.y2 + 2;
                    const labelX = Math.max(0, det.x1);
                    const labelText = isRemoved
                      ? "EXCLUDED (✕)"
                      : `${det.class_name || "colony"} ${confidencePct}%`;
                    const estLabelWidth =
                      labelText.length * (labelFontSize * 0.65) + labelPaddingX * 2;

                    const badgeSize = Math.max(14, Math.round(baseStrokeWidth * 6));
                    const badgeRadius = badgeSize / 2;
                    const badgePadding = Math.round(badgeSize * 0.25);

                    return (
                      <g
                        key={`ai-colony-det-${index}`}
                        data-testid={`ai-colony-det-${index}`}
                        onMouseEnter={() => setHoveredAiIndex(index)}
                        onMouseLeave={() => setHoveredAiIndex(null)}
                        onFocus={() => setFocusedAiIndex(index)}
                        onBlur={() => setFocusedAiIndex(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (activeTool === "select") {
                              onToggleAiDetection?.(index);
                            }
                          }
                        }}
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
                          "transition-opacity focus:outline-none focus-visible:outline-none",
                          activeTool === "select" ? "cursor-pointer" : "",
                          isRemoved ? "opacity-65" : "opacity-100",
                        )}
                        role="button"
                        tabIndex={0}
                        aria-pressed={!isRemoved}
                        aria-label={
                          isRemoved
                            ? `Colony detection ${index + 1}: removed (${confidencePct}% confidence). Press Enter or Space to restore.`
                            : `Colony detection ${index + 1}: active (${confidencePct}% confidence). Press Enter or Space to remove.`
                        }
                      >
                        <title>
                          {isRemoved
                            ? `AI detection #${index + 1} marked as removed. Press Enter or Space to restore.`
                            : `AI detection #${index + 1} (${confidencePct}%). Press Enter or Space to mark as false positive.`}
                        </title>

                        {/* Visual Keyboard Focus Ring with dual-stroke high-contrast halo */}
                        {isFocused && (
                          <g className="pointer-events-none">
                            {/* Outer white halo for contrast against dark agar/specimens */}
                            <rect
                              x={det.x1 - Math.max(3, Math.round(baseStrokeWidth * 1.5))}
                              y={det.y1 - Math.max(3, Math.round(baseStrokeWidth * 1.5))}
                              width={boxWidth + Math.max(6, Math.round(baseStrokeWidth * 3))}
                              height={boxHeight + Math.max(6, Math.round(baseStrokeWidth * 3))}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={Math.max(3, Math.round(baseStrokeWidth * 1.8))}
                              rx={Math.max(3, Math.round(baseStrokeWidth * 1.5))}
                              opacity={0.9}
                            />
                            {/* Inner deep blue dashed ring for contrast against bright/white agar */}
                            <rect
                              data-testid={`ai-focus-ring-${index}`}
                              x={det.x1 - Math.max(3, Math.round(baseStrokeWidth * 1.5))}
                              y={det.y1 - Math.max(3, Math.round(baseStrokeWidth * 1.5))}
                              width={boxWidth + Math.max(6, Math.round(baseStrokeWidth * 3))}
                              height={boxHeight + Math.max(6, Math.round(baseStrokeWidth * 3))}
                              fill="none"
                              stroke="#1d4ed8"
                              strokeWidth={Math.max(2, Math.round(baseStrokeWidth * 1.2))}
                              strokeDasharray="4 2"
                              rx={Math.max(3, Math.round(baseStrokeWidth * 1.5))}
                            />
                          </g>
                        )}

                        {/* Dual-stroke outer contrast halo: guarantees visibility against bright white or transilluminated agar */}
                        <rect
                          x={det.x1}
                          y={det.y1}
                          width={boxWidth}
                          height={boxHeight}
                          fill="none"
                          stroke="rgba(0, 0, 0, 0.72)"
                          strokeWidth={strokeW + Math.max(2, Math.round(baseStrokeWidth * 0.7))}
                          strokeDasharray={strokeDasharray}
                          rx={Math.max(2, Math.round(baseStrokeWidth))}
                          className="pointer-events-none"
                        />

                        {/* Foreground primary bounding box rectangle */}
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

                        {/* Non-color exclusion indicator badge (Phase 6C-3): prominent '✕' badge on removed detections */}
                        {isRemoved && (
                          <g
                            data-testid={`ai-excluded-badge-${index}`}
                            transform={`translate(${det.x2 - badgeRadius}, ${det.y1 - badgeRadius})`}
                            className="pointer-events-none"
                          >
                            {/* Dark halo behind badge */}
                            <circle
                              cx={badgeRadius}
                              cy={badgeRadius}
                              r={badgeRadius + 1}
                              fill="rgba(0, 0, 0, 0.85)"
                            />
                            {/* Red badge body */}
                            <circle
                              cx={badgeRadius}
                              cy={badgeRadius}
                              r={badgeRadius}
                              fill="#ef4444"
                              stroke="#ffffff"
                              strokeWidth={Math.max(1, Math.round(baseStrokeWidth * 0.5))}
                            />
                            {/* White '✕' cross icon */}
                            <line
                              x1={badgePadding}
                              y1={badgePadding}
                              x2={badgeSize - badgePadding}
                              y2={badgeSize - badgePadding}
                              stroke="#ffffff"
                              strokeWidth={Math.max(1.5, Math.round(baseStrokeWidth * 0.6))}
                              strokeLinecap="round"
                            />
                            <line
                              x1={badgeSize - badgePadding}
                              y1={badgePadding}
                              x2={badgePadding}
                              y2={badgeSize - badgePadding}
                              stroke="#ffffff"
                              strokeWidth={Math.max(1.5, Math.round(baseStrokeWidth * 0.6))}
                              strokeLinecap="round"
                            />
                          </g>
                        )}

                        {/* Optional Confidence or Removed Label Tag with contrast halo */}
                        {showLabels && (
                          <g transform={`translate(${labelX}, ${labelY})`}>
                            {/* Contrast drop-shadow halo for label */}
                            <rect
                              x={-1}
                              y={-1}
                              width={estLabelWidth + 2}
                              height={labelHeight + 2}
                              rx={Math.max(3, Math.round(labelHeight * 0.25))}
                              fill="rgba(0, 0, 0, 0.75)"
                            />
                            <rect
                              width={estLabelWidth}
                              height={labelHeight}
                              rx={Math.max(2, Math.round(labelHeight * 0.2))}
                              fill={strokeColor}
                              opacity={0.96}
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
                  const isFocused = focusedManualId === colony.id;
                  const isHighlighted = isHovered || isFocused;
                  const strokeColor = isHighlighted ? "#f43f5e" : "#8b5cf6"; // rose on hover/focus for removal cue, violet default
                  const fillColor = isHighlighted
                    ? "rgba(244, 63, 94, 0.30)"
                    : "rgba(139, 92, 246, 0.25)";
                  const strokeW = isHighlighted ? baseStrokeWidth * 1.5 : baseStrokeWidth * 1.2;

                  const labelText = "Manual (+)";
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
                      data-testid={`manual-colony-${colony.id}`}
                      onMouseEnter={() => setHoveredManualId(colony.id)}
                      onMouseLeave={() => setHoveredManualId(null)}
                      onFocus={() => setFocusedManualId(colony.id)}
                      onBlur={() => setFocusedManualId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (activeTool === "select") {
                            onRemoveManualColony?.(colony.id);
                          }
                        }
                      }}
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
                        "transition-opacity focus:outline-none focus-visible:outline-none",
                        activeTool === "select" ? "cursor-pointer" : "",
                      )}
                      role="button"
                      tabIndex={0}
                      aria-label={`Manual colony marker #${mIndex + 1} at coordinates ${colony.x}, ${colony.y}. Press Enter or Space to remove.`}
                    >
                      <title>{`Manual colony #${mIndex + 1}. Press Enter or Space in Select mode to remove.`}</title>

                      {/* Visual Keyboard Focus Ring for Manual Colony with dual-stroke contrast */}
                      {isFocused && (
                        <g className="pointer-events-none">
                          <circle
                            cx={colony.x}
                            cy={colony.y}
                            r={colony.radius + Math.max(4, Math.round(baseStrokeWidth * 1.5))}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={Math.max(3, Math.round(baseStrokeWidth * 1.8))}
                            opacity={0.9}
                          />
                          <circle
                            data-testid={`manual-focus-ring-${colony.id}`}
                            cx={colony.x}
                            cy={colony.y}
                            r={colony.radius + Math.max(4, Math.round(baseStrokeWidth * 1.5))}
                            fill="none"
                            stroke="#1d4ed8"
                            strokeWidth={Math.max(2, Math.round(baseStrokeWidth * 1.2))}
                            strokeDasharray="4 2"
                          />
                        </g>
                      )}

                      {/* Circular colony reticle outer contrast halo */}
                      <circle
                        cx={colony.x}
                        cy={colony.y}
                        r={colony.radius}
                        fill="none"
                        stroke="rgba(0, 0, 0, 0.72)"
                        strokeWidth={strokeW + Math.max(2, Math.round(baseStrokeWidth * 0.7))}
                        className="pointer-events-none"
                      />

                      {/* Circular colony reticle foreground */}
                      <circle
                        cx={colony.x}
                        cy={colony.y}
                        r={colony.radius}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                      />

                      {/* Center reticle dot halo + dot */}
                      <circle
                        cx={colony.x}
                        cy={colony.y}
                        r={Math.max(2, Math.round(baseStrokeWidth * 0.7)) + 1}
                        fill="rgba(0, 0, 0, 0.85)"
                      />
                      <circle
                        cx={colony.x}
                        cy={colony.y}
                        r={Math.max(2, Math.round(baseStrokeWidth * 0.7))}
                        fill={strokeColor}
                      />

                      {/* Crosshairs reticle with dark background shadow for non-color shape clarity */}
                      <line
                        x1={colony.x - colony.radius * 0.65}
                        y1={colony.y}
                        x2={colony.x + colony.radius * 0.65}
                        y2={colony.y}
                        stroke="rgba(0, 0, 0, 0.85)"
                        strokeWidth={Math.max(2, Math.round(baseStrokeWidth * 0.8))}
                      />
                      <line
                        x1={colony.x - colony.radius * 0.65}
                        y1={colony.y}
                        x2={colony.x + colony.radius * 0.65}
                        y2={colony.y}
                        stroke={strokeColor}
                        strokeWidth={Math.max(1, Math.round(baseStrokeWidth * 0.6))}
                      />
                      <line
                        x1={colony.x}
                        y1={colony.y - colony.radius * 0.65}
                        x2={colony.x}
                        y2={colony.y + colony.radius * 0.65}
                        stroke="rgba(0, 0, 0, 0.85)"
                        strokeWidth={Math.max(2, Math.round(baseStrokeWidth * 0.8))}
                      />
                      <line
                        x1={colony.x}
                        y1={colony.y - colony.radius * 0.65}
                        x2={colony.x}
                        y2={colony.y + colony.radius * 0.65}
                        stroke={strokeColor}
                        strokeWidth={Math.max(1, Math.round(baseStrokeWidth * 0.6))}
                      />

                      {/* Manual Label Tag with contrast halo */}
                      {showLabels && (
                        <g transform={`translate(${labelX}, ${labelY})`}>
                          <rect
                            x={-1}
                            y={-1}
                            width={estLabelWidth + 2}
                            height={labelHeight + 2}
                            rx={Math.max(3, Math.round(labelHeight * 0.25))}
                            fill="rgba(0, 0, 0, 0.75)"
                          />
                          <rect
                            width={estLabelWidth}
                            height={labelHeight}
                            rx={Math.max(2, Math.round(labelHeight * 0.2))}
                            fill={strokeColor}
                            opacity={0.96}
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
