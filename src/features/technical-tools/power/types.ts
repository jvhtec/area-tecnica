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
  /**
   * Nominal supply voltage, in volts. Line-to-neutral when `phaseMode` is
   * `"single"` (230 V in Spain) and **line-to-line** when it is `"three"`
   * (400 V). The three-phase line current is therefore
   * `I = S / (sqrt(3) * V_LL)` — never `S / 3 / V_LL`, and never V_LL paired
   * with a per-phase power.
   */
  voltage: number;
  /** 0 < PF <= 1. Omitted when the table resolves a power factor per row. */
  powerFactor?: number;
};
