import {
  buildPowerCalculationSnapshot,
  calculatePowerRows,
  calculateMixedLoadApparentPower,
  getVoltageForPhase,
  sumPowerRows,
} from "@/features/technical-tools/power/powerCalculations";
import {
  POWER_CALCULATION_VERSION,
  type PowerCalculationSnapshot,
  type PowerElectricalSettings,
  type PowerTableRow,
} from "@/features/technical-tools/power/types";

const isFiniteNonNegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const close = (left: number, right: number) =>
  Math.abs(left - right) <= Math.max(0.01, Math.abs(right) * 0.001);

export const parsePowerCalculationSnapshot = (
  value: unknown,
): PowerCalculationSnapshot | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.version !== POWER_CALCULATION_VERSION ||
    ![
      snapshot.totalWatts,
      snapshot.adjustedWatts,
      snapshot.totalVa,
      snapshot.currentLine,
      snapshot.safetyMargin,
      snapshot.voltage,
    ].every(isFiniteNonNegative) ||
    Number(snapshot.voltage) <= 0 ||
    Number(snapshot.safetyMargin) > 100 ||
    (snapshot.phaseMode !== "single" && snapshot.phaseMode !== "three") ||
    !["global", "per-row", "legacy-default"].includes(String(snapshot.powerFactorSource)) ||
    typeof snapshot.isEstimate !== "boolean"
  ) {
    return undefined;
  }
  const powerFactor = snapshot.powerFactor;
  if (powerFactor !== undefined &&
    (typeof powerFactor !== "number" || !Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1)) {
    return undefined;
  }

  const result = snapshot as unknown as PowerCalculationSnapshot;
  const expectedAdjustedWatts = result.totalWatts * (1 + result.safetyMargin / 100);
  const expectedCurrent = result.totalVa /
    ((result.phaseMode === "single" ? 1 : Math.sqrt(3)) * result.voltage);
  if (
    !close(result.adjustedWatts, expectedAdjustedWatts) ||
    result.totalVa + 0.01 < result.adjustedWatts ||
    !close(result.currentLine, expectedCurrent) ||
    (result.powerFactorSource === "global" &&
      (typeof powerFactor !== "number" || !close(result.totalVa, result.adjustedWatts / powerFactor)))
  ) {
    return undefined;
  }
  return result;
};

const safePowerFactor = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1
    ? value
    : fallback;

const getLegacyRowPowerFactor = (row: PowerTableRow, fallback: number) => {
  const candidate = Number(row.pf);
  return Number.isFinite(candidate) && candidate > 0 && candidate <= 1
    ? candidate
    : fallback;
};

/**
 * Reconstructs a versioned snapshot for pre-v2 records. The result is marked
 * as an estimate because older rows did not persist every assumption needed
 * to prove the historical calculation.
 */
export const buildLegacyPowerCalculationSnapshot = ({
  fallbackPowerFactor,
  perRowPowerFactor,
  rows,
  settings,
  totalWatts,
}: {
  fallbackPowerFactor: number;
  perRowPowerFactor: boolean;
  rows: PowerTableRow[];
  settings: PowerElectricalSettings;
  totalWatts: number;
}): PowerCalculationSnapshot => {
  const normalizedSettings: PowerElectricalSettings = {
    safetyMargin:
      Number.isFinite(settings.safetyMargin) && settings.safetyMargin >= 0
        ? Math.min(settings.safetyMargin, 100)
        : 0,
    phaseMode: settings.phaseMode,
    voltage:
      Number.isFinite(settings.voltage) && settings.voltage > 0
        ? settings.voltage
        : getVoltageForPhase(settings.phaseMode),
    ...(perRowPowerFactor
      ? {}
      : { powerFactor: safePowerFactor(settings.powerFactor, fallbackPowerFactor) }),
  };
  const rowsWithTotals = calculatePowerRows(rows, []);
  const rawApparentPowerVa =
    perRowPowerFactor && rowsWithTotals.length > 0
      ? calculateMixedLoadApparentPower(rowsWithTotals, (row) =>
          getLegacyRowPowerFactor(row, fallbackPowerFactor),
        )
      : undefined;
  const rowTotalWatts = sumPowerRows(rowsWithTotals);
  const storedTotalWatts =
    Number.isFinite(totalWatts) && totalWatts > 0 ? totalWatts : 0;
  const resolvedTotalWatts = perRowPowerFactor
    ? rowTotalWatts || storedTotalWatts
    : storedTotalWatts || rowTotalWatts;
  return buildPowerCalculationSnapshot({
    powerFactorSource: perRowPowerFactor ? "per-row" : "legacy-default",
    rawApparentPowerVa,
    settings: normalizedSettings,
    totalWatts: resolvedTotalWatts,
    isEstimate: true,
  });
};
