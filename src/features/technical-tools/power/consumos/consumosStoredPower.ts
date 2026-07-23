import type {
  StoredPowerSnapshot,
} from "@/features/technical-tools/power/powerTableHydration";
import type {
  PowerTableRow,
} from "@/features/technical-tools/power/types";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getStringField = (
  value: unknown,
  key: string,
): string | undefined => {
  if (!isRecord(value)) return undefined;
  return typeof value[key] === "string" ? value[key] : undefined;
};

export const getBooleanField = (value: unknown, key: string): boolean => {
  if (!isRecord(value)) return false;
  return value[key] === true;
};

const isPowerTableRow = (value: unknown): value is PowerTableRow =>
  isRecord(value) &&
  typeof value.componentId === "string" &&
  typeof value.quantity === "string" &&
  typeof value.watts === "string";

export const getPowerTableRows = (value: unknown): PowerTableRow[] => {
  if (!isRecord(value) || !Array.isArray(value.rows)) return [];
  return value.rows.filter(isPowerTableRow);
};

export const toStoredPowerFields = (
  value: unknown,
): StoredPowerSnapshot & { rows?: PowerTableRow[] } => {
  if (!isRecord(value)) return {};
  return {
    calculation: value.calculation,
    pf: typeof value.pf === "number" ? value.pf : undefined,
    safetyMargin:
      typeof value.safetyMargin === "number" ? value.safetyMargin : undefined,
    phaseMode:
      value.phaseMode === "single" || value.phaseMode === "three"
        ? value.phaseMode
        : undefined,
    voltage: typeof value.voltage === "number" ? value.voltage : undefined,
    rows: getPowerTableRows(value),
  };
};
