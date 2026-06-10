import { describe, expect, it } from "vitest";
import { buildPowerRequirementInsert } from "@/features/technical-tools/power/powerPersistence";
import { mapPowerRequirementRowToTable } from "@/features/technical-tools/power/consumos/useJobPowerRequirementTables";
import type { PowerRequirementTableRow } from "@/features/technical-tools/power/consumos/useJobPowerRequirementTables";
import type { PowerTable } from "@/features/technical-tools/power/types";

const baseRow: PowerRequirementTableRow = {
  id: "req-1",
  job_id: "job-1",
  department: "sound",
  stage_number: 2,
  stage_name: "Stage 2",
  table_name: "FoH Rack",
  total_watts: 4000,
  current_per_phase: 7.6,
  pdu_type: "CEE32A 3P+N+G",
  custom_pdu_type: null,
  position: "FoH",
  custom_position: null,
  includes_hoist: false,
  table_data: {
    rows: [{ quantity: "2", componentId: "1", watts: "2000", componentName: "LA12X", totalWatts: 4000 }],
    safetyMargin: 20,
    phaseMode: "three",
    voltage: 400,
    pf: 0.95,
    generationTimestamp: "2026-06-01T10:00:00.000Z",
  },
  created_at: "2026-06-01T10:00:01.000Z",
};

describe("mapPowerRequirementRowToTable", () => {
  it("restores rows, identity and settings snapshot from a saved row", () => {
    const table = mapPowerRequirementRowToTable(baseRow, {
      fallbackSafetyMargin: 20,
      perRowPf: false,
    });

    expect(table.id).toBe("req-1");
    expect(table.powerRequirementId).toBe("req-1");
    expect(table.name).toBe("FoH Rack");
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].componentName).toBe("LA12X");
    expect(table.stageNumber).toBe(2);
    expect(table.stageName).toBe("Stage 2");
    expect(table.generationTimestamp).toBe("2026-06-01T10:00:00.000Z");
    expect(table.snapshotSafetyMargin).toBe(20);
    expect(table.snapshotPhaseMode).toBe("three");
    expect(table.snapshotVoltage).toBe(400);
    expect(table.snapshotPowerFactor).toBe(0.95);
    // adjusted = 4000 * 1.2; VA = adjusted / 0.95
    expect(table.adjustedWatts).toBeCloseTo(4800);
    expect(table.totalVa).toBeCloseTo(4800 / 0.95);
  });

  it("recomputes apparent power from per-row PF when no global PF was stored", () => {
    const lightsRow: PowerRequirementTableRow = {
      ...baseRow,
      department: "lights",
      table_data: {
        rows: [
          { quantity: "2", componentId: "6", watts: "260", pf: "0.90", totalWatts: 520 },
          { quantity: "1", componentId: "23", watts: "1000", pf: "1.00", totalWatts: 1000 },
        ],
        safetyMargin: 0,
        phaseMode: "three",
        voltage: 400,
      },
      total_watts: 1520,
    };

    const table = mapPowerRequirementRowToTable(lightsRow, {
      fallbackSafetyMargin: 0,
      perRowPf: true,
    });

    expect(table.snapshotPowerFactor).toBeUndefined();
    expect(table.totalWatts).toBe(1520);
    // Mixed-load VA must exceed real power because one row has PF < 1
    expect(table.totalVa!).toBeGreaterThan(1520);
    expect(table.totalVa!).toBeLessThan(1520 / 0.9 + 1);
  });

  it("round-trips through buildPowerRequirementInsert without losing settings", () => {
    const table = mapPowerRequirementRowToTable(baseRow, {
      fallbackSafetyMargin: 20,
      perRowPf: false,
    });

    const insert = buildPowerRequirementInsert({
      department: "sound",
      jobId: "job-1",
      settings: {
        safetyMargin: table.snapshotSafetyMargin!,
        phaseMode: table.snapshotPhaseMode!,
        voltage: table.snapshotVoltage!,
        powerFactor: table.snapshotPowerFactor,
      },
      table: table as PowerTable,
    });

    expect(insert.table_name).toBe("FoH Rack");
    expect(insert.total_watts).toBe(4000);
    expect(insert.stage_number).toBe(2);
    const data = insert.table_data as Record<string, unknown>;
    expect(data.safetyMargin).toBe(20);
    expect(data.phaseMode).toBe("three");
    expect(data.voltage).toBe(400);
    expect(data.pf).toBe(0.95);
    expect(data.rows).toEqual(baseRow.table_data.rows);
  });

  it("falls back to defaults when table_data has no settings snapshot", () => {
    const legacyRow: PowerRequirementTableRow = {
      ...baseRow,
      table_data: { rows: [] },
    };

    const table = mapPowerRequirementRowToTable(legacyRow, {
      fallbackSafetyMargin: 20,
      perRowPf: false,
    });

    expect(table.snapshotSafetyMargin).toBe(20);
    expect(table.snapshotPhaseMode).toBe("three");
    expect(table.snapshotVoltage).toBe(400);
    expect(table.generationTimestamp).toBe(legacyRow.created_at);
    // no PF stored → VA falls back to adjusted watts
    expect(table.totalVa).toBeCloseTo(4800);
  });
});
