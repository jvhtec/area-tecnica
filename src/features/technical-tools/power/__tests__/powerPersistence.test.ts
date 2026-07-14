import { describe, expect, it, vi } from "vitest";

import {
  buildPowerTableData,
  buildPowerTableMetadata,
  buildPowerRequirementInsert,
  buildTourPowerDefaultTable,
  getPowerReportUploadCategory,
  saveJobPowerRequirementTable,
  saveJobPowerRequirementTablesGeneration,
} from "@/features/technical-tools/power/powerPersistence";
import type { PowerTable } from "@/features/technical-tools/power/types";

const table: PowerTable = {
  name: "Main",
  rows: [{ quantity: "2", componentId: "1", watts: "1000", totalWatts: 2000 }],
  totalWatts: 2000,
  currentPerPhase: 3.849,
  adjustedWatts: 2400,
  totalVa: 2666.6667,
  calculation: {
    version: 2,
    totalWatts: 2000,
    adjustedWatts: 2400,
    totalVa: 2666.6667,
    currentLine: 3.849,
    safetyMargin: 20,
    phaseMode: "three",
    voltage: 400,
    powerFactor: 0.9,
    powerFactorSource: "global",
    isEstimate: false,
  },
  pduType: "CEE16A 3P+N+G",
  position: "FOH",
};

const settings = {
  phaseMode: "three" as const,
  powerFactor: 0.9,
  safetyMargin: 20,
  voltage: 400,
};

const successfulResponse = <T>(data: T): { data: T; error: null } => ({ data, error: null });

const createPowerRequirementTableClient = () => {
  const operations: Array<{ method: string; args: unknown[] }> = [];

  const createBuilder = () => {
    let insertedPayload: unknown;

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
        insertedPayload = payload;
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
      not: vi.fn((column: string, operator: string, value: unknown) => {
        operations.push({ method: "not", args: [column, operator, value] });
        return builder;
      }),
      select: vi.fn((columns?: string) => {
        operations.push({ method: "select", args: [columns] });
        return builder;
      }),
      single: vi.fn(async () => successfulResponse({ id: "new-power-requirement-id" })),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        const insertedRows = Array.isArray(insertedPayload)
          ? insertedPayload.map((payload: any, index) => ({
              id: `new-power-requirement-id-${index + 1}`,
              stage_number: payload.stage_number ?? null,
            }))
          : null;

        return Promise.resolve(successfulResponse(insertedRows)).then(resolve, reject);
      },
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
      current_per_phase: 3.849,
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
        calculation: expect.objectContaining({ version: 2 }),
        current_per_phase: 3.849,
        phaseMode: "three",
        safetyMargin: 20,
        voltage: 400,
      },
      table_data: expect.objectContaining({
        calculation: expect.objectContaining({ version: 2 }),
      }),
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

  it("does not remove sibling sets after inserting a single job table", async () => {
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

    expect(operations).not.toEqual(expect.arrayContaining([{ method: "delete", args: [] }]));
  });

  it("replaces older same-scope generations after saving a timestamped table batch", async () => {
    const { client, operations } = createPowerRequirementTableClient();
    const generationTimestamp = "2026-04-07T09:00:00.000Z";

    await expect(
      saveJobPowerRequirementTablesGeneration({
        client,
        department: "sound",
        generationTimestamp,
        jobId: "job-1",
        settings,
        tables: [
          { ...table, id: "main", name: "Main" },
          { ...table, id: "delay", name: "Delay" },
        ],
      })
    ).resolves.toEqual([
      {
        generationTimestamp,
        powerRequirementId: "new-power-requirement-id-1",
        tableId: "main",
      },
      {
        generationTimestamp,
        powerRequirementId: "new-power-requirement-id-2",
        tableId: "delay",
      },
    ]);

    expect(operations).toEqual(
      expect.arrayContaining([
        { method: "delete", args: [] },
        { method: "eq", args: ["job_id", "job-1"] },
        { method: "eq", args: ["department", "sound"] },
        {
          method: "not",
          args: [
            "id",
            "in",
            '("new-power-requirement-id-1","new-power-requirement-id-2")',
          ],
        },
        { method: "is", args: ["stage_number", null] },
      ])
    );

    const insertOperation = operations.find((operation) => operation.method === "insert");
    expect(insertOperation?.args[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          created_at: generationTimestamp,
          table_data: expect.objectContaining({ generationTimestamp }),
          table_name: "Main",
        }),
        expect.objectContaining({
          created_at: generationTimestamp,
          table_data: expect.objectContaining({ generationTimestamp }),
          table_name: "Delay",
        }),
      ])
    );
  });

  it("limits timestamped generation cleanup to each selected stage", async () => {
    const { client, operations } = createPowerRequirementTableClient();

    await saveJobPowerRequirementTablesGeneration({
      client,
      department: "sound",
      jobId: "job-1",
      settings,
      stage: { number: 2, name: "Club Stage" },
      tables: [table],
    });

    const deleteIndex = operations.findIndex((operation) => operation.method === "delete");
    const cleanupOperations = operations.slice(deleteIndex);

    expect(cleanupOperations).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["job_id", "job-1"] },
        { method: "eq", args: ["department", "sound"] },
        { method: "eq", args: ["stage_number", 2] },
        { method: "not", args: ["id", "in", '("new-power-requirement-id-1")'] },
      ])
    );
    expect(cleanupOperations).not.toEqual(
      expect.arrayContaining([{ method: "is", args: ["stage_number", null] }])
    );
  });

  it("clears a scoped generation when the exported table batch is empty", async () => {
    const { client, operations } = createPowerRequirementTableClient();

    await expect(
      saveJobPowerRequirementTablesGeneration({
        client,
        department: "lights",
        jobId: "job-1",
        settings,
        stage: { number: 1, name: "Main Stage" },
        tables: [],
      })
    ).resolves.toEqual([]);

    expect(operations).toEqual(
      expect.arrayContaining([
        { method: "delete", args: [] },
        { method: "eq", args: ["job_id", "job-1"] },
        { method: "eq", args: ["department", "lights"] },
        { method: "eq", args: ["stage_number", 1] },
      ])
    );
    expect(operations).not.toEqual(expect.arrayContaining([{ method: "insert", args: [expect.anything()] }]));
    expect(operations).not.toEqual(expect.arrayContaining([{ method: "not", args: expect.any(Array) }]));
  });

  it("clears the department generation when an empty export has no selected stage", async () => {
    const { client, operations } = createPowerRequirementTableClient();

    await saveJobPowerRequirementTablesGeneration({
      client,
      department: "video",
      jobId: "job-1",
      settings,
      tables: [],
    });

    expect(operations).toEqual(
      expect.arrayContaining([
        { method: "delete", args: [] },
        { method: "eq", args: ["job_id", "job-1"] },
        { method: "eq", args: ["department", "video"] },
      ])
    );
    expect(operations).not.toEqual(expect.arrayContaining([{ method: "eq", args: ["stage_number", expect.anything()] }]));
    expect(operations).not.toEqual(expect.arrayContaining([{ method: "is", args: ["stage_number", null] }]));
  });
});
