import { describe, expect, it } from "vitest";

import { formatPowerRequirementsText } from "@/utils/powerRequirementSelection";
import { POWER_CALCULATION_VERSION } from "@/features/technical-tools/power/types";

const calculation = {
  version: POWER_CALCULATION_VERSION,
  totalWatts: 29000,
  adjustedWatts: 34800,
  totalVa: 40941.18,
  currentLine: 59.09,
  safetyMargin: 20,
  phaseMode: "three" as const,
  voltage: 400,
  powerFactor: 0.85,
  powerFactorSource: "global" as const,
  isEstimate: false,
};

const row = (patch: Record<string, unknown> = {}) => ({
  id: "row-1",
  created_at: "2026-04-07T09:00:00.000Z",
  job_id: "job-1",
  department: "sound",
  stage_number: null,
  stage_name: null,
  table_name: "MAIN L",
  total_watts: 29000,
  current_per_phase: 59.09,
  pdu_type: "CEE125A 3P+N+G",
  custom_pdu_type: null,
  position: null,
  custom_position: null,
  includes_hoist: false,
  table_data: { calculation, rows: [] },
  ...patch,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

describe("Hoja de Ruta power summary text", () => {
  it("reports calculation power, apparent power and the supply behind the current", () => {
    const text = formatPowerRequirementsText([row()]);

    expect(text).toContain("SOUND - MAIN L:");
    expect(text).toContain("Potencia total: 29.000 W");
    expect(text).toContain("Potencia de cálculo (20 %): 34.800 W");
    expect(text).toContain("Potencia aparente: 40,94 kVA");
    expect(text).toContain("Corriente de línea: 59,09 A (trifásico 400 V)");
    expect(text).toContain("PDU recomendado: CEE125A 3P+N+G");
  });

  it("leaves out the calculation power line when no margin was applied", () => {
    const text = formatPowerRequirementsText([
      row({ table_data: { calculation: { ...calculation, safetyMargin: 0, adjustedWatts: 29000 }, rows: [] } }),
    ]);

    expect(text).not.toContain("Potencia de cálculo");
    expect(text).toContain("Potencia total: 29.000 W");
  });

  it("names a single-phase supply on the line-to-neutral voltage", () => {
    const text = formatPowerRequirementsText([
      row({
        table_data: {
          calculation: {
            ...calculation,
            phaseMode: "single" as const,
            voltage: 230,
            currentLine: 178.0,
          },
          rows: [],
        },
      }),
    ]);

    expect(text).toContain("(monofásico 230 V)");
  });

  it("marks a pre-snapshot row as an estimate instead of inventing a calculation", () => {
    const text = formatPowerRequirementsText([row({ table_data: { rows: [] } })]);

    expect(text).toContain("Corriente de línea (guardada): 59,09 A");
    expect(text).toContain("Cálculo estimado: sin instantánea reproducible");
    expect(text).not.toContain("Potencia aparente");
  });

  it("carries the REBT discharge advisory into the route sheet", () => {
    const text = formatPowerRequirementsText([
      row({
        department: "lights",
        table_data: {
          calculation,
          rows: [
            { quantity: "10", componentId: "8", watts: "2000", totalWatts: 20000, pf: "0.90", fixtureType: "discharge" },
          ],
        },
      }),
    ]);

    expect(text).toContain("REBT ITC-BT-44 apdo. 3.1:");
    expect(text).toContain("lámparas de descarga");
  });

  it("states the motor sizing rule once, on the hoist line", () => {
    const text = formatPowerRequirementsText([row({ includes_hoist: true })]);

    expect(text).toContain("Suministro auxiliar de motores CEE32A 3P+N+G");
    expect(text).toContain("125 %");
    expect(text.match(/ITC-BT-47/g)).toHaveLength(1);
  });

  it("keeps the position line when one is set", () => {
    expect(formatPowerRequirementsText([row({ position: "FOH" })])).toContain("Posición: FOH");
  });
});
