import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColonyResultsPanel } from "../ColonyResultsPanel";
import type { ColonyDetectionSuccessResponse } from "@/lib/colony-api";
import type { ManualColony } from "@/hooks/use-colony-review";

describe("ColonyResultsPanel - Results & Analysis Summary UX", () => {
  const baseMockResponse: ColonyDetectionSuccessResponse = {
    success: true,
    count: 300,
    detections: Array.from({ length: 300 }, (_, i) => ({
      x1: 10 + (i % 20) * 10,
      y1: 10 + Math.floor(i / 20) * 10,
      x2: 20 + (i % 20) * 10,
      y2: 20 + Math.floor(i / 20) * 10,
      confidence: 0.88,
      class_id: 0,
      class_name: "colony",
    })),
    processing_time_ms: 120,
    image: { width: 1024, height: 1024 },
    quality: {
      density_level: "high",
      review_recommended: true,
      confluence_risk: "high",
      overlap_ratio: 0.09,
      reason: "High colony density across plate",
      warning_message: "High-density plate detected. Automated count may be less reliable in crowded colony regions. Manual verification is recommended.",
    },
  };

  it("1. prominently labels the reviewed count as the primary result", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        hasModifications={true}
      />,
    );

    const primaryCount = screen.getByTestId("primary-reviewed-count");
    expect(primaryCount).toBeInTheDocument();
    expect(primaryCount).toHaveTextContent("305");
    expect(screen.getByText("Reviewed colony count")).toBeInTheDocument();
  });

  it("2. clearly distinguishes AI count from reviewed count", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        removedCount={1}
        addedCount={6}
        hasModifications={true}
      />,
    );

    // Primary result displays reviewed count
    expect(screen.getByTestId("primary-reviewed-count")).toHaveTextContent("305");

    // KPI grid displays AI Baseline Count distinctly
    const kpiAiCount = screen.getByTestId("kpi-ai-count");
    expect(kpiAiCount).toHaveTextContent("300");
    expect(screen.getByText("AI Baseline Count")).toBeInTheDocument();
  });

  it("3 & 4. displays removed AI count and manual added count accurately", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        removedCount={1}
        addedCount={6}
        hasModifications={true}
      />,
    );

    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("−1");
    expect(screen.getByTestId("lineage-added-count")).toHaveTextContent("+6");
  });

  it("5. displays mathematically consistent count lineage using actual production values", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        removedCount={1}
        addedCount={6}
        hasModifications={true}
      />,
    );

    const lineageBlock = screen.getByTestId("count-lineage-block");
    expect(lineageBlock).toBeInTheDocument();

    expect(screen.getByTestId("lineage-ai-count")).toHaveTextContent("300");
    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("−1");
    expect(screen.getByTestId("lineage-added-count")).toHaveTextContent("+6");
    expect(screen.getByTestId("lineage-reviewed-count")).toHaveTextContent("305");

    // Screen reader complete mathematical lineage string is present
    expect(
      screen.getByText(/Count lineage: AI detected 300 minus 1 removed plus 6 manual equals reviewed count 305\./i),
    ).toBeInTheDocument();
  });

  it("6. displays appropriate provenance when result is unmodified", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={300}
        removedCount={0}
        addedCount={0}
        hasModifications={false}
      />,
    );

    // Provenance badge indicates AI detections baseline
    const provenanceBadge = screen.getByTestId("count-provenance-badge");
    expect(provenanceBadge).toHaveTextContent("AI detections");

    // Provenance summary line
    const summaryLine = screen.getByTestId("provenance-summary-line");
    expect(summaryLine).toHaveTextContent("AI detected 300 · No manual changes");

    // Lineage indicators for 0 changes
    expect(screen.getByTestId("lineage-removed-count")).toHaveTextContent("0");
    expect(screen.getByTestId("lineage-added-count")).toHaveTextContent("0");
  });

  it("7. displays full provenance and lineage summary when human modifications exist", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        removedCount={1}
        addedCount={6}
        hasModifications={true}
      />,
    );

    // Provenance badge indicates Human-reviewed count
    const provenanceBadge = screen.getByTestId("count-provenance-badge");
    expect(provenanceBadge).toHaveTextContent("Human-reviewed count");

    // Provenance summary line
    const summaryLine = screen.getByTestId("provenance-summary-line");
    expect(summaryLine).toHaveTextContent("AI detected 300 · 1 removed · 6 manually added");

    // Explanation clarifies human review meaning
    const explanation = screen.getByTestId("count-provenance-explanation");
    expect(explanation).toHaveTextContent(/Human-reviewed count includes AI detections after removals and manual additions/i);
  });

  it("8. displays density tier using existing backend value and detected colony count", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={300}
      />,
    );

    const densityLabel = screen.getByTestId("density-tier-label");
    expect(densityLabel).toHaveTextContent("High density — 300 detected colonies");
  });

  it("9. displays detected overlap and crowding ratio accurately", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={300}
      />,
    );

    const overlapLabel = screen.getByTestId("overlap-crowding-label");
    expect(overlapLabel).toHaveTextContent("Low detected overlap — 9%");
  });

  it("10. displays review recommendation prominently and factually", () => {
    const { rerender } = render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={300}
      />,
    );

    // Review recommended case
    expect(screen.getByTestId("review-recommendation-badge")).toHaveTextContent("Review Recommended");
    expect(screen.getByTestId("review-status-label")).toHaveTextContent("Human review recommended");

    // Review not recommended case (low density)
    const lowDensityResponse: ColonyDetectionSuccessResponse = {
      ...baseMockResponse,
      count: 42,
      detections: baseMockResponse.detections.slice(0, 42),
      quality: {
        density_level: "low",
        review_recommended: false,
        confluence_risk: "low",
        overlap_ratio: 0.02,
        reason: "Low colony density",
      },
    };

    rerender(
      <ColonyResultsPanel
        response={lowDensityResponse}
        reviewedCount={42}
      />,
    );

    expect(screen.getByTestId("review-recommendation-badge")).toHaveTextContent("Review Available");
    expect(screen.getByTestId("review-status-label")).toHaveTextContent("Human review is available");
  });

  it("11. explains quality screening signal without accuracy or validation claims", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={300}
      />,
    );

    const screeningNotice = screen.getByTestId("quality-signal-explanation");
    expect(screeningNotice).toHaveTextContent(
      "Density and overlap are screening indicators that help identify plates that may need closer human review.",
    );
    expect(screeningNotice).toHaveTextContent(
      "They do not represent model accuracy scores or certainty percentages.",
    );

    // Verify it doesn't overstate certainty
    expect(screeningNotice.textContent).not.toMatch(/100% accurate/i);
    expect(screeningNotice.textContent).not.toMatch(/validated result/i);
    expect(screeningNotice.textContent).not.toMatch(/AI certainty/i);
  });

  it("12. connects CFU calculation to reviewed count dynamically", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        hasModifications={true}
      />,
    );

    const cfuConnection = screen.getByTestId("cfu-source-connection");
    expect(cfuConnection).toHaveTextContent("CFU/mL uses the reviewed colony count.");
  });

  it("13 & 14. maintains accessible landmark semantics, regions, and headings", () => {
    render(
      <ColonyResultsPanel
        response={baseMockResponse}
        reviewedCount={305}
        hasModifications={true}
        isDemoPlate={true}
      />,
    );

    // Primary result card has role="region" with accessible label
    expect(
      screen.getByRole("region", { name: "Colony detection primary result and count lineage" }),
    ).toBeInTheDocument();

    // Quality summary has role="region" with accessible label
    expect(
      screen.getByRole("region", { name: "Plate density, crowding, and review recommendation summary" }),
    ).toBeInTheDocument();

    // Demo plate note has role="note"
    expect(
      screen.getByRole("note", { name: "Synthetic demonstration plate notice" }),
    ).toBeInTheDocument();
  });
});
