import { getVoltageForPhase } from "@/features/technical-tools/power/powerCalculations";
import {
  buildLegacyPowerCalculationSnapshot,
  parsePowerCalculationSnapshot,
} from "@/features/technical-tools/power/powerSnapshots";
import type {
  PhaseMode,
  PowerTable,
  PowerTableRow,
} from "@/features/technical-tools/power/types";

export type StoredPowerSnapshot = {
  calculation?: unknown;
  pf?: number;
  safetyMargin?: number;
  phaseMode?: PhaseMode;
  voltage?: number;
};

type PersistedPowerFields = StoredPowerSnapshot & {
  rows?: PowerTableRow[];
};

export type ReadOnlyPowerDefault = {
  id: string;
  table_type: string;
  table_name: string;
  total_value?: number;
  table_data?: PersistedPowerFields;
  metadata?: PersistedPowerFields & {
    current_per_phase?: number;
    pdu_type?: string;
    custom_pdu_type?: string;
    position?: string;
    custom_position?: string;
    includes_hoist?: boolean;
  };
};

export const mergeStoredPowerSnapshot = (
  metadata?: PersistedPowerFields,
  data?: PersistedPowerFields,
): StoredPowerSnapshot => ({
  calculation: metadata?.calculation ?? data?.calculation,
  pf: metadata?.pf ?? data?.pf,
  safetyMargin: metadata?.safetyMargin ?? data?.safetyMargin,
  phaseMode: metadata?.phaseMode ?? data?.phaseMode,
  voltage: metadata?.voltage ?? data?.voltage,
});

type HydrationDefaults = {
  fallbackPowerFactor: number;
  fallbackSafetyMargin: number;
  phaseMode: PhaseMode;
  powerFactor?: number;
  perRowPowerFactor: boolean;
};

type HydratedPowerTableInput = {
  id: PowerTable["id"];
  name: string;
  rows: PowerTableRow[];
  totalWatts: number;
  snapshot: StoredPowerSnapshot;
  defaults: HydrationDefaults;
  pduType: string;
  customPduType?: string;
  patch?: Partial<PowerTable>;
};

/** Rebuilds display fields from a validated snapshot or a marked legacy estimate. */
export const hydratePowerTable = ({
  id,
  name,
  rows,
  totalWatts,
  snapshot,
  defaults,
  pduType,
  customPduType,
  patch = {},
}: HydratedPowerTableInput): PowerTable => {
  const storedCalculation = parsePowerCalculationSnapshot(snapshot.calculation);
  const storedPhaseMode = snapshot.phaseMode ?? defaults.phaseMode;
  const calculation =
    storedCalculation ??
    buildLegacyPowerCalculationSnapshot({
      fallbackPowerFactor: defaults.fallbackPowerFactor,
      perRowPowerFactor: defaults.perRowPowerFactor && rows.length > 0,
      rows,
      settings: {
        safetyMargin: snapshot.safetyMargin ?? defaults.fallbackSafetyMargin,
        phaseMode: storedPhaseMode,
        voltage: snapshot.voltage ?? getVoltageForPhase(storedPhaseMode),
        powerFactor:
          snapshot.pf ??
          (defaults.perRowPowerFactor ? undefined : defaults.powerFactor),
      },
      totalWatts,
    });
  return {
    id,
    name,
    rows,
    totalWatts: calculation.totalWatts,
    adjustedWatts: calculation.adjustedWatts,
    totalVa: calculation.totalVa,
    currentPerPhase: calculation.currentLine,
    calculation,
    pduType,
    customPduType,
    ...patch,
  };
};
