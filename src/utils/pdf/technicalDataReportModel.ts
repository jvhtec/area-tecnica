import { aggregatePowerCalculations } from "@/features/technical-tools/power/powerAggregation";
import {
  getPowerPduAmpRating,
  POWER_PDU_PLANNING_LOAD_FACTOR,
} from "@/features/technical-tools/power/powerCalculations";
import { getResolvedPowerPosition } from "@/utils/powerPositions";
import type {
  ExportTable,
  PowerPdfSummary,
  SummaryRow,
} from "@/utils/pdfExport";

export type TechnicalReportKind = "power" | "weight";

export type PowerCircuitSummary = {
  currentLine: number | null;
  /** Auxiliary motor supply (CEE32A 3P+N+G), excluded from the totals. */
  includesHoist: boolean;
  margin: number | null;
  name: string;
  pduLabel: string;
  pduLimit: number | null;
  pduStatus: "ok" | "over" | "unknown";
  positionLabel: string;
  totalVa: number | null;
  totalWatts: number;
  adjustedWatts: number;
};

export type PowerReportSummary = {
  adjustedWatts: number;
  aggregationReason?: string;
  currentLine: number | null;
  circuits: PowerCircuitSummary[];
  pduLabel: string;
  pduRating: number | null;
  totalVa: number | null;
  totalWatts: number;
};

export type PowerOverviewRow = {
  cells: string[];
  kind: "circuit" | "hoist";
};

export type WeightPointSummary = {
  motorCount: string;
  name: string;
  totalWeight: number;
};

/** Auxiliary motor supply connector, shown next to the circuit it accompanies. */
export const HOIST_PDU_LABEL = "CEE32A 3P+N+G";

const NBSP = "\u00A0";

const numberFormatterCache = new Map<string, Intl.NumberFormat>();

export const formatTechnicalReportNumber = (
  value: number,
  minimumFractionDigits = 0,
  maximumFractionDigits = minimumFractionDigits,
) => {
  if (!Number.isFinite(value)) return "—";
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = numberFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping: true,
    });
    numberFormatterCache.set(key, formatter);
  }
  return formatter.format(value);
};

