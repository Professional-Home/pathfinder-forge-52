import * as React from "react";
import { Download, FileSpreadsheet, ListFilter, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ColonyDetectionSuccessResponse } from "@/lib/colony-api";
import type { ManualColony } from "@/hooks/use-colony-review";
import {
  type CfuExportData,
  exportSummaryCsv,
  exportDetectionsCsv,
  generateAnnotatedPlateImage,
} from "@/lib/colony-export";

export interface ColonyExportActionsProps {
  filename?: string | null;
  response: ColonyDetectionSuccessResponse;
  appliedThreshold: number;
  reviewedCount: number;
  removedCount: number;
  addedCount: number;
  manualColonies?: ManualColony[];
  removedAiIndices?: Set<number>;
  cfuData?: CfuExportData | null;
  originalImageUrl?: string | null;
  onSetAnnotatedReportImage?: (url: string) => void;
  className?: string;
}

export function ColonyExportActions({
  filename,
  response,
  appliedThreshold,
  reviewedCount,
  removedCount,
  addedCount,
  manualColonies = [],
  removedAiIndices = new Set(),
  cfuData,
  originalImageUrl,
  onSetAnnotatedReportImage,
  className,
}: ColonyExportActionsProps) {
  const [isComposingPrint, setIsComposingPrint] = React.useState(false);

  const handleExportSummaryCsv = () => {
    try {
      exportSummaryCsv({
        filename,
        imageWidth: response.image.width,
        imageHeight: response.image.height,
        processingTimeMs: response.processing_time_ms,
        appliedThreshold,
        aiCount: response.count,
        removedCount,
        addedCount,
        reviewedCount,
        quality: response.quality,
        cfuData,
      });
      toast.success("Summary CSV downloaded successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate Summary CSV.";
      toast.error(msg);
    }
  };

  const handleExportDetectionsCsv = () => {
    try {
      exportDetectionsCsv({
        filename,
        detections: response.detections,
        removedAiIndices,
        manualColonies,
      });
      toast.success("Detections CSV downloaded successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate Detections CSV.";
      toast.error(msg);
    }
  };

  const handlePrintPdfReport = async () => {
    setIsComposingPrint(true);
    try {
      // 1. Compose full-resolution annotated specimen image on offscreen canvas
      if (originalImageUrl) {
        try {
          const annotatedDataUrl = await generateAnnotatedPlateImage({
            imageUrl: originalImageUrl,
            imageWidth: response.image.width,
            imageHeight: response.image.height,
            detections: response.detections,
            removedAiIndices,
            manualColonies,
          });
          onSetAnnotatedReportImage?.(annotatedDataUrl);
        } catch {
          // Fallback to original image if offscreen canvas render encounters issues
          onSetAnnotatedReportImage?.(originalImageUrl);
        }
      }

      // 2. Allow DOM to bind the prepared annotated image before launching print dialog
      setTimeout(() => {
        window.print();
        setIsComposingPrint(false);
      }, 150);
    } catch (err: unknown) {
      setIsComposingPrint(false);
      const msg = err instanceof Error ? err.message : "Failed to prepare printable PDF report.";
      toast.error(msg);
    }
  };

  return (
    <Card className={cn("border-border/80 bg-surface-elevated shadow-xs", className)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Download className="h-4 w-4 text-researcher" />
            Export & Lab Reports
          </CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground">
            Client-Side · Zero Server Upload
          </span>
        </div>
        <CardDescription className="text-xs">
          Export quantification metrics, audit trails, and printable lab documentation.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Action 1: Summary CSV */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportSummaryCsv}
            className="flex-1 justify-center gap-1.5 text-xs font-medium border-border/80 hover:border-researcher hover:text-researcher shadow-xs"
            aria-label="Export colony quantification summary to CSV"
            title="Download single-row CSV for LIMS or spreadsheet import"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-researcher shrink-0" />
            <span>Export Summary CSV</span>
          </Button>

          {/* Action 2: Detections CSV */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportDetectionsCsv}
            className="flex-1 justify-center gap-1.5 text-xs font-medium border-border/80 hover:border-student hover:text-student shadow-xs"
            aria-label="Export granular detection coordinates and confidence scores to CSV"
            title="Download multi-row CSV with individual colony coordinates and review status"
          >
            <ListFilter className="h-3.5 w-3.5 text-student shrink-0" />
            <span>Export Detections</span>
          </Button>

          {/* Action 3: Print / Save PDF */}
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={isComposingPrint}
            onClick={handlePrintPdfReport}
            className="flex-1 justify-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            aria-label="Print or save PDF assay report"
            title="Generate high-resolution printable report with annotated specimen plate"
          >
            {isComposingPrint ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Preparing PDF...</span>
              </>
            ) : (
              <>
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span>Print / Save PDF</span>
              </>
            )}
          </Button>
        </div>

        <p className="mt-2 text-[10px] text-muted-foreground/80 leading-normal">
          Exported documents preserve strict scientific provenance, distinguishing automated AI
          detections, manual corrections, and custom laboratory counts.
        </p>
      </CardContent>
    </Card>
  );
}
