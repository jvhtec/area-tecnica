import type { Database } from '@/integrations/supabase/types';
import type { TechnicalPowerDepartment } from '@/utils/technicalPowerTypes';

type TourDefaultTableRow = Database['public']['Tables']['tour_default_tables']['Row'];
type TourPowerDefaultRow = Database['public']['Tables']['tour_power_defaults']['Row'];
type TourDatePowerOverrideRow = Database['public']['Tables']['tour_date_power_overrides']['Row'];

type JsonRecord = Record<string, unknown>;

const DEFAULT_POWER_FACTOR: Record<TechnicalPowerDepartment, number> = {
  sound: 0.95,
  lights: 0.9,
  video: 0.9,
};

export interface NormalizedTourPowerTable {
  id: string;
  name: string;
  rows: unknown[];
  totalWatts: number;
  totalVa: number;
  currentPerPhase: number;
  pduType: string;
  customPduType?: string;
  position?: string;
  customPosition?: string;
  includesHoist: boolean;
  toolType: 'consumos';
  source: 'tour-default' | 'tour-override' | 'legacy-tour-default';
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const getRows = (value: unknown): unknown[] => {
  if (!isRecord(value)) return [];
  const rows = value.rows;
  return Array.isArray(rows) ? rows : [];
};

const getMetadataValue = <T>(
  value: unknown,
  key: string,
  fallback: T
): T => {
  if (!isRecord(value)) return fallback;
  return (value[key] as T) ?? fallback;
};

export const computePowerTotalVa = (
  watts: number,
  metadata: unknown,
  department: TechnicalPowerDepartment
): number => {
  if (!watts) return 0;

  const candidatePf = getNumber(isRecord(metadata) ? metadata.pf : undefined);
  const storedPf =
    candidatePf !== undefined &&
    Number.isFinite(candidatePf) &&
    candidatePf > 0 &&
    candidatePf <= 1
      ? candidatePf
      : DEFAULT_POWER_FACTOR[department];

  return watts / storedPf;
};

export const sortTourPowerDefaultTables = (tables: TourDefaultTableRow[]) =>
  [...tables].sort((left, right) => {
    const leftOrder = isRecord(left.metadata) ? getNumber(left.metadata.order_index) ?? 999 : 999;
    const rightOrder = isRecord(right.metadata) ? getNumber(right.metadata.order_index) ?? 999 : 999;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });

export const getPowerSafetyMarginFromDefaultTable = (table?: TourDefaultTableRow): number => {
  if (!table) return 0;

  const metadataSafetyMargin = isRecord(table.metadata)
    ? getNumber(table.metadata.safetyMargin)
    : undefined;

  if (metadataSafetyMargin !== undefined) {
    return metadataSafetyMargin;
  }

  return isRecord(table.table_data) ? getNumber(table.table_data.safetyMargin) ?? 0 : 0;
};

export const getPowerSafetyMarginFromOverride = (
  override?: TourDatePowerOverrideRow
): number => {
  if (!override || !isRecord(override.override_data)) return 0;
  return getNumber(override.override_data.safetyMargin) ?? 0;
};

export const normalizeTourDefaultPowerTable = (
  table: TourDefaultTableRow,
  department: TechnicalPowerDepartment
): NormalizedTourPowerTable => {
  const metadata = isRecord(table.metadata) ? table.metadata : {};
  const pduType = String(getMetadataValue(metadata, 'pdu_type', ''));
  const customPduType = String(getMetadataValue(metadata, 'custom_pdu_type', ''));
  const position = String(getMetadataValue(metadata, 'position', ''));
  const customPosition = String(getMetadataValue(metadata, 'custom_position', ''));

  return {
    id: table.id,
    name: table.table_name || 'Unnamed',
    rows: getRows(table.table_data),
    totalWatts: table.total_value || 0,
    totalVa: computePowerTotalVa(table.total_value || 0, metadata, department),
    currentPerPhase: getNumber(metadata.current_per_phase) ?? 0,
    pduType,
    customPduType: customPduType || undefined,
    position: position || undefined,
    customPosition: customPosition || undefined,
    includesHoist: getBoolean(metadata.includes_hoist) ?? false,
    toolType: 'consumos',
    source: 'tour-default',
  };
};

export const normalizeLegacyTourPowerDefault = (
  table: TourPowerDefaultRow,
  department: TechnicalPowerDepartment
): NormalizedTourPowerTable => ({
  id: table.id,
  name: table.table_name || 'Unnamed',
  rows: [
    {
      quantity: '1',
      componentName: table.table_name || 'Unnamed',
      watts: String(table.total_watts || 0),
      totalWatts: table.total_watts || 0,
    },
  ],
  totalWatts: table.total_watts || 0,
  totalVa: computePowerTotalVa(table.total_watts || 0, null, department),
  currentPerPhase: table.current_per_phase || 0,
  pduType: table.pdu_type || '',
  customPduType: table.custom_pdu_type || undefined,
  position: table.position || undefined,
  customPosition: table.custom_position || undefined,
  includesHoist: table.includes_hoist || false,
  toolType: 'consumos',
  source: 'legacy-tour-default',
});

export const normalizeTourPowerOverride = (
  override: TourDatePowerOverrideRow,
  department: TechnicalPowerDepartment
): NormalizedTourPowerTable => ({
  id: override.id,
  name: override.table_name || 'Override',
  rows: getRows(override.override_data),
  totalWatts: override.total_watts || 0,
  totalVa: computePowerTotalVa(
    override.total_watts || 0,
    override.override_data,
    department
  ),
  currentPerPhase: override.current_per_phase || 0,
  pduType: override.pdu_type || '',
  customPduType: override.custom_pdu_type || undefined,
  position: override.position || undefined,
  customPosition: override.custom_position || undefined,
  includesHoist: override.includes_hoist || false,
  toolType: 'consumos',
  source: 'tour-override',
});

export const buildNormalizedTourPowerTables = ({
  department,
  overrides = [],
  defaultTables = [],
  legacyDefaults = [],
}: {
  department: TechnicalPowerDepartment;
  overrides?: TourDatePowerOverrideRow[];
  defaultTables?: TourDefaultTableRow[];
  legacyDefaults?: TourPowerDefaultRow[];
}) => {
  if (overrides.length > 0) {
    return {
      tables: overrides.map((override) => normalizeTourPowerOverride(override, department)),
      safetyMargin: getPowerSafetyMarginFromOverride(overrides[0]),
    };
  }

  if (defaultTables.length > 0) {
    const sortedDefaults = sortTourPowerDefaultTables(defaultTables);

    return {
      tables: sortedDefaults.map((table) => normalizeTourDefaultPowerTable(table, department)),
      safetyMargin: getPowerSafetyMarginFromDefaultTable(sortedDefaults[0]),
    };
  }

  return {
    tables: legacyDefaults.map((table) => normalizeLegacyTourPowerDefault(table, department)),
    safetyMargin: 0,
  };
};
