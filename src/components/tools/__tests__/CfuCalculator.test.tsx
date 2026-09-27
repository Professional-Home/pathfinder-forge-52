import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CfuCalculator } from "../CfuCalculator";
import type { CfuExportData } from "@/lib/colony-export";

describe("CfuCalculator Component", () => {
  it("renders with AI baseline count and displays prompt for volume", () => {
    render(<CfuCalculator aiCount={150} reviewedCount={150} />);

    expect(
      screen.getByText("Colony Concentration Calculator (CFU/mL)"),
    ).toBeInTheDocument();
    expect(screen.getByText("AI Count")).toBeInTheDocument();
    expect(screen.getAllByText("150").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/calculate CFU\/mL concentration/i)).toBeInTheDocument();
  });

  it("calculates concentration accurately for standard input (100 colonies, 0.1 mL, 10^-3 dilution)", async () => {
    const user = userEvent.setup();
    render(<CfuCalculator aiCount={100} reviewedCount={100} />);

    // Click quick preset: 0.1 mL (100 µL)
    const presetBtn = screen.getByRole("button", { name: /0\.1 mL \(100 µL\)/i });
    await user.click(presetBtn);

    // Click dilution exponent pill: 10^-3
    const exp3Btn = screen.getByRole("button", { name: "10⁻³" });
    await user.click(exp3Btn);

    // 100 / (0.1 * 10^-3) = 1,000,000 = 1 × 10⁶ CFU/mL (appears in KPI card and formula breakdown)
    const matches = screen.getAllByText(/1 × 10⁶/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CFU\/mL/i).length).toBeGreaterThan(0);
  });

  it("handles volume unit toggle between mL and µL accurately", async () => {
    const user = userEvent.setup();
    render(<CfuCalculator aiCount={50} reviewedCount={50} />);

    // Toggle to µL unit
    const uLBtn = screen.getByRole("button", { name: "µL" });
    await user.click(uLBtn);

    // Type 100 µL (= 0.1 mL)
    const volumeInput = screen.getByPlaceholderText(/Enter plated volume \(µL\)/i);
    await user.type(volumeInput, "100");

    // 50 / 0.1 mL = 500 CFU/mL = 5 × 10² CFU/mL
    const matches = screen.getAllByText(/5 × 10²/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CFU\/mL/i).length).toBeGreaterThan(0);
  });

  it("displays validation error when volume is invalid or out of range", async () => {
    const user = userEvent.setup();
    render(<CfuCalculator aiCount={50} reviewedCount={50} />);

    const volumeInput = screen.getByPlaceholderText(/Enter plated volume/i);
    await user.type(volumeInput, "0");

    const errMatches = screen.getAllByText(/Volume must be a positive number greater than 0/i);
    expect(errMatches.length).toBeGreaterThan(0);
  });

  it("allows switching count source to Reviewed Count and reflects reviewed count", async () => {
    const user = userEvent.setup();
    render(
      <CfuCalculator
        aiCount={100}
        reviewedCount={95}
        hasModifications={true}
      />,
    );

    // Since hasModifications=true, default source switches to reviewed count
    expect(screen.getByText("Using human-reviewed count")).toBeInTheDocument();

    const presetBtn = screen.getByRole("button", { name: /0\.1 mL \(100 µL\)/i });
    await user.click(presetBtn);

    // 95 / 0.1 = 950 CFU/mL = 9.5 × 10² CFU/mL
    const matches = screen.getAllByText(/9.5 × 10²/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("allows switching count source to Custom Lab Count and validates input", async () => {
    const user = userEvent.setup();
    render(<CfuCalculator aiCount={100} reviewedCount={100} />);

    const customRadio = screen.getByRole("radio", { name: /Custom Lab Count/i });
    await user.click(customRadio);

    // Custom count input should appear
    const customCountInput = screen.getByLabelText(/Enter whole colony count/i);
    expect(customCountInput).toBeInTheDocument();

    await user.type(customCountInput, "80");

    const presetBtn = screen.getByRole("button", { name: /0\.1 mL \(100 µL\)/i });
    await user.click(presetBtn);

    // 80 / 0.1 = 800 CFU/mL = 8 × 10² CFU/mL
    const matches = screen.getAllByText(/8 × 10²/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText("Using custom laboratory count")).toBeInTheDocument();
  });

  it("displays TNTC guidance alert when plate quality indicates confluence or ultra-high density", async () => {
    const user = userEvent.setup();
    render(
      <CfuCalculator
        aiCount={450}
        reviewedCount={450}
        quality={{
          density_level: "ultra_high",
          confluence_risk: "high",
          review_recommended: true,
          overlap_ratio: 0.35,
        }}
      />,
    );

    // Enter volume to trigger calculation output
    const presetBtn = screen.getByRole("button", { name: /0\.1 mL \(100 µL\)/i });
    await user.click(presetBtn);

    expect(
      screen.getByText(/Plate exceeds the recommended countable-density range/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Provisional — High Density \/ Potential TNTC/i),
    ).toBeInTheDocument();
  });

  it("emits calculation updates through onCalculationChange callback", async () => {
    const user = userEvent.setup();
    const handleCalculationChange = vi.fn<[CfuExportData | null], void>();

    render(
      <CfuCalculator
        aiCount={100}
        reviewedCount={100}
        onCalculationChange={handleCalculationChange}
      />,
    );

    // Set volume to 0.1 mL
    const presetBtn = screen.getByRole("button", { name: /0\.1 mL \(100 µL\)/i });
    await user.click(presetBtn);

    expect(handleCalculationChange).toHaveBeenCalled();
    const lastCall = handleCalculationChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.isValid).toBe(true);
    expect(lastCall?.activeCount).toBe(100);
    expect(lastCall?.volumeMl).toBe(0.1);
    expect(lastCall?.cfuPerMl).toBe(1000);
  });
});
