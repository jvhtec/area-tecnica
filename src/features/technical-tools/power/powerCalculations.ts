import type {
  PhaseMode,
  PowerComponent,
  PowerCalculationSnapshot,
  PowerElectricalSettings,
  PowerFactorSource,
  PowerTable,
  PowerTableRow,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";
import { POWER_CALCULATION_VERSION } from "@/features/technical-tools/power/types";

const SQRT3 = Math.sqrt(3);
export const POWER_PDU_PLANNING_LOAD_FACTOR = 0.8;

export class PowerCalculationValidationError extends Error {}

export const POWER_PDU_OPTIONS: Record<TechnicalDepartment, Record<PhaseMode, string[]>> = {
  sound: {
    single: ["Schuko 16A", "CEE32A 1P+N+G", "CEE63A 1P+N+G"],
    three: ["CEE16A 3P+N+G", "CEE32A 3P+N+G", "CEE63A 3P+N+G", "CEE125A 3P+N+G"],
  },
  lights: {
    single: ["Schuko 16A", "CEE32A 1P+N+G", "CEE63A 1P+N+G"],
    three: ["CEE32A 3P+N+G", "CEE63A 3P+N+G", "CEE125A 3P+N+G", "Powerlock 400A 3P+N+G"],
  },
  video: {
    single: ["Schuko 16A", "CEE32A 1P+N+G", "CEE63A 1P+N+G"],
    three: ["CEE16A 3P+N+G", "CEE32A 3P+N+G", "CEE63A 3P+N+G", "CEE125A 3P+N+G", "Powerlock 400A 3P+N+G"],
  },
};

export const getVoltageForPhase = (phaseMode: PhaseMode) => (phaseMode === "single" ? 230 : 400);

export const getPowerPduOptions = (department: TechnicalDepartment, phaseMode: PhaseMode) =>
  POWER_PDU_OPTIONS[department][phaseMode];

export const calculatePowerRows = <Row extends PowerTableRow, Component extends PowerComponent>(
  rows: Row[],
  components: Component[],
): Row[] =>
  rows.map((row) => {
    const component = components.find((candidate) => candidate.id.toString() === row.componentId);
    const parsedQuantity = Number.parseFloat(row.quantity || "0");
    const parsedWatts = Number.parseFloat(row.watts || "0");
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0;
    const watts = Number.isFinite(parsedWatts) && parsedWatts > 0 ? parsedWatts : 0;
    const totalWatts = quantity * watts;

    return {
      ...row,
      componentName: component?.name || row.componentName || "",
      totalWatts,
    };
  });

export const sumPowerRows = (rows: Pick<PowerTableRow, "totalWatts">[]) =>
  rows.reduce(
    (sum, row) =>
      sum +
      (Number.isFinite(row.totalWatts) && (row.totalWatts ?? 0) > 0
        ? row.totalWatts ?? 0
        : 0),
    0,
  );

export const calculateMixedLoadApparentPower = <Row extends PowerTableRow>(
  rows: Row[],
  resolvePowerFactor: (row: Row) => number,
) => {
  const totalWatts = sumPowerRows(rows);
  const totalVar = rows.reduce((sum, row) => {
    const powerFactor = resolvePowerFactor(row);
    if (!Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1) return sum;
    if (powerFactor === 1) return sum;
    return sum + (row.totalWatts || 0) * Math.tan(Math.acos(powerFactor));
  }, 0);

  return Math.hypot(totalWatts, totalVar);
};

export const calculateElectricalTotals = ({
  rawApparentPowerVa,
  settings,
  totalWatts,
}: {
  rawApparentPowerVa?: number;
  settings: PowerElectricalSettings;
  totalWatts: number;
}) => {
  const loadMultiplier = 1 + settings.safetyMargin / 100;
  const adjustedWatts = totalWatts * loadMultiplier;
  const powerFactor = settings.powerFactor ?? 1;
  const totalVa = rawApparentPowerVa === undefined
    ? powerFactor > 0 ? adjustedWatts / powerFactor : adjustedWatts
    : rawApparentPowerVa * loadMultiplier;
  const canCalculateCurrent =
    settings.voltage > 0 && (rawApparentPowerVa !== undefined || powerFactor > 0);
  const phaseDivisor = settings.phaseMode === "single" ? 1 : SQRT3;
  return {
    adjustedWatts,
    totalVa,
    currentLine: canCalculateCurrent
      ? totalVa / (phaseDivisor * settings.voltage)
      : 0,
  };
};

export const getPowerPduAmpRating = (pduType: string) => {
  const match = pduType.match(/(\d+)A/);
  return match ? Number.parseInt(match[1], 10) : undefined;
};

export const recommendPowerPdu = (currentLine: number, pduOptions: string[]) =>
  Number.isFinite(currentLine) && currentLine >= 0
    ? pduOptions.find((option) => {
    const amps = getPowerPduAmpRating(option);
    return amps !== undefined && currentLine <= amps * POWER_PDU_PLANNING_LOAD_FACTOR;
      }) ?? ""
    : "";

const isBlankPowerRow = (row: PowerTableRow) =>
  !row.componentId && !row.quantity.trim() && !row.watts.trim();

export const validatePowerCalculationInput = ({
  perRowPowerFactor,
  rows,
  settings,
}: {
  perRowPowerFactor: boolean;
  rows: PowerTableRow[];
  settings: PowerElectricalSettings;
}) => {
  const activeRows = rows.filter((row) => !isBlankPowerRow(row));
  const invalidSettings =
    !Number.isFinite(settings.voltage) ||
    settings.voltage <= 0 ||
    !Number.isFinite(settings.safetyMargin) ||
    settings.safetyMargin < 0 ||
    settings.safetyMargin > 100 ||
    (!perRowPowerFactor &&
      (!Number.isFinite(settings.powerFactor) ||
        (settings.powerFactor ?? 0) <= 0 ||
        (settings.powerFactor ?? 0) > 1));
  const invalidRow = activeRows.some((row) => {
    const quantity = Number(row.quantity);
    const watts = Number(row.watts);
    const powerFactor = Number(row.pf);
    return !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(watts) || watts <= 0 ||
      (perRowPowerFactor &&
        (!Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1));
  });

  if (activeRows.length === 0 || invalidSettings || invalidRow) {
    throw new PowerCalculationValidationError("Invalid power calculation input");
  }
  return activeRows;
};

export const buildPowerCalculationSnapshot = ({
  powerFactorSource,
  rawApparentPowerVa,
  settings,
  totalWatts,
  isEstimate = false,
}: {
  powerFactorSource: PowerFactorSource;
  rawApparentPowerVa?: number;
  settings: PowerElectricalSettings;
  totalWatts: number;
  isEstimate?: boolean;
}): PowerCalculationSnapshot => {
  const totals = calculateElectricalTotals({ rawApparentPowerVa, settings, totalWatts });

  return {
    version: POWER_CALCULATION_VERSION,
    totalWatts,
    adjustedWatts: totals.adjustedWatts,
    totalVa: totals.totalVa,
    currentLine: totals.currentLine,
    safetyMargin: settings.safetyMargin,
    phaseMode: settings.phaseMode,
    voltage: settings.voltage,
    ...(settings.powerFactor !== undefined ? { powerFactor: settings.powerFactor } : {}),
    powerFactorSource,
    isEstimate,
  };
};

export const createCalculatedPowerTable = <Row extends PowerTableRow, Component extends PowerComponent>({
  components,
  currentTable,
  id,
  name,
  pduOptions,
  rawApparentPowerVa,
  settings,
  tablePatch,
}: {
  components: Component[];
  currentTable: Pick<PowerTable, "customPosition" | "position" | "rows">;
  id: number | string;
  name: string;
  pduOptions: string[];
  rawApparentPowerVa?: number;
  settings: PowerElectricalSettings;
  tablePatch?: Partial<PowerTable>;
}) => {
  const perRowPowerFactor = rawApparentPowerVa !== undefined;
  const activeRows = validatePowerCalculationInput({
    perRowPowerFactor,
    rows: currentTable.rows,
    settings,
  });
  const rows = calculatePowerRows(activeRows as Row[], components);
  const totalWatts = sumPowerRows(rows);
  const calculation = buildPowerCalculationSnapshot({
    powerFactorSource: perRowPowerFactor ? "per-row" : "global",
    rawApparentPowerVa,
    settings,
    totalWatts,
  });
  const selectedPdu = tablePatch?.customPduType;

  return {
    name,
    rows,
    totalWatts,
    adjustedWatts: calculation.adjustedWatts,
    totalVa: calculation.totalVa,
    currentPerPhase: calculation.currentLine,
    calculation,
    pduType: selectedPdu || recommendPowerPdu(calculation.currentLine, pduOptions),
    customPduType: "",
    position: currentTable.position,
    customPosition: currentTable.customPosition,
    includesHoist: false,
    id,
    ...tablePatch,
  };
};
