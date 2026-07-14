import type { Database } from '@/integrations/supabase/types';
import { getResolvedPowerPosition } from '@/utils/powerPositions';
import type { TechnicalPowerDepartment } from '@/utils/technicalPowerTypes';

type PowerRequirementRow = Database['public']['Tables']['power_requirement_tables']['Row'];
type IndexedRow = { row: PowerRequirementRow; inputIndex: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const formatNumber = (value: number | string | null | undefined) =>
  typeof value === 'number' ? value.toFixed(2) : value ?? 'N/D';

export const formatPowerRequirementsText = (rows: PowerRequirementRow[]) =>
  getCurrentPowerRequirementTables(rows)
    .map((row) => {
      const lines = [
        `${[(row.department || 'general').toUpperCase(), getStageLabel(row), row.table_name || 'tabla'].filter(Boolean).join(' - ')}:`,
        `Potencia Total: ${formatNumber(row.total_watts)}W`,
        `Corriente de linea guardada: ${formatNumber(row.current_per_phase)}A`,
        `PDU Recomendado: ${row.custom_pdu_type || row.pdu_type || 'N/D'}`,
      ];
      const position = getResolvedPowerPosition(row.position, row.custom_position);
      if (position) lines.push(`Posición: ${position}`);
      if (row.includes_hoist) {
        lines.push('Suministro auxiliar de motores CEE32A 3P+N+G (excluido de totales)');
      }
      return `${lines.join('\n')}\n`;
    })
    .join('\n');
