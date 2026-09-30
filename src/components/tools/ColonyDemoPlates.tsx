import * as React from "react";
import { FlaskConical, Loader2, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DemoPlateItem {
  id: string;
  name: string;
  densityLabel: string;
  description: string;
  imageUrl: string;
  filename: string;
}

export const DEMO_PLATES: DemoPlateItem[] = [
  {
    id: "demo-a",
    name: "Demo Plate A — Low Density",
    densityLabel: "Low Density",
    description: "Sparse, isolated colonies (~30 count) for testing baseline counting sensitivity.",
    imageUrl: "/demo-plates/demo-plate-a-low-density.jpg",
    filename: "demo-plate-a-low-density.jpg",
  },
  {
    id: "demo-b",
    name: "Demo Plate B — Medium Density",
    densityLabel: "Medium Density",
    description: "Moderate colony count (~130 count) with typical laboratory agar distribution.",
    imageUrl: "/demo-plates/demo-plate-b-medium-density.jpg",
    filename: "demo-plate-b-medium-density.jpg",
  },
  {
    id: "demo-c",
    name: "Demo Plate C — High Density",
    densityLabel: "High Density",
    description: "High colony density (~300 count) testing crowded detection and quality assessment.",
    imageUrl: "/demo-plates/demo-plate-c-high-density.jpg",
    filename: "demo-plate-c-high-density.jpg",
  },
];

/**
 * Loads a demo image asset from a static URL and wraps it into a standard browser File object.
 */
export async function fetchDemoPlateFile(demo: DemoPlateItem): Promise<File> {
  const response = await fetch(demo.imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to load demo plate ${demo.name}: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new File([blob], demo.filename, { type: blob.type || "image/jpeg" });
}

export interface ColonyDemoPlatesProps {
  onSelectDemo: (demo: DemoPlateItem) => void;
  selectedDemoId?: string | null;
  disabled?: boolean;
  className?: string;
  loadingDemoId?: string | null;
}

export function ColonyDemoPlates({
  onSelectDemo,
  selectedDemoId,
  disabled = false,
  className,
  loadingDemoId,
}: ColonyDemoPlatesProps) {
  return (
    <Card className={cn("border-border/80 bg-surface-elevated shadow-xs", className)}>
      <CardHeader className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FlaskConical className="h-4 w-4 text-researcher" />
            Try a Demo Plate
          </CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
            Quick Start
          </Badge>
        </div>
        <CardDescription className="text-xs">
          <span className="font-medium text-foreground block mb-0.5">
            No Petri dish image? Try a demo plate.
          </span>
          Choose a sample Petri dish plate to immediately test the automated detection workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-2 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {DEMO_PLATES.map((demo) => {
            const isSelected = selectedDemoId === demo.id;
            const isLoadingThis = loadingDemoId === demo.id;
            return (
              <div
                key={demo.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl border p-3 transition-all",
                  isSelected
                    ? "border-researcher bg-researcher-soft/30 shadow-xs ring-1 ring-researcher/50"
                    : "border-border/70 bg-surface hover:border-researcher/50 hover:bg-surface-elevated",
                  disabled && "opacity-60 pointer-events-none",
                )}
              >
                <div className="space-y-2">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                    <img
                      src={demo.imageUrl}
                      alt={demo.name}
                      className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                      loading="lazy"
                    />
                    <Badge
                      variant="secondary"
                      className="absolute bottom-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0 bg-background/90 backdrop-blur-xs text-foreground border border-border/50"
                    >
                      {demo.densityLabel}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-foreground leading-snug">
                      {demo.name}
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-normal line-clamp-2">
                      {demo.description}
                    </p>
                  </div>
                </div>

                <div className="pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => onSelectDemo(demo)}
                    disabled={disabled || isLoadingThis}
                    aria-busy={isLoadingThis}
                    aria-pressed={isSelected}
                    aria-label={isLoadingThis ? `Loading ${demo.name}` : `Use ${demo.name}`}
                    className={cn(
                      "w-full h-8 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border-border/80 hover:border-researcher hover:text-researcher",
                    )}
                  >
                    {isLoadingThis ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : isSelected ? (
                      <>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
                        Selected
                      </>
                    ) : (
                      "Use Demo"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scientific Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
          <Info className="h-3.5 w-3.5 text-researcher shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Demo plates are synthetic examples for exploring the interface. Results are generated by
            the same analysis workflow used for uploaded images. Demo images are provided for software
            demonstration only and are not real specimen results.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
