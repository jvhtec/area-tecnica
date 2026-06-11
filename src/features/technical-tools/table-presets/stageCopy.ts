import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";

/**
 * Minimal shape shared by the Consumos (power) and Pesos (weight) table
 * models: a named table with rows, optional stage placement and optional
 * persistence/source markers that must NOT travel with a copy.
 */
export type StageCopyableTable = {
  id?: number | string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows differ per tool (power vs weight)
  rows: any[];
  stageNumber?: number | null;
  stageName?: string | null;
  // persistence / source markers cleared on copy
  powerRequirementId?: string;
  weightRequirementId?: string;
  generationTimestamp?: string;
  isDefault?: boolean;
  defaultTableId?: string;
  isOverride?: boolean;
  overrideId?: string;
};

let cloneCounter = 0;

/** Locally-unique numeric id for cloned tables (Date.now alone collides in loops). */
export const nextCloneId = () => {
  cloneCounter = (cloneCounter + 1) % 1000;
  return Date.now() * 1000 + cloneCounter;
};

/**
 * Deep-clones a table onto a stage (or onto "no stage" with null), stripping
 * every persistence marker so the copy behaves like a freshly generated
 * table: it is saved as part of the target stage's set on the next export.
 */
export const cloneTableToStage = <T extends StageCopyableTable>(
  table: T,
  stage: TechnicalStage | null,
  id: number | string = nextCloneId(),
): T => ({
  ...table,
  id,
  rows: table.rows.map((row) => ({ ...row })),
  stageNumber: stage?.number ?? null,
  stageName: stage?.name ?? null,
  powerRequirementId: undefined,
  weightRequirementId: undefined,
  generationTimestamp: undefined,
  isDefault: undefined,
  defaultTableId: undefined,
  isOverride: undefined,
  overrideId: undefined,
});

export const cloneTablesToStage = <T extends StageCopyableTable>(
  tables: T[],
  stage: TechnicalStage | null,
): T[] => tables.map((table) => cloneTableToStage(table, stage));

/**
 * Strips a table down to a preset snapshot: everything needed to restore it
 * later, minus ids, stage placement and persistence markers.
 */
export const toPresetSnapshot = <T extends StageCopyableTable>(table: T): T => {
  const snapshot = cloneTableToStage(table, null);
  delete (snapshot as StageCopyableTable).id;
  return snapshot;
};

const createGroupId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `group_${Date.now()}_${Math.random().toString(16).slice(2)}`;

/**
 * Gives copied tables fresh cluster ids while preserving the grouping among
 * them (Pesos uses clusterId to pair mirrored tables and attach cable picks;
 * copies must not share groups with their source or with earlier copies).
 */
export const remapClusterIds = <T extends { clusterId?: string }>(tables: T[]): T[] => {
  const idMap = new Map<string, string>();
  return tables.map((table) => {
    if (!table.clusterId) return table;
    if (!idMap.has(table.clusterId)) idMap.set(table.clusterId, createGroupId());
    return { ...table, clusterId: idMap.get(table.clusterId) };
  });
};
