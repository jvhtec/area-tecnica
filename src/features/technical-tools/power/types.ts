export type TechnicalDepartment = "sound" | "lights" | "video";

export type PhaseMode = "single" | "three";

export const POWER_CALCULATION_VERSION = 2 as const;

export type PowerFactorSource =
  | "global"
  | "per-row"
  | "legacy-default";

/**
 * Reproducible result of one calculator run. Apparent power is stored after
 * the planning margin; reactive power is derived from P and S when needed.
 */
export type PowerCalculationSnapshot = {
  version: typeof POWER_CALCULATION_VERSION;
  totalWatts: number;
  adjustedWatts: number;
  totalVa: number;
  currentLine: number;
  safetyMargin: number;
  phaseMode: PhaseMode;
  voltage: number;
  powerFactor?: number;
  powerFactorSource: PowerFactorSource;
  isEstimate: boolean;
};

export type PowerComponent = {
  id: number | string;
  name: string;
  watts: number;
};

export type PowerTableRow = {
  quantity: string;
  componentId: string;
  watts: string;
  componentName?: string;
  lineName?: string;
  totalWatts?: number;
  pf?: string;
  fixtureType?: string;
};

export type PowerTable = {
  id?: number | string;
  powerRequirementId?: string;
  generationTimestamp?: string;
  stageNumber?: number | null;
  stageName?: string | null;
  name: string;
  rows: PowerTableRow[];
  totalWatts?: number;
  adjustedWatts?: number;
  totalVa?: number;
  currentPerPhase?: number;
  calculation?: PowerCalculationSnapshot;
  pduType?: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  includesHoist?: boolean;
  isDefault?: boolean;
  isOverride?: boolean;
  overrideId?: string;
  defaultTableId?: string;
};

export type PowerElectricalSettings = {
  safetyMargin: number;
  phaseMode: PhaseMode;
  voltage: number;
  powerFactor?: number;
};
