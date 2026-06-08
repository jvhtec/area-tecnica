import { describe, expect, it } from "vitest";

import {
  buildPowerTableData,
  buildPowerTableMetadata,
  buildPowerRequirementInsert,
  buildTourPowerDefaultTable,
  getPowerReportUploadCategory,
  saveJobPowerRequirementTable,
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

const createPowerRequirementTableClient = () => {
  const operations: Array<{ method: string; args: unknown[] }> = [];

  const createBuilder = () => {
    const builder: any = {
      delete: vi.fn(() => {
        operations.push({ method: "delete", args: [] });
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        operations.push({ method: "eq", args: [column, value] });
        return builder;
      }),
      insert: vi.fn((payload: unknown) => {
        operations.push({ method: "insert", args: [payload] });
        return builder;
      }),
      is: vi.fn((column: string, value: unknown) => {
        operations.push({ method: "is", args: [column, value] });
        return builder;
      }),
      neq: vi.fn((column: string, value: unknown) => {
        operations.push({ method: "neq", args: [column, value] });
        return builder;
      }),
      select: vi.fn((columns?: string) => {
        operations.push({ method: "select", args: [columns] });
        return builder;
      }),
      single: vi.fn(async () => ({ data: { id: "new-power-requirement-id" }, error: null })),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject),
    };

    return builder;
  };

  return {
    client: {
      from: vi.fn((tableName: string) => {
        operations.push({ method: "from", args: [tableName] });
        return createBuilder();
      }),
    } as any,
    operations,
  };
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

  it("removes older same-scope generations after inserting a fresh job table", async () => {
    const { client, operations } = createPowerRequirementTableClient();

    await expect(
      saveJobPowerRequirementTable({
        client,
        department: "sound",
        jobId: "job-1",
        settings,
        table,
      })
    ).resolves.toBe("new-power-requirement-id");

    expect(operations).toEqual(
      expect.arrayContaining([
        { method: "delete", args: [] },
        { method: "eq", args: ["job_id", "job-1"] },
        { method: "eq", args: ["department", "sound"] },
        { method: "neq", args: ["id", "new-power-requirement-id"] },
        { method: "is", args: ["stage_number", null] },
      ])
    );
    expect(operations).not.toEqual(
      expect.arrayContaining([{ method: "eq", args: ["table_name", "Main"] }])
    );
  });

  it("limits fresh-generation cleanup to the selected stage", async () => {
    const { client, operations } = createPowerRequirementTableClient();

    await saveJobPowerRequirementTable({
      client,
      department: "sound",
      jobId: "job-1",
      settings,
      stage: { number: 2, name: "Club Stage" },
      table,
    });

    const deleteIndex = operations.findIndex((operation) => operation.method === "delete");
    const cleanupOperations = operations.slice(deleteIndex);

    expect(cleanupOperations).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["job_id", "job-1"] },
        { method: "eq", args: ["department", "sound"] },
        { method: "eq", args: ["stage_number", 2] },
        { method: "neq", args: ["id", "new-power-requirement-id"] },
      ])
    );
    expect(cleanupOperations).not.toEqual(
      expect.arrayContaining([{ method: "is", args: ["stage_number", null] }])
    );
  });
});
