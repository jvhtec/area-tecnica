// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PowerStandardsNotes } from "@/features/technical-tools/power/PowerStandardsNotes";
import { assessPowerTableStandards } from "@/features/technical-tools/power/powerStandardsAssessment";
import {
  POWER_CALCULATION_VERSION,
  type PowerTable,
} from "@/features/technical-tools/power/types";

const table: PowerTable = {
  id: 1,
  name: "Escenario",
  includesHoist: true,
  pduType: "CEE32A 3P+N+G",
  rows: [
    {
      quantity: "5",
      componentId: "8",
      watts: "2000",
      totalWatts: 10000,
      pf: "0.90",
      fixtureType: "discharge",
    },
  ],
  calculation: {
    version: POWER_CALCULATION_VERSION,
    totalWatts: 10000,
    adjustedWatts: 10000,
    totalVa: 11111.11,
    currentLine: 16.04,
    safetyMargin: 0,
    phaseMode: "three",
    voltage: 400,
    powerFactor: 0.9,
    powerFactorSource: "global",
    isEstimate: false,
  },
};

describe("PowerStandardsNotes", () => {
  it("renders every finding of an assessed table with its clause reference", () => {
    const assessment = assessPowerTableStandards(table);
    render(<PowerStandardsNotes findings={assessment?.findings ?? []} />);

    expect(screen.getByText("REBT ITC-BT-44 apdo. 3.1")).toBeInTheDocument();
    expect(screen.getByText("UNE-HD 60364-5-52 Anexo E / REBT ITC-BT-19")).toBeInTheDocument();
    expect(screen.getByText("REBT ITC-BT-47 apdo. 3.1")).toBeInTheDocument();
    expect(screen.getByText(/no cubre ese mínimo reglamentario/)).toBeInTheDocument();
  });

  it("renders nothing when a table raises no finding", () => {
    const { container } = render(<PowerStandardsNotes findings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
