import { describe, expect, it } from "vitest";
import {
  cloneTableToStage,
  cloneTablesToStage,
  remapClusterIds,
  toPresetSnapshot,
} from "@/features/technical-tools/table-presets/stageCopy";

const stage = { number: 2, name: "Stage 2" };

const sourceTable = {
  id: 10,
  name: "FoH Rack",
  rows: [{ quantity: "2", componentId: "1", watts: "2000" }],
  stageNumber: 1,
  stageName: "Stage 1",
  powerRequirementId: "req-1",
  generationTimestamp: "2026-06-01T10:00:00.000Z",
  isDefault: true,
  defaultTableId: "def-1",
  isOverride: true,
  overrideId: "ovr-1",
};

describe("cloneTableToStage", () => {
  it("retargets the stage and strips every persistence marker", () => {
    const clone = cloneTableToStage(sourceTable, stage, 99);

    expect(clone.id).toBe(99);
    expect(clone.stageNumber).toBe(2);
    expect(clone.stageName).toBe("Stage 2");
    expect(clone.powerRequirementId).toBeUndefined();
    expect(clone.generationTimestamp).toBeUndefined();
    expect(clone.isDefault).toBeUndefined();
    expect(clone.defaultTableId).toBeUndefined();
    expect(clone.isOverride).toBeUndefined();
    expect(clone.overrideId).toBeUndefined();
    // rows are deep-copied, not shared
    expect(clone.rows[0]).not.toBe(sourceTable.rows[0]);
    expect(clone.rows[0]).toEqual(sourceTable.rows[0]);
    // the source is untouched
    expect(sourceTable.powerRequirementId).toBe("req-1");
  });

  it("clears the stage when copying to 'no stage'", () => {
    const clone = cloneTableToStage(sourceTable, null);
    expect(clone.stageNumber).toBeNull();
    expect(clone.stageName).toBeNull();
  });
});

describe("cloneTablesToStage", () => {
  it("assigns unique ids to every clone", () => {
    const clones = cloneTablesToStage([sourceTable, sourceTable, sourceTable], stage);
    const ids = new Set(clones.map((clone) => clone.id));
    expect(ids.size).toBe(3);
  });
});

describe("toPresetSnapshot", () => {
  it("drops the id and stage placement", () => {
    const snapshot = toPresetSnapshot(sourceTable);
    expect(snapshot.id).toBeUndefined();
    expect(snapshot.stageNumber).toBeNull();
    expect(snapshot.name).toBe("FoH Rack");
    expect(snapshot.rows).toHaveLength(1);
  });
});

describe("remapClusterIds", () => {
  it("regenerates cluster ids while preserving grouping", () => {
    const tables: Array<{ name: string; rows: unknown[]; clusterId?: string }> = [
      { name: "A", rows: [], clusterId: "c1" },
      { name: "B", rows: [], clusterId: "c1" },
      { name: "C", rows: [], clusterId: "c2" },
      { name: "D", rows: [] as unknown[] },
    ];

    const remapped = remapClusterIds(tables);

    expect(remapped[0].clusterId).toBeDefined();
    expect(remapped[0].clusterId).not.toBe("c1");
    // mirrored pair keeps sharing a cluster id
    expect(remapped[0].clusterId).toBe(remapped[1].clusterId);
    expect(remapped[2].clusterId).not.toBe(remapped[0].clusterId);
    expect(remapped[3].clusterId).toBeUndefined();
  });
});
