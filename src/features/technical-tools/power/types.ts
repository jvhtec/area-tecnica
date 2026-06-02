export type TechnicalDepartment = "sound" | "lights" | "video";

export type PhaseMode = "single" | "three";

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
  name: string;
  rows: PowerTableRow[];
  totalWatts?: number;
  adjustedWatts?: number;
  totalVa?: number;
  currentPerPhase?: number;
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
