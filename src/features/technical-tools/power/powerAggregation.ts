import type { PowerCalculationSnapshot } from "@/features/technical-tools/power/types";

export type PowerAggregation = {
  reason?: string;
  totalWatts: number;
  adjustedWatts: number;
  totalVa: number | null;
  currentLine: number | null;
};

type CalculationCarrier = {
  calculation?: PowerCalculationSnapshot;
  totalWatts?: number;
};

const sumRawWatts = (items: CalculationCarrier[]) =>
  items.reduce((sum, item) => {
    const watts = item.calculation?.totalWatts ?? item.totalWatts ?? 0;
    return sum + (Number.isFinite(watts) && watts > 0 ? watts : 0);
  }, 0);

const notAggregable = (
  items: CalculationCarrier[],
  reason: string,
): PowerAggregation => ({
  reason,
  totalWatts: sumRawWatts(items),
  adjustedWatts: items.reduce(
    (sum, item) => sum + (item.calculation?.adjustedWatts ?? item.totalWatts ?? 0),
    0,
  ),
  totalVa: null,
  currentLine: null,
});

/**
 * Aggregates compatible supplies as vectors (ΣP, ΣQ), never by adding line
 * currents. Multiple single-phase tables require phase allocation data that
 * the calculator does not currently collect, so they are intentionally left
 * non-aggregable.
 */
export const aggregatePowerCalculations = (
  items: CalculationCarrier[],
): PowerAggregation => {
  if (items.length === 0) {
    return {
      totalWatts: 0,
      adjustedWatts: 0,
      totalVa: 0,
      currentLine: 0,
    };
  }

  const calculations = items.map((item) => item.calculation);
  if (calculations.some((calculation) => !calculation)) {
    return notAggregable(
      items,
      "Falta un calculo reproducible.",
    );
  }

  const resolved = calculations as PowerCalculationSnapshot[];
  const phaseModes = new Set(resolved.map((calculation) => calculation.phaseMode));
  if (phaseModes.size > 1) {
    return notAggregable(
      items,
      "Mezcla suministros monofasicos y trifasicos.",
    );
  }

  if (resolved.length > 1 && resolved.some((calculation) => calculation.phaseMode === "single")) {
    return notAggregable(
      items,
      "Falta asignacion de fase para cargas monofasicas.",
    );
  }

  const first = resolved[0];
  const voltagesMatch = resolved.every(
    (calculation) => Math.abs(calculation.voltage - first.voltage) < 0.01,
  );
  if (!voltagesMatch) {
    return notAggregable(
      items,
      "Tensiones nominales distintas.",
    );
  }

  const adjustedWatts = resolved.reduce(
    (sum, calculation) => sum + calculation.adjustedWatts,
    0,
  );
  const totalVar = resolved.reduce(
    (sum, calculation) => sum + Math.sqrt(Math.max(
      0,
      calculation.totalVa ** 2 - calculation.adjustedWatts ** 2,
    )),
    0,
  );
  const totalVa = Math.hypot(adjustedWatts, totalVar);
  const currentLine =
    first.phaseMode === "single"
      ? totalVa / first.voltage
      : totalVa / (Math.sqrt(3) * first.voltage);

  return {
    totalWatts: sumRawWatts(items),
    adjustedWatts,
    totalVa,
    currentLine,
  };
};
