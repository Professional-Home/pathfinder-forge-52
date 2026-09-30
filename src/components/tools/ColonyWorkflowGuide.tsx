import * as React from "react";
import { Compass, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DemoPlateItem } from "@/components/tools/ColonyDemoPlates";

export type WorkflowStepId = "specimen" | "analyze" | "review" | "quantify" | "export";
export type StepStatus = "completed" | "current" | "available" | "upcoming";

export interface WorkflowStep {
  id: WorkflowStepId;
  number: number;
  title: string;
  description: string;
  status: StepStatus;
  statusLabel: string;
}

export interface ColonyWorkflowGuideProps {
  /** Uploaded local file or null */
  selectedFile?: File | null;
  /** Active demo plate or null */
  activeDemo?: DemoPlateItem | null;
  /** Primary workflow page state */
  pageState: "EMPTY" | "READY" | "ANALYZING" | "SUCCESS" | "ERROR";
  /** Whether the user has added or removed colonies in human review */
  hasModifications?: boolean;
  /** Whether CFU calculation has been performed with valid volume */
  cfuCalculated?: boolean;
  /** Optional custom class name */
  className?: string;
  /** Controlled or default expansion state */
  defaultExpanded?: boolean;
}

export function computeWorkflowSteps(params: {
  hasSpecimen: boolean;
  pageState: "EMPTY" | "READY" | "ANALYZING" | "SUCCESS" | "ERROR";
  hasModifications?: boolean;
  cfuCalculated?: boolean;
}): WorkflowStep[] {
  const { hasSpecimen, pageState, hasModifications = false, cfuCalculated = false } = params;
  const hasResults = pageState === "SUCCESS";

  // Step 1: Specimen
  const step1Status: StepStatus = hasSpecimen ? "completed" : "current";

  // Step 2: Analyze
  let step2Status: StepStatus = "upcoming";
  if (hasResults) {
    step2Status = "completed";
  } else if (hasSpecimen) {
    step2Status = "current";
  }

  // Step 3: Review
  let step3Status: StepStatus = "upcoming";
  if (hasResults) {
    if (cfuCalculated || hasModifications) {
      step3Status = "completed";
    } else {
      step3Status = "current";
    }
  }

  // Step 4: Quantify
  let step4Status: StepStatus = "upcoming";
  if (hasResults) {
    if (cfuCalculated) {
      step4Status = "completed";
    } else if (hasModifications) {
      step4Status = "current";
    } else {
      step4Status = "available";
    }
  }

  // Step 5: Export
  let step5Status: StepStatus = "upcoming";
  if (hasResults) {
    if (cfuCalculated) {
      step5Status = "current";
    } else {
      step5Status = "available";
    }
  }

  const getStatusLabel = (status: StepStatus): string => {
    switch (status) {
      case "completed":
        return "Completed";
      case "current":
        return "Current Step";
      case "available":
        return "Available";
      case "upcoming":
        return "Upcoming";
    }
  };

  return [
    {
      id: "specimen",
      number: 1,
      title: "Specimen",
      description: "Upload an image or choose a demo plate.",
      status: step1Status,
      statusLabel: getStatusLabel(step1Status),
    },
    {
      id: "analyze",
      number: 2,
      title: "Analyze",
      description: "Run AI colony detection.",
      status: step2Status,
      statusLabel: getStatusLabel(step2Status),
    },
    {
      id: "review",
      number: 3,
      title: "Review",
      description: "Review, remove, or add detections.",
      status: step3Status,
      statusLabel: getStatusLabel(step3Status),
    },
    {
      id: "quantify",
      number: 4,
      title: "Quantify",
      description: "Use the selected colony count for CFU/mL calculation.",
      status: step4Status,
      statusLabel: getStatusLabel(step4Status),
    },
    {
      id: "export",
      number: 5,
      title: "Export",
      description: "Export detection and analysis results.",
      status: step5Status,
      statusLabel: getStatusLabel(step5Status),
    },
  ];
}

