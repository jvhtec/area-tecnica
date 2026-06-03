import { describe, expect, it } from "vitest";

import {
  buildPowerTableData,
  buildPowerTableMetadata,
  buildPowerRequirementInsert,
  buildTourPowerDefaultTable,
  getPowerReportUploadCategory,
} from "@/features/technical-tools/power/powerPersistence";

const table = {
  name: "Main",
  rows: [{ quantity: "2", componentId: "1", watts: "1000", totalWatts: 2000 }],
  totalWatts: 2000,
  currentPerPhase: 12.5,
  pduType: "CEE16A 3P+N+G",
  position: "FOH",
};

const settings = {
  phaseMode: "three" as const,
  powerFactor: 0.9,
  safetyMargin: 20,
  voltage: 400,
};

describe("technical power persistence payloads", () => {
  it("preserves legacy upload categories by department", () => {
    expect(getPowerReportUploadCategory("sound")).toBe("calculators/consumos");
    expect(getPowerReportUploadCategory("video")).toBe("calculators/consumos");
    expect(getPowerReportUploadCategory("lights")).toBe("calculators/lights-consumos");
  });

  it("builds normal job inserts with shared power metadata", () => {
    expect(buildPowerRequirementInsert({ department: "sound", jobId: "job-1", settings, table })).toMatchObject({
      current_per_phase: 12.5,
      department: "sound",
      job_id: "job-1",
      pdu_type: "CEE16A 3P+N+G",
      position: "FOH",
      table_name: "Main",
      total_watts: 2000,
    });
  });

  it("builds stage-aware job inserts for multi-stage jobs", () => {
    expect(
      buildPowerRequirementInsert({
        department: "sound",
        jobId: "job-1",
        settings,
        stage: { number: 2, name: "Club Stage" },
        table,
      })
    ).toMatchObject({
      stage_name: "Club Stage",
      stage_number: 2,
      table_data: {
        stageName: "Club Stage",
        stageNumber: 2,
      },
    });
  });

  it("builds tour default payloads with table data and metadata in one shape", () => {
    expect(buildTourPowerDefaultTable({ setId: "set-1", settings, table })).toMatchObject({
      set_id: "set-1",
      table_name: "Main",
      table_type: "power",
      total_value: 2000,
      metadata: {
        current_per_phase: 12.5,
        phaseMode: "three",
        safetyMargin: 20,
        voltage: 400,
      },
    });
  });

  it("omits power factor from lights-style payloads when none is supplied", () => {
    const lightsSettings = {
      phaseMode: "three" as const,
      safetyMargin: 25,
      voltage: 400,
    };

    expect(buildPowerTableData(table, lightsSettings)).not.toHaveProperty("pf");
    expect(buildPowerTableMetadata(table, lightsSettings)).not.toHaveProperty("pf");
  });
});