const parseDate = (value?: string | Date | null) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (!value) return null;

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dayFirstDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirstDate) {
    const [, day, month, year] = dayFirstDate;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    const isExactDate =
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() === Number(month) - 1 &&
      parsed.getUTCDate() === Number(day);
    return isExactDate ? parsed : null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatTechnicalReportDate = (value?: string | Date | null) => {
  const parsed = parseDate(value);
  if (!parsed) return "No disponible";
  const parts = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Madrid",
    year: "numeric",
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}`.trim();
};

export const getWeightMotorCount = (table: ExportTable) => {
  const explicitPoints = table.riggingPoint
    ?.split(",")
    .filter((point) => point.trim().length > 0).length;
  if (explicitPoints && explicitPoints > 0) return String(explicitPoints);
  if (table.dualMotors) return "2";
  return (table.totalWeight ?? 0) > 0 ? "1" : "—";
};

export const buildWeightPointSummaries = (
  tables: ExportTable[],
  suppliedRows?: SummaryRow[],
): WeightPointSummary[] => {
  if (suppliedRows?.length) {
    return suppliedRows.map((row) => ({
      motorCount: row.riggingPoints || "—",
      name: row.clusterName || "Punto sin nombre",
      totalWeight: Number.isFinite(row.clusterWeight) ? row.clusterWeight : 0,
    }));
  }

  return tables.map((table) => ({
    motorCount: getWeightMotorCount(table),
    name: table.name || "Punto sin nombre",
    totalWeight: Number.isFinite(table.totalWeight) ? table.totalWeight ?? 0 : 0,
  }));
};

const buildCircuitSummary = (
  table: ExportTable,
  fallbackMargin?: number,
): PowerCircuitSummary => {
  const calculation = table.calculation;
  const totalWatts = calculation?.totalWatts ?? table.totalWatts ?? 0;
  const margin = calculation?.safetyMargin ?? fallbackMargin ?? null;
  const adjustedWatts =
    calculation?.adjustedWatts ??
    table.adjustedWatts ??
    totalWatts * (1 + (margin ?? 0) / 100);
  const currentLine =
    calculation?.currentLine ?? table.currentPerPhase ?? null;
  const pduLabel = table.customPduType || table.pduType || "Sin asignar";
  const pduRating = getPowerPduAmpRating(pduLabel);
  const pduLimit =
    pduRating === undefined
      ? null
      : pduRating * POWER_PDU_PLANNING_LOAD_FACTOR;

  return {
    adjustedWatts,
    currentLine,
    includesHoist: Boolean(table.includesHoist),
    margin,
    name: table.name || "Circuito sin nombre",
    pduLabel,
    pduLimit,
    pduStatus:
      pduLimit === null || currentLine === null
        ? "unknown"
        : currentLine <= pduLimit
          ? "ok"
          : "over",
    positionLabel:
      getResolvedPowerPosition(table.position, table.customPosition) ||
      "Sin posición",
    totalVa: calculation?.totalVa ?? table.totalVa ?? null,
    totalWatts,
  };
};

/**
 * Rows of the "Resumen de circuitos" table. Circuits that carry an auxiliary
 * motor supply get a second, non-aggregable row right below them so the 32 A
 * feed is visible in the summary and not only in the stage plot.
 */
export const buildPowerOverviewRows = (
  circuits: PowerCircuitSummary[],
): PowerOverviewRow[] => {
  const rows: PowerOverviewRow[] = [];
  circuits.forEach((circuit) => {
    rows.push({
      cells: [
        circuit.name,
        circuit.pduLabel,
        circuit.positionLabel,
        `${formatTechnicalReportNumber(circuit.adjustedWatts / 1000, 2)}${NBSP}kW`,
        circuit.currentLine === null
          ? "No agregable"
          : `${formatTechnicalReportNumber(circuit.currentLine, 2)}${NBSP}A`,
      ],
      kind: "circuit",
    });
    if (!circuit.includesHoist) return;
    rows.push({
      cells: [
        `Toma de motores${NBSP}— ${circuit.name}`,
        HOIST_PDU_LABEL,
        circuit.positionLabel,
        "Excluida",
        "Excluida",
      ],
      kind: "hoist",
    });
  });
  return rows;
};

export const buildPowerReportSummary = (
  tables: ExportTable[],
  suppliedSummary?: PowerPdfSummary,
  fallbackMargin?: number,
): PowerReportSummary => {
  const calculated = aggregatePowerCalculations(tables);
  const hasReproducibleSnapshots =
    tables.length > 0 && tables.every((table) => Boolean(table.calculation));
  const summary = hasReproducibleSnapshots || !suppliedSummary
    ? {
        adjustedWatts: calculated.adjustedWatts,
        aggregationReason: calculated.reason,
        currentLine: calculated.currentLine,
        totalVa: calculated.totalVa,
        totalWatts: calculated.totalWatts,
      }
    : {
        adjustedWatts:
          suppliedSummary.adjustedSystemWatts ??
          suppliedSummary.totalSystemWatts,
        aggregationReason: suppliedSummary.aggregationReason,
        currentLine: suppliedSummary.totalSystemAmps,
        totalVa:
          suppliedSummary.totalSystemKva == null
            ? null
            : suppliedSummary.totalSystemKva * 1000,
        totalWatts: suppliedSummary.totalSystemWatts,
      };
  const circuits = tables.map((table) =>
    buildCircuitSummary(table, fallbackMargin));
  const pduLabels = new Set(
    circuits.map((circuit) => circuit.pduLabel).filter((label) => label !== "Sin asignar"),
  );
  const pduLabel =
    circuits.length === 1 && pduLabels.size === 1
      ? [...pduLabels][0]
      : circuits.length > 1
        ? "Por circuito"
        : "Sin asignar";
  const pduRating =
    circuits.length === 1 && pduLabels.size === 1
      ? getPowerPduAmpRating(pduLabel) ?? null
      : null;

  return {
    ...summary,
    circuits,
    pduLabel,
    pduRating,
  };
};
