import * as React from "react";
import type { ColonyDetectionSuccessResponse } from "@/lib/colony-api";
import { type CfuExportData, sanitizeFilename, formatRawScientific } from "@/lib/colony-export";

export interface ColonyPrintReportProps {
  filename?: string | null;
  response: ColonyDetectionSuccessResponse;
  appliedThreshold?: number;
  reviewedCount?: number;
  removedCount?: number;
  addedCount?: number;
  hasModifications?: boolean;
  cfuData?: CfuExportData | null;
  annotatedImageUrl?: string | null;
}

export function ColonyPrintReport({
  filename,
  response,
  appliedThreshold = 0.3,
  reviewedCount,
  removedCount = 0,
  addedCount = 0,
  hasModifications = false,
  cfuData,
  annotatedImageUrl,
}: ColonyPrintReportProps) {
  const { count: aiCount, image, processing_time_ms, quality } = response;
  const effectiveReviewedCount = typeof reviewedCount === "number" ? reviewedCount : aiCount;

  // Resolve count source and provenance
  const countSource = cfuData?.countSource ?? (hasModifications ? "reviewed" : "ai");
  const countUsed =
    cfuData?.activeCount !== null && cfuData?.activeCount !== undefined
      ? cfuData.activeCount
      : countSource === "reviewed"
        ? effectiveReviewedCount
        : aiCount;

  const countSourceLabel =
    countSource === "reviewed"
      ? "Human-Reviewed Count"
      : countSource === "ai"
        ? "Automated AI Count"
        : "Custom Laboratory Count";

  const countSourceProvenance =
    countSource === "reviewed"
      ? "Verified through human-in-the-loop review (AI baseline minus false positives plus manual additions)."
      : countSource === "ai"
        ? "Generated solely by automated computer vision object detection (YOLO11n) without human intervention."
        : "Entered manually by laboratory technician. This value was NOT determined or verified by AI.";

  // Quality & density metrics
  const densityLevel =
    quality?.density_level ??
    (aiCount > 400 ? "ultra_high" : aiCount > 200 ? "high" : aiCount >= 50 ? "medium" : "low");
  const confluenceRisk = quality?.confluence_risk ?? (aiCount > 200 ? "high" : "low");
  const reviewRecommended = quality?.review_recommended ?? aiCount > 200;
  const isPotentialTntc = densityLevel === "ultra_high" || confluenceRisk === "high";

  // Document reference ID and timestamp
  const [reportId] = React.useState(
    () => `MB-COL-${Date.now().toString(36).toUpperCase()}`,
  );
  const [reportTimestamp] = React.useState(() => new Date().toUTCString());

  const sampleName = sanitizeFilename(filename, "specimen_image");

  return (
    <div className="hidden print:block print:w-full print:bg-white print:text-slate-900 print:p-6 print:text-[11px] font-sans">
      <style>{`
        @media print {
          @page {
            margin: 10mm 12mm;
            size: A4 portrait;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* A. Document Header */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            Micrylis Biotech · Microbiology AI Suite
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            AI Petri Dish Colony Quantification Report
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Automated computer-vision colony detection, human review audit trail, and CFU/mL analysis
          </p>
        </div>
        <div className="text-right font-mono text-[9px] text-slate-600 space-y-0.5">
          <div>
            <strong>Report ID:</strong> {reportId}
          </div>
          <div>
            <strong>Generated:</strong> {reportTimestamp}
          </div>
          <div>
            <strong>Software:</strong> Colony Counter v1.0
          </div>
        </div>
      </div>

      {/* B. Assay & Specimen Metadata */}
      <div className="avoid-break mb-4 rounded border border-slate-200 bg-slate-50/60 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 border-b border-slate-200 pb-1">
          1. Assay & Specimen Metadata
        </div>
        <div className="grid grid-cols-4 gap-2 text-[10px]">
          <div>
            <span className="text-slate-500 block">Specimen Identifier:</span>
            <span className="font-semibold text-slate-900 break-all">{sampleName}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Dimensions:</span>
            <span className="font-mono text-slate-900">
              {image?.width && image?.height ? `${image.width} × ${image.height} px` : "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Confidence Threshold:</span>
            <span className="font-mono text-slate-900">
              {Math.round(appliedThreshold * 100)}% ({appliedThreshold.toFixed(2)})
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Inference Latency:</span>
            <span className="font-mono text-slate-900">{processing_time_ms} ms</span>
          </div>
        </div>
      </div>

      {/* C & D. Quantification & Concentration Results Grid */}
      <div className="avoid-break grid grid-cols-2 gap-3 mb-4">
        {/* Quantification Box */}
        <div className="rounded border border-slate-200 p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 border-b border-slate-200 pb-1">
            2. Colony Quantification
          </div>
          <table className="w-full text-[10px]">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1 text-slate-600">Automated AI Count:</td>
                <td className="py-1 text-right font-mono font-bold text-slate-900">{aiCount}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 text-slate-600">Removed False Positives:</td>
                <td className="py-1 text-right font-mono text-rose-600">
                  {removedCount > 0 ? `−${removedCount}` : "0"}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1 text-slate-600">Manual Added Colonies:</td>
                <td className="py-1 text-right font-mono text-purple-700">
                  {addedCount > 0 ? `+${addedCount}` : "0"}
                </td>
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="py-1 font-semibold text-slate-900">Final Reviewed Count:</td>
                <td className="py-1 text-right font-mono font-bold text-slate-900">
                  {effectiveReviewedCount}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-slate-600">Count Used in Analysis:</td>
                <td className="py-1 text-right font-mono font-bold text-emerald-700">
                  {countUsed} ({countSourceLabel})
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 text-[9px] text-slate-500 font-mono">
            Lineage: AI ({aiCount}) − Removed ({removedCount}) + Added ({addedCount}) = Reviewed (
            {effectiveReviewedCount})
          </div>
        </div>

        {/* Concentration Box */}
        <div className="rounded border border-slate-200 p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 border-b border-slate-200 pb-1">
            3. Concentration Extrapolation (CFU/mL)
          </div>
          {cfuData?.isValid && cfuData.cfuPerMl !== null ? (
            <table className="w-full text-[10px]">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1 text-slate-600">Plated Volume:</td>
                  <td className="py-1 text-right font-mono font-medium text-slate-900">
                    {cfuData.volumeMl} mL ({cfuData.volumeInput} {cfuData.volumeUnit})
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 text-slate-600">Serial Dilution Factor:</td>
                  <td className="py-1 text-right font-mono font-medium text-slate-900">
                    10⁻{cfuData.dilutionExponent} (1:{Math.pow(10, cfuData.dilutionExponent).toLocaleString()})
                  </td>
                </tr>
                <tr className="border-b border-slate-100 bg-emerald-50/60">
                  <td className="py-1 font-bold text-slate-900">Estimated Concentration:</td>
                  <td className="py-1 text-right font-mono font-bold text-emerald-800 text-[12px]">
                    {formatRawScientific(cfuData.cfuPerMl)} CFU/mL
                  </td>
                </tr>
                {cfuData.activeCount === 0 && cfuData.llodCfuPerMl && (
                  <tr>
                    <td className="py-1 text-slate-600">Lower Limit of Detection:</td>
                    <td className="py-1 text-right font-mono text-slate-700">
                      &lt; {formatRawScientific(cfuData.llodCfuPerMl)} CFU/mL
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} className="py-1 pt-2 text-[9px] text-slate-500 font-mono">
                    Formula: {cfuData.activeCount} / ({cfuData.volumeMl} mL × 10⁻
                    {cfuData.dilutionExponent}) = {formatRawScientific(cfuData.cfuPerMl)} CFU/mL
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="py-4 text-center text-slate-400 text-[10px] space-y-1">
              <p className="font-semibold text-slate-600">Concentration Not Calculated</p>
              <p className="text-[9px]">
                Plated volume was not entered. To extrapolate CFU/mL, specify plated volume and
                dilution factors in the scientific calculator.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* E. Quality Assessment & High-Density / TNTC Advisory */}
      <div className="avoid-break mb-4 rounded border border-slate-200 p-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1 border-b border-slate-200 pb-1">
          4. Operational Plate Quality & Density Assessment
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
          <div>
            <span className="text-slate-500 block">Density Level:</span>
            <span className="font-semibold uppercase text-slate-800">
              {densityLevel.replace("_", " ")} ({aiCount} colonies)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Crowding / Confluence Risk:</span>
            <span className="font-semibold uppercase text-slate-800">
              {confluenceRisk}
              {typeof quality?.overlap_ratio === "number" &&
                ` (${Math.round(quality.overlap_ratio * 100)}% overlap)`}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Review Recommended:</span>
            <span className="font-semibold text-slate-800">
              {reviewRecommended ? "Yes (Visual confirmation advised)" : "No (Standard plate range)"}
            </span>
          </div>
        </div>

        {/* Cautious Scientific Advisory */}
        {isPotentialTntc && (
          <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900 mt-1">
            <span className="font-bold">Provisional — Potential TNTC: </span>
            Plate exceeds the recommended countable-density range (30–300 CFU). The concentration
            estimate may undercount the true population when colonies are crowded or confluent.
            Automated detection is calibrated for individual colonies. In confluent lawns or dense
            clusters, physical boundaries merge. Serial dilution or manual verification is
            recommended.
          </div>
        )}
      </div>

      {/* H. High-Resolution Annotated Specimen Image */}
      {annotatedImageUrl && (
        <div className="avoid-break mb-4 rounded border border-slate-200 p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 border-b border-slate-200 pb-1 flex justify-between items-center">
            <span>5. High-Resolution Annotated Specimen Plate (1:1 Native Resolution)</span>
            <span className="font-mono text-[9px] text-slate-500">
              Green = Active AI Box · Violet = Manual Addition · Removed Excluded
            </span>
          </div>
          <div className="flex justify-center items-center bg-slate-900/5 rounded p-1 max-h-[360px] overflow-hidden">
            <img
              src={annotatedImageUrl}
              alt="Annotated Petri dish specimen"
              className="max-h-[350px] w-auto object-contain rounded"
            />
          </div>
        </div>
      )}

      {/* F & G. Provenance & Scientific Disclaimers */}
      <div className="avoid-break text-[9px] text-slate-500 space-y-1 border-t border-slate-200 pt-2.5">
        <div>
          <strong>Provenance Statement: </strong>
          {countSourceProvenance}
        </div>
        <div>
          <strong>Scientific Verification Notice: </strong>
          CFU/mL is a mathematical extrapolation based on user-entered volume and dilution factors.
          Automated colony detection assists quantification; it does not validate pipetting
          accuracy, biological viability, or sterility controls.
        </div>
        <div className="flex justify-between items-center text-[8px] text-slate-400 pt-1">
          <span>Micrylis Biotech Research Systems</span>
          <span>Confidential Laboratory Assay Report</span>
          <span>Model: YOLO11n (class: colony, conf: {appliedThreshold.toFixed(2)})</span>
        </div>
      </div>
    </div>
  );
}
