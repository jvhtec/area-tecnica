import { describe, expect, it } from "vitest";

import {
  buildPowerAuxSupplyNote,
  buildPowerOverviewRows,
  buildPowerReportSummary,
  FOH_PDU_LABEL,
  formatTechnicalReportDate,
  formatTechnicalReportNumber,
  HOIST_PDU_LABEL,
} from "@/utils/pdf/technicalDataReportModel";
import { buildPowerCalculationSnapshot } from "@/features/technical-tools/power/powerCalculations";

describe("technicalDataReportModel", () => {
  it("formats report numbers and dates in Spanish", () => {
    expect(formatTechnicalReportNumber(42100, 0)).toBe("42.100");
    expect(formatTechnicalReportNumber(49.53, 2)).toBe("49,53");
    expect(formatTechnicalReportDate("2026-07-10")).toBe("10 julio 2026");
    expect(formatTechnicalReportDate("24/07/2026")).toBe("24 julio 2026");
    expect(formatTechnicalReportDate("31/02/2026")).toBe("No disponible");
    expect(formatTechnicalReportDate("not-a-date")).toBe("No disponible");
  });

  it("does not invent a global current for multiple single-phase circuits", () => {
    const calculation = buildPowerCalculationSnapshot({
      powerFactorSource: "global",
      settings: {
        phaseMode: "single",
        powerFactor: 0.95,
        safetyMargin: 20,
        voltage: 230,
      },
      totalWatts: 1000,
    });
    const summary = buildPowerReportSummary([
      { calculation, name: "A", rows: [] },
      { calculation, name: "B", rows: [] },
    ]);

    expect(summary.currentLine).toBeNull();
    expect(summary.aggregationReason).toContain("asignación de fase");
    expect(summary.totalWatts).toBe(2000);
  });

  it("lists the auxiliary motor supply in the circuit summary rows", () => {
    const calculation = buildPowerCalculationSnapshot({
      powerFactorSource: "global",
      settings: {
        phaseMode: "three",
        powerFactor: 0.95,
        safetyMargin: 20,
        voltage: 400,
      },
      totalWatts: 5000,
    });
    const summary = buildPowerReportSummary([
      {
        calculation,
        includesHoist: true,
        name: "PA izquierda",
        position: "DSL",
        pduType: "CEE63A 3P+N+G",
        rows: [],
      },
      {
        calculation,
        name: "Monitores",
        position: "DSC",
        pduType: "CEE32A 3P+N+G",
        rows: [],
      },
    ]);

    expect(summary.circuits.map((circuit) => circuit.includesHoist)).toEqual([
      true,
      false,
    ]);

    const rows = buildPowerOverviewRows(summary.circuits);
    expect(rows.map((row) => row.kind)).toEqual([
      "circuit",
      "hoist",
      "circuit",
    ]);

    const hoistRow = rows[1];
    expect(hoistRow.cells[0]).toContain("Toma de motores");
    expect(hoistRow.cells[0]).toContain("PA izquierda");
    expect(hoistRow.cells[1]).toBe(HOIST_PDU_LABEL);
    expect(hoistRow.cells[2]).toBe(rows[0].cells[2]);
    expect(hoistRow.cells.slice(3)).toEqual(["Excluida", "Excluida"]);
    expect(buildPowerAuxSupplyNote(rows)).toContain("motores");
    expect(buildPowerAuxSupplyNote(rows)).not.toContain("FOH");
  });

  it("lists the auxiliary FOH supply once when the job requires it", () => {
    const circuits = buildPowerReportSummary([
      { name: "Monitores", position: "DSC", pduType: "CEE32A 3P+N+G", rows: [] },
    ]).circuits;

    expect(buildPowerOverviewRows(circuits).map((row) => row.kind)).toEqual([
      "circuit",
    ]);

    const rows = buildPowerOverviewRows(circuits, { fohSchukoRequired: true });
    expect(rows.map((row) => row.kind)).toEqual(["circuit", "foh"]);
    expect(rows[1].cells).toEqual([
      "Toma auxiliar de FOH",
      FOH_PDU_LABEL,
      "FOH",
      "Excluida",
      "Excluida",
    ]);

    const note = buildPowerAuxSupplyNote(rows);
    expect(note).toContain("FOH");
    expect(note).not.toContain("motores");
    expect(buildPowerAuxSupplyNote([{ cells: [], kind: "circuit" }])).toBeNull();
  });
});
