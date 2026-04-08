export interface TableRow {
  quantity: string;
  componentId: string;
  watts: string;
  componentName?: string;
  lineName?: string;
  totalWatts?: number;
}

export interface Table {
  name: string;
  rows: TableRow[];
  totalWatts?: number;
  adjustedWatts?: number;
  totalVa?: number; // apparent power (VA) — used for kVA display and generator sizing
  currentPerPhase?: number; // kept for compatibility; holds line current (per-phase if 3φ, single-line if 1φ)
  pduType?: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  id?: number | string;
  includesHoist?: boolean;
  isDefault?: boolean;
  isOverride?: boolean;
  overrideId?: string;
  defaultTableId?: string;
}