export function ColonyWorkflowGuide({
  selectedFile,
  activeDemo,
  pageState,
  hasModifications = false,
  cfuCalculated = false,
  className,
  defaultExpanded = true,
}: ColonyWorkflowGuideProps) {
  const [isExpanded, setIsExpanded] = React.useState<boolean>(defaultExpanded);

  const hasSpecimen = Boolean(selectedFile || activeDemo);
  const steps = computeWorkflowSteps({
    hasSpecimen,
    pageState,
    hasModifications,
    cfuCalculated,
  });

  return (
    <Card
      role="region"
      aria-label="Colony Counter Workflow Guide"
      className={cn(
        "border-border/80 bg-surface-elevated/90 shadow-xs backdrop-blur-xs",
        className,
      )}
    >
      <CardContent className="p-3.5 sm:p-4">
        {/* Guide Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/60 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-researcher/10 text-researcher">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Colony Counter Workflow
            </h2>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              · 5 Guided Steps
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground font-medium"
            aria-expanded={isExpanded}
            aria-controls="colony-workflow-guide-steps"
            aria-label={
              isExpanded
                ? "Switch to compact workflow guide view"
                : "Expand workflow guide descriptions"
            }
          >
            {isExpanded ? (
              <>
                <span>Compact View</span>
                <ChevronUp className="ml-1 h-3 w-3" aria-hidden="true" />
              </>
            ) : (
              <>
                <span>Detailed View</span>
                <ChevronDown className="ml-1 h-3 w-3" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>

        {/* 5 Workflow Stages List */}
        <nav aria-label="Workflow Stages">
          <ol
            id="colony-workflow-guide-steps"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5"
          >
            {steps.map((step) => {
              const isCurrent = step.status === "current";
              const isCompleted = step.status === "completed";
              const isAvailable = step.status === "available";
              const isUpcoming = step.status === "upcoming";

              return (
                <li
                  key={step.id}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "relative flex flex-col justify-between rounded-xl border p-2.5 sm:p-3 transition-colors text-left",
                    isCurrent &&
                      "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-xs ring-1 ring-primary/30",
                    isCompleted &&
                      "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10",
                    isAvailable &&
                      "border-border/80 bg-surface/50 text-foreground",
                    isUpcoming &&
                      "border-border/40 bg-surface/20 text-muted-foreground/70 opacity-75",
                  )}
                >
                  <div>
                    {/* Stage Header: Number/Icon, Title, Badge */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isCompleted ? (
                          <span
                            title="Completed"
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 shrink-0"
                          >
                            <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-mono font-bold shrink-0",
                              isCurrent
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
                                : isAvailable
                                  ? "bg-secondary text-secondary-foreground border border-border"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {step.number}
                          </span>
                        )}

                        <span
                          className={cn(
                            "text-xs truncate",
                            isCurrent ? "font-bold text-foreground" : "font-semibold text-foreground/90",
                          )}
                        >
                          {step.title}
                        </span>
                      </div>

                      {/* Status Text Badge */}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 font-medium h-4 shrink-0",
                          isCompleted &&
                            "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
                          isCurrent &&
                            "border-primary/40 text-primary bg-primary/10 font-semibold",
                          isAvailable &&
                            "border-border text-foreground/80 bg-secondary/50",
                          isUpcoming &&
                            "border-border/50 text-muted-foreground bg-muted/40",
                        )}
                      >
                        {step.statusLabel}
                      </Badge>
                    </div>

                    {/* Stage Description (Hidden in Compact View) */}
                    {isExpanded && (
                      <p
                        className={cn(
                          "text-[11px] leading-relaxed mt-1",
                          isUpcoming ? "text-muted-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {step.description}
                      </p>
                    )}
                  </div>

                  {/* Non-color accessibility screen-reader label */}
                  <span className="sr-only">
                    {`Step ${step.number}: ${step.title}. ${step.description.replace(/\.$/, "")}. Status: ${step.statusLabel}.`}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      </CardContent>
    </Card>
  );
}
