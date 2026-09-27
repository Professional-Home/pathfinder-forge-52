import * as React from "react";
import {
  Calculator,
  RotateCcw,
  AlertTriangle,
  Info,
  CheckCircle2,
  HelpCircle,
  FlaskConical,
  Sparkles,
  UserCheck,
  Edit3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ColonyQualityAssessment } from "@/lib/colony-api";

export type CountSourceType = "reviewed" | "ai" | "custom";
export type VolumeUnitType = "mL" | "uL";

export interface CfuCalculatorProps {
  /** Immutable automated AI count baseline */
  aiCount: number;
  /** Human-reviewed colony count derived from AI count - removals + additions */
  reviewedCount?: number;
  /** Whether user has made any manual review modifications */
  hasModifications?: boolean;
  /** Plate density, confluence, and review recommendation metadata */
  quality?: ColonyQualityAssessment;
  className?: string;
}

const COMMON_DILUTION_EXPONENTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

function formatSuperscript(num: number): string {
  const str = String(num);
  return str
    .split("")
    .map((ch) => SUPERSCRIPT_DIGITS[ch] || ch)
    .join("");
}

function formatScientificNotation(val: number): string {
  if (val === 0) return "0";
  if (!Number.isFinite(val)) return "—";

  const exp = Math.floor(Math.log10(val));
  const mantissa = val / Math.pow(10, exp);

  // Round mantissa to 2 decimal places
  const roundedMantissa = Number(mantissa.toFixed(2));
  return `${roundedMantissa} × 10${formatSuperscript(exp)}`;
}

