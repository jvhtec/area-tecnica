import type {
  PhaseMode,
  PowerComponent,
  PowerElectricalSettings,
  PowerTable,
  PowerTableRow,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";

const SQRT3 = Math.sqrt(3);
const PLANNING_LOAD_FACTOR = 0.8;

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
    const quantity = Number.parseFloat(row.quantity || "0");
    const watts = Number.parseFloat(row.watts || "0");
    const totalWatts = quantity && watts ? quantity * watts : 0;

    return {
      ...row,
      componentName: component?.name || row.componentName || "",
      totalWatts,
    };
  });

export const sumPowerRows = (rows: Pick<PowerTableRow, "totalWatts">[]) =>
  rows.reduce((sum, row) => sum + (row.totalWatts || 0), 0);

export const calculateMixedLoadApparentPower = <Row extends PowerTableRow>(
  rows: Row[],
  resolvePowerFactor: (row: Row) => number,
) => {
  const totalWatts = sumPowerRows(rows);
  const totalVar = rows.reduce((sum, row) => {
    const powerFactor = resolvePowerFactor(row);
    if (!powerFactor || powerFactor >= 1) return sum;
    return sum + (row.totalWatts || 0) * Math.tan(Math.acos(powerFactor));
  }, 0);

  return Math.sqrt(totalWatts * totalWatts + totalVar * totalVar);
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
  const adjustedWatts = totalWatts * (1 + settings.safetyMargin / 100);
  const powerFactor = settings.powerFactor ?? 1;

  if (rawApparentPowerVa !== undefined) {
    const adjustedVa = rawApparentPowerVa * (1 + settings.safetyMargin / 100);
    const currentLine =
      settings.phaseMode === "single"
        ? adjustedVa / settings.voltage
        : adjustedVa / (SQRT3 * settings.voltage);

    return { adjustedWatts, adjustedVa, currentLine, totalVa: adjustedVa };
  }

  const currentLine =
    settings.phaseMode === "single"
      ? adjustedWatts / (settings.voltage * powerFactor)
      : adjustedWatts / (SQRT3 * settings.voltage * powerFactor);
  const totalVa = powerFactor > 0 ? adjustedWatts / powerFactor : adjustedWatts;

  return { adjustedWatts, adjustedVa: totalVa, currentLine, totalVa };
};

const getAmpRating = (pduType: string) => {
  const match = pduType.match(/(\d+)A/);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

export const recommendPowerPdu = (currentLine: number, pduOptions: string[]) => {
  const matchingOption = pduOptions.find((option) => currentLine <= getAmpRating(option) * PLANNING_LOAD_FACTOR);
  return matchingOption ?? pduOptions[pduOptions.length - 1] ?? "";
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
  const rows = calculatePowerRows(currentTable.rows as Row[], components);
  const totalWatts = sumPowerRows(rows);
  const { adjustedWatts, currentLine, totalVa } = calculateElectricalTotals({
    rawApparentPowerVa,
    settings,
    totalWatts,
  });

  return {
    name,
    rows,
    totalWatts,
    adjustedWatts,
    totalVa,
    currentPerPhase: currentLine,
    pduType: recommendPowerPdu(currentLine, pduOptions),
    customPduType: "",
    position: currentTable.position,
    customPosition: currentTable.customPosition,
    includesHoist: false,
    id,
    ...tablePatch,
  };
};
