import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import {
  ColonyWorkflowGuide,
  computeWorkflowSteps,
} from "../ColonyWorkflowGuide";
import { DEMO_PLATES } from "../ColonyDemoPlates";

describe("ColonyWorkflowGuide Component", () => {
  const dummyFile = new File(["dummy"], "agar_plate.jpg", { type: "image/jpeg" });
  const demoPlateA = DEMO_PLATES[0];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Requirement 11.1: Renders all five workflow stages
  it("renders all five workflow stages with required titles and descriptions", () => {
    render(<ColonyWorkflowGuide selectedFile={null} pageState="EMPTY" />);

    // Stage titles
    expect(screen.getByText("Specimen")).toBeInTheDocument();
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Quantify")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();

    // Stage descriptions
    expect(
      screen.getByText("Upload an image or try a demo plate"),
    ).toBeInTheDocument();
    expect(screen.getByText("Run AI colony detection")).toBeInTheDocument();
    expect(
      screen.getByText("Review, remove, or add colony detections"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Calculate CFU/mL using your assay parameters"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Download CSV data or print the analysis report"),
    ).toBeInTheDocument();
  });

  // Requirement 11.2: Initial state identifies Specimen as the current stage
  it("identifies Specimen as the current stage when no image is selected", () => {
    render(<ColonyWorkflowGuide selectedFile={null} pageState="EMPTY" />);

    const steps = screen.getAllByRole("listitem");
    expect(steps.length).toBe(5);

    // Step 1: Specimen should have aria-current="step"
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveTextContent("Current Step");

    // Subsequent steps should be upcoming
    expect(steps[1]).not.toHaveAttribute("aria-current");
    expect(steps[1]).toHaveTextContent("Upcoming");
    expect(steps[2]).toHaveTextContent("Upcoming");
    expect(steps[3]).toHaveTextContent("Upcoming");
    expect(steps[4]).toHaveTextContent("Upcoming");
  });

  // Requirement 11.3: Ready-to-analyze state identifies Analyze as current
  it("identifies Analyze as current and Specimen as completed when image is ready", () => {
    render(<ColonyWorkflowGuide selectedFile={dummyFile} pageState="READY" />);

    const steps = screen.getAllByRole("listitem");

    // Step 1: Specimen is completed
    expect(steps[0]).not.toHaveAttribute("aria-current");
    expect(steps[0]).toHaveTextContent("Completed");

    // Step 2: Analyze is current
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[1]).toHaveTextContent("Current Step");

    // Steps 3-5 are upcoming
    expect(steps[2]).toHaveTextContent("Upcoming");
    expect(steps[3]).toHaveTextContent("Upcoming");
    expect(steps[4]).toHaveTextContent("Upcoming");
  });

  // Requirement 11.4: Completed analysis exposes Review as the current/next meaningful stage
  it("exposes Review as current when analysis completes successfully", () => {
    render(
      <ColonyWorkflowGuide
        selectedFile={dummyFile}
        pageState="SUCCESS"
        hasModifications={false}
        cfuCalculated={false}
      />,
    );

    const steps = screen.getAllByRole("listitem");

    // Steps 1 & 2 completed
    expect(steps[0]).toHaveTextContent("Completed");
    expect(steps[1]).toHaveTextContent("Completed");

    // Step 3: Review is current
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).toHaveTextContent("Current Step");
  });

  // Requirement 11.5: Available Quantify and Export stages are represented accurately
  it("accurately represents Quantify and Export as available when analysis results exist", () => {
    render(
      <ColonyWorkflowGuide
        selectedFile={dummyFile}
        pageState="SUCCESS"
        hasModifications={false}
        cfuCalculated={false}
      />,
    );

    const steps = screen.getAllByRole("listitem");

    // Quantify & Export must be marked Available rather than claiming completion
    expect(steps[3]).toHaveTextContent("Available");
    expect(steps[4]).toHaveTextContent("Available");

    expect(steps[3]).not.toHaveTextContent("Completed");
    expect(steps[4]).not.toHaveTextContent("Completed");
  });

  it("updates Quantify to completed and Export to current once CFU/mL is calculated", () => {
    render(
      <ColonyWorkflowGuide
        selectedFile={dummyFile}
        pageState="SUCCESS"
        hasModifications={true}
        cfuCalculated={true}
      />,
    );

    const steps = screen.getAllByRole("listitem");

    expect(steps[0]).toHaveTextContent("Completed");
    expect(steps[1]).toHaveTextContent("Completed");
    expect(steps[2]).toHaveTextContent("Completed");
    expect(steps[3]).toHaveTextContent("Completed");
    expect(steps[4]).toHaveAttribute("aria-current", "step");
    expect(steps[4]).toHaveTextContent("Current Step");
  });

  // Requirement 11.6: Completed/current/upcoming states have non-color indicators
  it("provides non-color indicators (icons, numbers, explicit text badges) for all states", () => {
    render(
      <ColonyWorkflowGuide
        selectedFile={dummyFile}
        pageState="SUCCESS"
        hasModifications={false}
        cfuCalculated={false}
      />,
    );

    const steps = screen.getAllByRole("listitem");

    // Completed step 1 has check icon and 'Completed' text
    expect(steps[0]).toHaveTextContent("Completed");
    expect(steps[0].querySelector("svg")).toBeInTheDocument();

    // Current step 3 has stage number and 'Current Step' text
    expect(steps[2]).toHaveTextContent("Current Step");
    expect(steps[2]).toHaveTextContent("3");

    // Available steps have stage numbers and 'Available' text
    expect(steps[3]).toHaveTextContent("Available");
    expect(steps[3]).toHaveTextContent("4");
    expect(steps[4]).toHaveTextContent("Available");
    expect(steps[4]).toHaveTextContent("5");
  });

  // Requirement 11.7: Current step has appropriate accessible semantics
  it("exposes semantic navigation, list structure, aria-current, and screen reader labels", () => {
    render(<ColonyWorkflowGuide selectedFile={null} pageState="EMPTY" />);

    // Semantic navigation landmark
    const nav = screen.getByRole("navigation", { name: "Workflow Stages" });
    expect(nav).toBeInTheDocument();

    // Semantic ordered list
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();

    // Programmatic current step
    const currentStep = screen.getByRole("listitem", { current: "step" });
    expect(currentStep).toHaveTextContent("Specimen");

    // Full screen-reader text summary for accessibility
    expect(
      screen.getByText(/Step 1: Specimen\. Upload an image or try a demo plate\. Status: Current Step\./i),
    ).toBeInTheDocument();
  });

  // Requirement 11.8: Demo workflow does not create a separate state model
  it("handles Demo Plate workflow identically to standard file upload without separate state model", () => {
    render(
      <ColonyWorkflowGuide
        selectedFile={null}
        activeDemo={demoPlateA}
        pageState="READY"
      />,
    );

    const steps = screen.getAllByRole("listitem");

    // Demo plate satisfies Step 1 (Specimen) exactly as a normal upload does
    expect(steps[0]).toHaveTextContent("Completed");
    expect(steps[0]).not.toHaveAttribute("aria-current");

    // Step 2 (Analyze) is the current step
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[1]).toHaveTextContent("Current Step");
  });

  // Requirement 11.9: Responsive structure does not introduce invalid/duplicate interactive controls
  it("maintains informational nature without competing action buttons and supports compact toggle", () => {
    render(<ColonyWorkflowGuide selectedFile={null} pageState="EMPTY" defaultExpanded={true} />);

    // There should be NO competing "Analyze" or "Upload" buttons inside the guide
    expect(screen.queryByRole("button", { name: /^Analyze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Upload/i })).not.toBeInTheDocument();

    // The only button is the accessible view toggle (Compact / Detailed)
    const toggleBtn = screen.getByRole("button", {
      name: "Switch to compact workflow guide view",
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Clicking toggle collapses descriptions into compact view
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("Upload an image or try a demo plate"),
    ).not.toBeInTheDocument();

    // Titles and status badges remain visible in compact view
    expect(screen.getByText("Specimen")).toBeInTheDocument();
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Quantify")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  // Unit verification of pure computeWorkflowSteps state transition logic
  describe("computeWorkflowSteps transition matrix", () => {
    it("handles ERROR state gracefully without breaking workflow progression", () => {
      const steps = computeWorkflowSteps({
        hasSpecimen: true,
        pageState: "ERROR",
      });

      // Specimen completed, Analyze is current (ready for retry), remainder upcoming
      expect(steps[0].status).toBe("completed");
      expect(steps[1].status).toBe("current");
      expect(steps[2].status).toBe("upcoming");
      expect(steps[3].status).toBe("upcoming");
      expect(steps[4].status).toBe("upcoming");
    });

    it("handles human review modifications by completing Review and pointing to Quantify", () => {
      const steps = computeWorkflowSteps({
        hasSpecimen: true,
        pageState: "SUCCESS",
        hasModifications: true,
        cfuCalculated: false,
      });

      expect(steps[0].status).toBe("completed");
      expect(steps[1].status).toBe("completed");
      expect(steps[2].status).toBe("completed");
      expect(steps[3].status).toBe("current");
      expect(steps[4].status).toBe("available");
    });
  });
});