export function CfuCalculator({
  aiCount,
  reviewedCount,
  hasModifications = false,
  quality,
  className,
}: CfuCalculatorProps) {
  // Effective reviewed count (defaults to AI count if not reviewed)
  const effectiveReviewedCount = typeof reviewedCount === "number" ? reviewedCount : aiCount;

  // Count source selection: defaults to reviewed if modifications exist, else AI
  const [countSource, setCountSource] = React.useState<CountSourceType>(() =>
    hasModifications ? "reviewed" : "ai",
  );

  // Auto-switch to reviewed count when user performs first manual modification
  const prevHasModificationsRef = React.useRef(hasModifications);
  React.useEffect(() => {
    if (!prevHasModificationsRef.current && hasModifications) {
      setCountSource("reviewed");
    }
    prevHasModificationsRef.current = hasModifications;
  }, [hasModifications]);

  // Custom lab count entry state
  const [customCountInput, setCustomCountInput] = React.useState<string>("");

  // Plated volume state
  const [volumeInput, setVolumeInput] = React.useState<string>("");
  const [volumeUnit, setVolumeUnit] = React.useState<VolumeUnitType>("mL");

  // Serial dilution state: stored as non-negative integer exponent n for 10^(-n)
  const [dilutionExponent, setDilutionExponent] = React.useState<number>(0);
  const [customExponentInput, setCustomExponentInput] = React.useState<string>("0");

  // Synchronize custom exponent input when dilution exponent changes
  React.useEffect(() => {
    setCustomExponentInput(String(dilutionExponent));
  }, [dilutionExponent]);

  // Quality and TNTC assessment signals
  const densityLevel = quality?.density_level ?? (aiCount > 400 ? "ultra_high" : aiCount > 200 ? "high" : "low");
  const confluenceRisk = quality?.confluence_risk ?? (aiCount > 200 ? "high" : "low");
  const reviewRecommended = quality?.review_recommended ?? aiCount > 200;

  const isPotentialTntc = densityLevel === "ultra_high" || confluenceRisk === "high";

  // Active colony count resolution
  const activeCount: number | null = React.useMemo(() => {
    if (countSource === "reviewed") {
      return effectiveReviewedCount;
    }
    if (countSource === "ai") {
      return aiCount;
    }
    if (countSource === "custom") {
      const trimmed = customCountInput.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      if (Number.isInteger(parsed) && parsed >= 0) {
        return parsed;
      }
      return null;
    }
    return null;
  }, [countSource, effectiveReviewedCount, aiCount, customCountInput]);

  // Active volume resolution (always normalized to mL)
  const activeVolumeMl: number | null = React.useMemo(() => {
    const trimmed = volumeInput.trim();
    if (!trimmed) return null;
    const rawVal = Number(trimmed);
    if (!Number.isFinite(rawVal) || rawVal <= 0) return null;

    const normalizedMl = volumeUnit === "uL" ? rawVal / 1000 : rawVal;
    if (normalizedMl >= 0.001 && normalizedMl <= 10.0) {
      return normalizedMl;
    }
    return null;
  }, [volumeInput, volumeUnit]);

  // Validation errors
  const customCountError = React.useMemo(() => {
    if (countSource !== "custom") return null;
    const trimmed = customCountInput.trim();
    if (!trimmed) return "Please enter a colony count.";
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return "Colony count must be a non-negative whole integer (0, 1, 2, ...).";
    }
    return null;
  }, [countSource, customCountInput]);

  const volumeError = React.useMemo(() => {
    const trimmed = volumeInput.trim();
    if (!trimmed) return null; // Incomplete, not yet an error until user types
    const rawVal = Number(trimmed);
    if (!Number.isFinite(rawVal) || rawVal <= 0) {
      return "Volume must be a positive number greater than 0.";
    }
    const normalizedMl = volumeUnit === "uL" ? rawVal / 1000 : rawVal;
    if (normalizedMl < 0.001 || normalizedMl > 10.0) {
      return volumeUnit === "uL"
        ? "Volume must be between 1 µL and 10,000 µL (0.001–10.0 mL)."
        : "Volume must be between 0.001 mL and 10.0 mL.";
    }
    return null;
  }, [volumeInput, volumeUnit]);

  const exponentError = React.useMemo(() => {
    if (!Number.isInteger(dilutionExponent) || dilutionExponent < 0 || dilutionExponent > 12) {
      return "Dilution exponent must be an integer between 0 and 12.";
    }
    return null;
  }, [dilutionExponent]);

  // Calculation computation: CFU/mL = Count * 10^n / Volume(mL)
  const calculationResult = React.useMemo(() => {
    if (activeCount === null || activeVolumeMl === null || exponentError) {
      return null;
    }

    const dilutionFactor = Math.pow(10, -dilutionExponent);
    const dilutionMultiplier = Math.pow(10, dilutionExponent);
    const cfuPerMl = (activeCount * dilutionMultiplier) / activeVolumeMl;

    // Mathematical Lower Limit of Detection (LLOD) reporting aid: < 1 / (V * D)
    const llodCfuPerMl = 1 / (activeVolumeMl * dilutionFactor);

    return {
      cfuPerMl,
      llodCfuPerMl,
      dilutionFactor,
      dilutionMultiplier,
      activeCount,
      activeVolumeMl,
      dilutionExponent,
    };
  }, [activeCount, activeVolumeMl, dilutionExponent, exponentError]);

  // Reset calculator state only (does NOT reset AI baseline, manual review, or canvas)
  const handleResetCalculator = () => {
    setCountSource(hasModifications ? "reviewed" : "ai");
    setCustomCountInput("");
    setVolumeInput("");
    setVolumeUnit("mL");
    setDilutionExponent(0);
    setCustomExponentInput("0");
  };

  // Provenance label
  const provenanceLabel =
    countSource === "reviewed"
      ? "Using human-reviewed count"
      : countSource === "ai"
        ? "Using automated AI count"
        : "Using custom laboratory count";

  return (
    <Card className={cn("border-border/80 bg-surface-elevated shadow-xs", className)}>
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-student" />
            <CardTitle className="text-sm font-semibold">
              Colony Concentration Calculator (CFU/mL)
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
              {provenanceLabel}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetCalculator}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              title="Reset calculator parameters to defaults"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset Calculator
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-4">
        {/* Step 1: Count Source Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-foreground">1. Select Colony Count Source</Label>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Colony count source"
          >
            {/* Option A: Reviewed Count */}
            <button
              type="button"
              role="radio"
              aria-checked={countSource === "reviewed"}
              onClick={() => setCountSource("reviewed")}
              className={cn(
                "flex flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-all",
                countSource === "reviewed"
                  ? "border-violet-500 bg-violet-500/10 text-foreground ring-1 ring-violet-500"
                  : "border-border/70 bg-surface/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Reviewed Count</span>
                <UserCheck className="h-3.5 w-3.5 text-violet-500" />
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-foreground">
                {effectiveReviewedCount}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {hasModifications ? "Human-verified" : "Matches AI baseline"}
              </span>
            </button>

            {/* Option B: AI Count */}
            <button
              type="button"
              role="radio"
              aria-checked={countSource === "ai"}
              onClick={() => setCountSource("ai")}
              className={cn(
                "flex flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-all",
                countSource === "ai"
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                  : "border-border/70 bg-surface/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold text-foreground">AI Count</span>
                <Sparkles className="h-3.5 w-3.5 text-researcher" />
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-foreground">{aiCount}</div>
              <span className="text-[10px] text-muted-foreground">Automated inference</span>
            </button>

            {/* Option C: Custom Lab Count */}
            <button
              type="button"
              role="radio"
              aria-checked={countSource === "custom"}
              onClick={() => setCountSource("custom")}
              className={cn(
                "flex flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-all",
                countSource === "custom"
                  ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500"
                  : "border-border/70 bg-surface/50 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Custom Lab Count</span>
                <Edit3 className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-foreground">
                {customCountInput.trim() ? customCountInput.trim() : "—"}
              </div>
              <span className="text-[10px] text-muted-foreground">Manual entry</span>
            </button>
          </div>

          {/* Custom Count Input Field (shown when custom count is selected) */}
          {countSource === "custom" && (
            <div className="pt-1 space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-count-input" className="text-[11px] text-muted-foreground">
                  Enter whole colony count:
                </Label>
                <Input
                  id="custom-count-input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 150"
                  value={customCountInput}
                  onChange={(e) => setCustomCountInput(e.target.value)}
                  className="h-8 max-w-[140px] font-mono text-xs"
                />
              </div>
              {customCountError && (
                <p className="text-[11px] text-destructive font-medium">{customCountError}</p>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Plated Volume & Dilution Inputs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Volume Plated Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="plated-volume-input" className="text-xs font-medium text-foreground">
                2. Volume Plated
              </Label>
              {/* Unit Toggle: mL vs µL */}
              <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setVolumeUnit("mL")}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors",
                    volumeUnit === "mL"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  mL
                </button>
                <button
                  type="button"
                  onClick={() => setVolumeUnit("uL")}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors",
                    volumeUnit === "uL"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  µL
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="plated-volume-input"
                type="number"
                min={volumeUnit === "uL" ? "1" : "0.001"}
                max={volumeUnit === "uL" ? "10000" : "10"}
                step={volumeUnit === "uL" ? "10" : "0.01"}
                placeholder={volumeUnit === "uL" ? "Enter volume (e.g. 100)" : "Enter volume (e.g. 0.1)"}
                value={volumeInput}
                onChange={(e) => setVolumeInput(e.target.value)}
                className="h-9 font-mono text-xs"
              />
              <span className="font-mono text-xs font-medium text-muted-foreground min-w-[24px]">
                {volumeUnit === "uL" ? "µL" : "mL"}
              </span>
            </div>

            {/* Quick volume preset helpers */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[10px] text-muted-foreground">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setVolumeUnit("mL");
                  setVolumeInput("0.1");
                }}
                className="rounded border border-border/70 bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-primary hover:text-foreground"
              >
                0.1 mL (100 µL)
              </button>
              <button
                type="button"
                onClick={() => {
                  setVolumeUnit("mL");
                  setVolumeInput("0.05");
                }}
                className="rounded border border-border/70 bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-primary hover:text-foreground"
              >
                0.05 mL (50 µL)
              </button>
              <button
                type="button"
                onClick={() => {
                  setVolumeUnit("mL");
                  setVolumeInput("1.0");
                }}
                className="rounded border border-border/70 bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-primary hover:text-foreground"
              >
                1.0 mL (pour)
              </button>
            </div>

            {volumeError && (
              <p className="text-[11px] text-destructive font-medium">{volumeError}</p>
            )}
          </div>

          {/* Dilution Exponent Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="dilution-exponent-input" className="text-xs font-medium text-foreground">
                3. Serial Dilution (10⁻ⁿ)
              </Label>
              <span className="font-mono text-[11px] font-semibold text-student">
                10{formatSuperscript(-dilutionExponent)}
                {dilutionExponent > 0
                  ? ` (1:${Math.pow(10, dilutionExponent).toLocaleString()})`
                  : " (Undiluted 1:1)"}
              </span>
            </div>

            {/* Quick Exponent Pills (10^0 through 10^-8) */}
            <div className="flex flex-wrap gap-1" role="group" aria-label="Serial dilution quick select">
              {COMMON_DILUTION_EXPONENTS.map((exp) => (
                <button
                  key={`dilution-exp-${exp}`}
                  type="button"
                  onClick={() => setDilutionExponent(exp)}
                  className={cn(
                    "h-7 min-w-[34px] rounded px-1.5 font-mono text-[11px] font-medium transition-colors",
                    dilutionExponent === exp
                      ? "bg-student text-white shadow-xs"
                      : "border border-border/70 bg-surface text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                  title={`10${formatSuperscript(-exp)} dilution (factor: 10^${-exp})`}
                >
                  10{formatSuperscript(-exp)}
                </button>
              ))}
            </div>

            {/* Custom Exponent Integer Input */}
            <div className="flex items-center gap-2 pt-0.5">
              <Label htmlFor="dilution-exponent-input" className="text-[10px] text-muted-foreground">
                Exponent n (0–12):
              </Label>
              <Input
                id="dilution-exponent-input"
                type="number"
                min="0"
                max="12"
                step="1"
                value={customExponentInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomExponentInput(val);
                  const parsed = parseInt(val, 10);
                  if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 12) {
                    setDilutionExponent(parsed);
                  }
                }}
                className="h-7 w-20 font-mono text-xs"
              />
              <span className="text-[10px] text-muted-foreground font-mono">
                = 10{formatSuperscript(-dilutionExponent)}
              </span>
            </div>

            {exponentError && (
              <p className="text-[11px] text-destructive font-medium">{exponentError}</p>
            )}
          </div>
        </div>

        {/* Step 3: Calculation Output Display */}
        {calculationResult ? (
          <div className="rounded-xl border border-border/80 bg-surface/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-researcher" />
                Calculated Concentration
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-muted-foreground">
                  Count Used: <strong className="text-foreground">{calculationResult.activeCount}</strong>
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Volume: <strong className="text-foreground">{calculationResult.activeVolumeMl} mL</strong>
                </span>
              </div>
            </div>

            {/* Primary Concentration KPI Card */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 rounded-lg bg-surface-elevated p-3 border border-border/80">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">
                  Colony Forming Units per Milliliter
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-foreground font-mono">
                    {formatScientificNotation(calculationResult.cfuPerMl)}
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">CFU/mL</span>
                </div>
                {/* Localized decimal display if reasonable */}
                {calculationResult.cfuPerMl > 0 && calculationResult.cfuPerMl < 1e9 && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({Math.round(calculationResult.cfuPerMl).toLocaleString()} CFU/mL)
                  </span>
                )}
              </div>

              {/* Zero Count / Limit of Detection Badge */}
              {calculationResult.activeCount === 0 && (
                <div className="rounded-md border border-border/80 bg-surface px-2.5 py-1.5 text-xs space-y-0.5">
                  <span className="text-[10px] font-semibold text-startup block uppercase tracking-wider">
                    Limit of Detection (Reporting Aid)
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    &lt; {formatScientificNotation(calculationResult.llodCfuPerMl)} CFU/mL
                  </span>
                  <p className="text-[9px] text-muted-foreground/80 leading-tight">
                    Mathematical reporting aid: &lt; 1 / (V × D)
                  </p>
                </div>
              )}
            </div>

            {/* Formula Breadcrumb */}
            <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono text-muted-foreground bg-surface/50 p-2 rounded-md border border-border/50">
              <span className="text-foreground font-medium">Formula:</span>
              <span>CFU/mL = Count / (Volume × Dilution)</span>
              <span>=</span>
              <span>
                {calculationResult.activeCount} / ({calculationResult.activeVolumeMl} mL × 10
                {formatSuperscript(-calculationResult.dilutionExponent)})
              </span>
              <span>=</span>
              <span className="text-foreground font-semibold">
                {formatScientificNotation(calculationResult.cfuPerMl)} CFU/mL
              </span>
            </div>

            {/* TNTC / High-Density Advisory Warning Banner inside Calculator */}
            {isPotentialTntc && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Provisional — High Density / Potential TNTC</span>
                </div>
                <p className="text-[11px] text-foreground/90 leading-relaxed">
                  Plate exceeds the recommended countable-density range (30–300 CFU). The
                  concentration estimate may undercount the true population when colonies are
                  crowded or confluent.
                </p>
                {reviewRecommended && !hasModifications && (
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium pt-0.5">
                    Review the detected colonies on the canvas before finalizing this concentration.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty / Incomplete Input Prompt */
          <div className="rounded-xl border border-dashed border-border/80 bg-surface/30 p-4 text-center text-xs text-muted-foreground">
            <Info className="mx-auto h-4 w-4 opacity-50 mb-1" />
            <span>
              {!volumeInput.trim()
                ? "Enter the plated volume above (e.g. 0.1 mL) to calculate CFU/mL concentration."
                : customCountError || volumeError || exponentError || "Complete the required fields above to calculate concentration."}
            </span>
          </div>
        )}

        {/* Scientific Disclaimer Note */}
        <div className="rounded-lg border border-border/40 bg-surface/20 p-2.5 text-[10px] text-muted-foreground leading-relaxed">
          <strong>Scientific Notice: </strong>
          CFU/mL is a mathematical extrapolation based on user-entered volume and dilution factors.
          Automated colony detection assists quantification; it does not validate pipetting
          accuracy, biological viability, or sterility controls.
        </div>
      </CardContent>
    </Card>
  );
}
