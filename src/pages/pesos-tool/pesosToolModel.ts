import { formatRiggingPoint } from "@/features/technical-tools/weights/weightCalculations";

export interface TableRow {
  id: string;
  quantity: string;
  componentId: string;
  weight: string;
  componentName?: string;
  totalWeight?: number;
}

export interface Table {
  name: string;
  rows: TableRow[];
  totalWeight?: number;
  id?: number;
  stageNumber?: number | null;
  stageName?: string | null;
  dualMotors?: boolean;
  riggingPoints?: string;
  clusterId?: string;
  cablePick?: boolean;
  cablePickWeight?: string;
  defaultTableId?: string;
  overrideId?: string;
  isOverride?: boolean;
  baseName?: string;
}

export interface SummaryRow {
  clusterName: string;
  riggingPoints: string;
  clusterWeight: number;
}

export const createRowId = () =>
  globalThis.crypto?.randomUUID?.() ?? `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export const createEmptyRow = (): TableRow => ({ id: createRowId(), quantity: "", componentId: "", weight: "" });

export const deriveBaseName = (name: string): string => {
  const match = name.match(/^(.*?)(?:\s*\(.*\))?$/);
  return match ? match[1].trim() : name;
};

export const getRiggingPointNumbers = (riggingPoints?: string): number[] =>
  Array.from(riggingPoints?.matchAll(/SX0*(\d+)/gi) ?? [])
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value) && value > 0);

export const assignSuffixes = (tables: Table[]): Table[] => {
  const countersByStage = new Map<string, number>();
  return tables.map((table) => {
    const baseName = table.baseName || deriveBaseName(table.name);
    const stageKey = table.stageNumber != null ? `stage-${table.stageNumber}` : "default";
    const counter = countersByStage.get(stageKey) || 1;
    const persistedNumbers = getRiggingPointNumbers(table.riggingPoints);
    if (Boolean(table.defaultTableId || table.overrideId) && persistedNumbers.length > 0) {
      countersByStage.set(stageKey, Math.max(counter, Math.max(...persistedNumbers) + 1));
      return { ...table, baseName, name: `${baseName} (${table.riggingPoints})` };
    }
    if (table.dualMotors) {
      const riggingPoints = `${formatRiggingPoint("SX", counter)}, ${formatRiggingPoint("SX", counter + 1)}`;
      countersByStage.set(stageKey, counter + 2);
      return { ...table, baseName, name: `${baseName} (${riggingPoints})`, riggingPoints };
    }
    const riggingPoints = formatRiggingPoint("SX", counter);
    countersByStage.set(stageKey, counter + 1);
    return { ...table, baseName, name: `${baseName} (${riggingPoints})`, riggingPoints };
  });
};
