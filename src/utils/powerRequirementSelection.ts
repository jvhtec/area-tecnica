import type { Database } from '@/integrations/supabase/types';
import {
  evaluatePowerStandards,
  type PowerStandardsRow,
} from '@/features/technical-tools/power/electricalStandards';
import { parsePowerCalculationSnapshot } from '@/features/technical-tools/power/powerSnapshots';
import { getResolvedPowerPosition } from '@/utils/powerPositions';
import type { TechnicalPowerDepartment } from '@/utils/technicalPowerTypes';
import { isRecord } from '@/utils/typeGuards';

type PowerRequirementRow = Database['public']['Tables']['power_requirement_tables']['Row'];
type IndexedRow = { row: PowerRequirementRow; inputIndex: number };

export const getPowerRequirementStageNumber = (row: PowerRequirementRow) => {
  if (typeof row.stage_number === 'number') return row.stage_number;
  const value = isRecord(row.table_data) ? row.table_data.stageNumber : null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const getPowerRequirementStageName = (row: PowerRequirementRow) => {
  if (row.stage_name?.trim()) return row.stage_name.trim();
  const value = isRecord(row.table_data) ? row.table_data.stageName : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getStageLabel = (row: PowerRequirementRow) =>
  getPowerRequirementStageName(row) ??
  (getPowerRequirementStageNumber(row) === null
    ? null
    : `Stage ${getPowerRequirementStageNumber(row)}`);

const getStageKey = (row: PowerRequirementRow) =>
  getPowerRequirementStageNumber(row) === null
    ? getPowerRequirementStageName(row)
      ? `stage-name-${getPowerRequirementStageName(row)!.toLowerCase()}`
      : 'no-stage'
    : `stage-${getPowerRequirementStageNumber(row)}`;

const getDataValue = (row: PowerRequirementRow, key: string) =>
  isRecord(row.table_data) ? row.table_data[key] : null;

const getGeneration = (row: PowerRequirementRow) => {
  const value = getDataValue(row, 'generationTimestamp');
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getSourceTimestamp = (row: PowerRequirementRow) => {
  const value = getDataValue(row, 'sourceTableId');
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const timestamp = (value?: string | null) => {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const compareRows = (left: IndexedRow, right: IndexedRow) => {
  const leftTime = timestamp(getGeneration(left.row)) || getSourceTimestamp(left.row) || timestamp(left.row.created_at);
  const rightTime = timestamp(getGeneration(right.row)) || getSourceTimestamp(right.row) || timestamp(right.row.created_at);
  return leftTime - rightTime ||
    (left.row.created_at || '').localeCompare(right.row.created_at || '') ||
    left.inputIndex - right.inputIndex;
};

const scopeKey = (row: PowerRequirementRow, department: TechnicalPowerDepartment) =>
  `${department}:${getStageKey(row)}`;

const identityKey = (row: PowerRequirementRow, department: TechnicalPowerDepartment) =>
  [
    scopeKey(row, department),
    row.table_name?.trim().toLowerCase() || 'unnamed',
    row.position?.trim().toLowerCase() || '',
    row.custom_position?.trim().toLowerCase() || '',
  ].join(':');

export const getCurrentPowerRequirementTables = (
  rows: PowerRequirementRow[],
): PowerRequirementRow[] => {
  const scopes = new Map<string, IndexedRow[]>();
  rows.forEach((row, inputIndex) => {
    const department = row.department as TechnicalPowerDepartment | null;
    if (!department) return;
    const key = scopeKey(row, department);
    scopes.set(key, [...(scopes.get(key) || []), { row, inputIndex }]);
  });

  const current: IndexedRow[] = [];
  scopes.forEach((scopeRows) => {
    const generated = scopeRows.filter(({ row }) => getGeneration(row));
    if (generated.length) {
      const latest = generated.reduce((value, { row }) => {
        const candidate = getGeneration(row)!;
        return !value || timestamp(candidate) > timestamp(value) ||
          (timestamp(candidate) === timestamp(value) && candidate.localeCompare(value) > 0)
          ? candidate
          : value;
      }, '');
      current.push(...generated.filter(({ row }) => getGeneration(row) === latest));
      return;
    }

    const legacy = new Map<string, IndexedRow>();
    scopeRows.forEach((entry) => {
      const department = entry.row.department as TechnicalPowerDepartment | null;
      if (!department) return;
      const key = identityKey(entry.row, department);
      const saved = legacy.get(key);
      if (!saved || compareRows(entry, saved) >= 0) legacy.set(key, entry);
    });
    current.push(...legacy.values());
  });

  return current.sort(compareRows).map(({ row }) => row);
};

const formatNumber = (value: number, fractionDigits: number) =>
  new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);

const formatStoredNumber = (
  value: number | string | null | undefined,
  fractionDigits: number,
) => (typeof value === 'number' && Number.isFinite(value)
  ? formatNumber(value, fractionDigits)
  : 'N/D');

/** Narrows a persisted JSON row to the fields the standards checks read. */
const toStandardsRow = (value: unknown): PowerStandardsRow | null => {
  if (!isRecord(value)) return null;
  const { quantity, watts, totalWatts, pf, fixtureType } = value;
  return {
    ...(typeof quantity === 'string' ? { quantity } : {}),
    ...(typeof watts === 'string' ? { watts } : {}),
    ...(typeof totalWatts === 'number' ? { totalWatts } : {}),
    ...(typeof pf === 'string' ? { pf } : {}),
    ...(typeof fixtureType === 'string' ? { fixtureType } : {}),
  };
};

const getPowerTableRows = (row: PowerRequirementRow): PowerStandardsRow[] => {
  const rows = isRecord(row.table_data) ? row.table_data.rows : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value) => {
    const standardsRow = toStandardsRow(value);
    return standardsRow ? [standardsRow] : [];
  });
};

/**
 * Plain-text power summary embedded in the Hoja de Ruta. It mirrors what the
 * power report states — calculation power, apparent power, the supply the
 * current was derived from, and the REBT advisories — because the Hoja is what
 * crews physically carry, while the report may never leave the office.
 */
export const formatPowerRequirementsText = (rows: PowerRequirementRow[]) =>
  getCurrentPowerRequirementTables(rows)
    .map((row) => {
      const calculation = parsePowerCalculationSnapshot(
        isRecord(row.table_data) ? row.table_data.calculation : undefined,
      );
      const lines = [
        `${[(row.department || 'general').toUpperCase(), getStageLabel(row), row.table_name || 'tabla'].filter(Boolean).join(' - ')}:`,
        `Potencia total: ${formatStoredNumber(row.total_watts, 0)} W`,
      ];

      if (calculation) {
        if (calculation.safetyMargin > 0) {
          lines.push(
            `Potencia de cálculo (${formatNumber(calculation.safetyMargin, 0)} %): ` +
              `${formatNumber(calculation.adjustedWatts, 0)} W`,
          );
        }
        lines.push(`Potencia aparente: ${formatNumber(calculation.totalVa / 1000, 2)} kVA`);
        lines.push(
          `Corriente de línea: ${formatNumber(calculation.currentLine, 2)} A ` +
            `(${calculation.phaseMode === 'three' ? 'trifásico' : 'monofásico'} ` +
            `${formatNumber(calculation.voltage, 0)} V)`,
        );
      } else {
        // Pre-snapshot rows only stored the columns, so the assumptions behind
        // this current cannot be reproduced.
        lines.push(
          `Corriente de línea (guardada): ${formatStoredNumber(row.current_per_phase, 2)} A`,
        );
        lines.push('Cálculo estimado: sin instantánea reproducible');
      }

      lines.push(`PDU recomendado: ${row.custom_pdu_type || row.pdu_type || 'N/D'}`);

      const position = getResolvedPowerPosition(row.position, row.custom_position);
      if (position) lines.push(`Posición: ${position}`);
      if (row.includes_hoist) {
        lines.push(
          'Suministro auxiliar de motores CEE32A 3P+N+G (excluido de totales). ' +
            'Dimensiónelo al 125 % de la intensidad a plena carga del motor ' +
            '(REBT ITC-BT-47 apdo. 3.1).',
        );
      }

      if (calculation) {
        // The motor advisory is left out: the hoist line above already carries
        // it, worded for this circuit.
        evaluatePowerStandards({
          calculation,
          includesHoist: Boolean(row.includes_hoist),
          rows: getPowerTableRows(row),
        })
          .findings.filter((finding) => finding.code !== 'itc-bt-47-motor-feed')
          .forEach((finding) => lines.push(`${finding.reference}: ${finding.message}`));
      }

      return `${lines.join('\n')}\n`;
    })
    .join('\n');
