import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import {
  buildNormalizedTourPowerTables,
  computePowerTotalVa,
} from '@/utils/tourPowerTables';
import { getResolvedPowerPosition } from '@/utils/powerPositions';
import {
  TECHNICAL_POWER_DEPARTMENTS,
  type CombinedTechnicalPowerSummaryData,
  type DepartmentPowerSummaryData,
  type DepartmentPowerSummaryRow,
  type TechnicalPowerSummaryAvailability,
  type TechnicalPowerDepartment,
  normalizeTechnicalPowerDepartments,
} from '@/utils/technicalPowerTypes';

type TypedSupabaseClient = SupabaseClient<Database>;
type PowerRequirementTableRow = Database['public']['Tables']['power_requirement_tables']['Row'];
type TourDateRow = Database['public']['Tables']['tour_dates']['Row'];
type TourDefaultSetRow = Database['public']['Tables']['tour_default_sets']['Row'];
type TourDefaultTableRow = Database['public']['Tables']['tour_default_tables']['Row'];
type TourPowerDefaultRow = Database['public']['Tables']['tour_power_defaults']['Row'];
type TourDatePowerOverrideRow = Database['public']['Tables']['tour_date_power_overrides']['Row'];

export interface TechnicalPowerSummaryJob {
  id: string;
  job_type?: string | null;
  tour_id?: string | null;
  tour_date_id?: string | null;
}

const createEmptyDepartmentSummary = (
  department: TechnicalPowerDepartment
): DepartmentPowerSummaryData => ({
  department,
  rows: [],
  safetyMargin: null,
  totalWatts: 0,
  totalAmps: 0,
  totalKva: 0,
});

const buildDepartmentSummary = ({
  department,
  rows,
  safetyMargin,
}: {
  department: TechnicalPowerDepartment;
  rows: DepartmentPowerSummaryRow[];
  safetyMargin?: number | null;
}): DepartmentPowerSummaryData => {
  const totalWatts = rows.reduce((sum, row) => sum + row.totalWatts, 0);
  const totalAmps = rows.reduce((sum, row) => sum + row.currentPerPhase, 0);
  const totalKva = rows.reduce((sum, row) => sum + row.totalVa, 0) / 1000;

  return {
    department,
    rows,
    safetyMargin: safetyMargin ?? null,
    totalWatts,
    totalAmps,
    totalKva,
  };
};

const mapPowerRequirementTable = (
  row: PowerRequirementTableRow,
  department: TechnicalPowerDepartment
): DepartmentPowerSummaryRow => ({
  name: row.table_name || 'Unnamed',
  pduLabel: row.custom_pdu_type || row.pdu_type || 'N/A',
  positionLabel: getResolvedPowerPosition(row.position, row.custom_position) || 'N/A',
  totalWatts: row.total_watts || 0,
  currentPerPhase: row.current_per_phase || 0,
  totalVa: computePowerTotalVa(row.total_watts || 0, null, department),
  notes: row.includes_hoist ? 'Motor adicional CEE32A 3P+N+G' : '',
  source: 'job',
});

const getPowerRequirementTableDedupKey = (
  row: PowerRequirementTableRow,
  department: TechnicalPowerDepartment
) => {
  const normalizedName = row.table_name?.trim().toLowerCase();
  return normalizedName
    ? `${department}:${normalizedName}`
    : `${department}:${row.id}`;
};

const dedupePowerRequirementTables = (
  rows: PowerRequirementTableRow[]
): PowerRequirementTableRow[] => {
  const latestRows = new Map<string, PowerRequirementTableRow>();

  for (const row of rows) {
    const department = row.department as TechnicalPowerDepartment | null;
    if (!department) continue;

    const dedupKey = getPowerRequirementTableDedupKey(row, department);
    const current = latestRows.get(dedupKey);
    const currentTimestamp = current?.created_at ? Date.parse(current.created_at) : 0;
    const nextTimestamp = row.created_at ? Date.parse(row.created_at) : 0;

    if (!current || nextTimestamp >= currentTimestamp) {
      latestRows.set(dedupKey, row);
    }
  }

  return [...latestRows.values()];
};

const mapNormalizedTourPowerTable = (
  table: ReturnType<typeof buildNormalizedTourPowerTables>['tables'][number]
): DepartmentPowerSummaryRow => ({
  name: table.name,
  pduLabel: table.customPduType || table.pduType || 'N/A',
  positionLabel: getResolvedPowerPosition(table.position, table.customPosition) || 'N/A',
  totalWatts: table.totalWatts || 0,
  currentPerPhase: table.currentPerPhase || 0,
  totalVa: table.totalVa || 0,
  notes: table.includesHoist ? 'Motor adicional CEE32A 3P+N+G' : '',
  source: table.source,
});

const isMatchingLegacyPowerDefaultDepartment = (
  department: TechnicalPowerDepartment,
  rowDepartment: string | null
) => rowDepartment === department || (rowDepartment === null && department === 'sound');

const loadStandardJobPowerData = async ({
  jobId,
  supabase,
}: {
  jobId: string;
  supabase: TypedSupabaseClient;
}) => {
  const { data, error } = await supabase
    .from('power_requirement_tables')
    .select('*')
    .eq('job_id', jobId)
    .in('department', [...TECHNICAL_POWER_DEPARTMENTS]);

  if (error) {
    throw error;
  }

  const rowsByDepartment = Object.fromEntries(
    TECHNICAL_POWER_DEPARTMENTS.map((department) => [department, [] as PowerRequirementTableRow[]])
  ) as Record<TechnicalPowerDepartment, PowerRequirementTableRow[]>;

  for (const row of dedupePowerRequirementTables(data || [])) {
    const department = row.department as TechnicalPowerDepartment | null;
    if (!department || !(department in rowsByDepartment)) continue;
    rowsByDepartment[department].push(row);
  }

  return Object.fromEntries(
    TECHNICAL_POWER_DEPARTMENTS.map((department) => [
      department,
      buildDepartmentSummary({
        department,
        rows: rowsByDepartment[department].map((row) =>
          mapPowerRequirementTable(row, department)
        ),
      }),
    ])
  ) as Record<TechnicalPowerDepartment, DepartmentPowerSummaryData>;
};

const loadTourdateReferenceData = async ({
  tourId,
  tourDateId,
  supabase,
}: {
  tourId: string | null | undefined;
  tourDateId: string;
  supabase: TypedSupabaseClient;
}) => {
  let resolvedTourId = tourId || null;

  if (!resolvedTourId) {
    const { data: tourDateRows, error: tourDateError } = await supabase
      .from('tour_dates')
      .select('tour_id')
      .eq('id', tourDateId);

    if (tourDateError) throw tourDateError;

    resolvedTourId =
      (tourDateRows?.[0] as Pick<TourDateRow, 'tour_id'> | undefined)?.tour_id ||
      null;
  }

  const [
    overridesResponse,
    legacyDefaultsResponse,
    defaultSetsResponse,
  ] = await Promise.all([
    supabase
      .from('tour_date_power_overrides')
      .select('*')
      .eq('tour_date_id', tourDateId)
      .in('department', [...TECHNICAL_POWER_DEPARTMENTS]),
    resolvedTourId
      ? supabase
          .from('tour_power_defaults')
          .select('*')
          .eq('tour_id', resolvedTourId)
      : Promise.resolve({ data: [] as TourPowerDefaultRow[], error: null }),
    resolvedTourId
      ? supabase
          .from('tour_default_sets')
          .select('*')
          .eq('tour_id', resolvedTourId)
          .in('department', [...TECHNICAL_POWER_DEPARTMENTS])
      : Promise.resolve({ data: [] as TourDefaultSetRow[], error: null }),
  ]);

  if (overridesResponse.error) throw overridesResponse.error;
  if (legacyDefaultsResponse.error) throw legacyDefaultsResponse.error;
  if (defaultSetsResponse.error) throw defaultSetsResponse.error;

  const defaultSetIds = (defaultSetsResponse.data || []).map((set) => set.id);
  const defaultTablesResponse =
    defaultSetIds.length > 0
      ? await supabase
          .from('tour_default_tables')
          .select('*')
          .in('set_id', defaultSetIds)
          .eq('table_type', 'power')
      : { data: [] as TourDefaultTableRow[], error: null };

  if (defaultTablesResponse.error) throw defaultTablesResponse.error;

  return {
    overrides: overridesResponse.data || [],
    legacyDefaults: legacyDefaultsResponse.data || [],
    defaultSets: defaultSetsResponse.data || [],
    defaultTables: defaultTablesResponse.data || [],
  };
};

const loadTourdatePowerData = async ({
  job,
  supabase,
}: {
  job: TechnicalPowerSummaryJob;
  supabase: TypedSupabaseClient;
}) => {
  const [
    { overrides, legacyDefaults, defaultSets, defaultTables },
    jobSpecificDepartments,
  ] = await Promise.all([
    loadTourdateReferenceData({
      tourId: job.tour_id,
      tourDateId: job.tour_date_id!,
      supabase,
    }),
    loadStandardJobPowerData({ jobId: job.id, supabase }),
  ]);

  return Object.fromEntries(
    TECHNICAL_POWER_DEPARTMENTS.map((department) => {
      const departmentOverrides = overrides.filter(
        (row) => row.department === department
      ) as TourDatePowerOverrideRow[];

      const departmentSetIds = defaultSets
        .filter((set) => set.department === department)
        .map((set) => set.id);

      const departmentDefaultTables = defaultTables.filter((table) =>
        departmentSetIds.includes(table.set_id)
      ) as TourDefaultTableRow[];

      const departmentLegacyDefaults = legacyDefaults.filter(
        (row) => isMatchingLegacyPowerDefaultDepartment(department, row.department)
      ) as TourPowerDefaultRow[];

      if (departmentOverrides.length > 0) {
        const normalizedOverrides = buildNormalizedTourPowerTables({
          department,
          overrides: departmentOverrides,
        });

        return [
          department,
          buildDepartmentSummary({
            department,
            rows: normalizedOverrides.tables.map(mapNormalizedTourPowerTable),
            safetyMargin: normalizedOverrides.safetyMargin,
          }),
        ];
      }

      const jobSpecificSummary = jobSpecificDepartments[department];
      if (jobSpecificSummary.rows.length > 0) {
        return [department, jobSpecificSummary];
      }

      const normalized = buildNormalizedTourPowerTables({
        department,
        defaultTables: departmentDefaultTables,
        legacyDefaults: departmentLegacyDefaults,
      });

      return [
        department,
        buildDepartmentSummary({
          department,
          rows: normalized.tables.map(mapNormalizedTourPowerTable),
          safetyMargin: normalized.safetyMargin,
        }),
      ];
    })
  ) as Record<TechnicalPowerDepartment, DepartmentPowerSummaryData>;
};

export const loadTechnicalPowerSummaryData = async ({
  job,
  supabase,
}: {
  job: TechnicalPowerSummaryJob;
  supabase: TypedSupabaseClient;
}): Promise<CombinedTechnicalPowerSummaryData> => {
  const departments =
    job.job_type === 'tourdate' && job.tour_date_id
      ? await loadTourdatePowerData({ job, supabase })
      : await loadStandardJobPowerData({ jobId: job.id, supabase });

  const safeDepartments = Object.fromEntries(
    TECHNICAL_POWER_DEPARTMENTS.map((department) => [
      department,
      departments[department] || createEmptyDepartmentSummary(department),
    ])
  ) as Record<TechnicalPowerDepartment, DepartmentPowerSummaryData>;

  return {
    departments: safeDepartments,
    totalSystemWatts: TECHNICAL_POWER_DEPARTMENTS.reduce(
      (sum, department) => sum + safeDepartments[department].totalWatts,
      0
    ),
    totalSystemAmps: TECHNICAL_POWER_DEPARTMENTS.reduce(
      (sum, department) => sum + safeDepartments[department].totalAmps,
      0
    ),
    totalSystemKva: TECHNICAL_POWER_DEPARTMENTS.reduce(
      (sum, department) => sum + safeDepartments[department].totalKva,
      0
    ),
  };
};

export const getTechnicalPowerSummaryAvailability = (
  summary: CombinedTechnicalPowerSummaryData,
  requiredDepartments: readonly TechnicalPowerDepartment[] = TECHNICAL_POWER_DEPARTMENTS
): TechnicalPowerSummaryAvailability => {
  const normalizedRequiredDepartments = normalizeTechnicalPowerDepartments(requiredDepartments);
  const departmentsToCheck =
    normalizedRequiredDepartments.length > 0
      ? normalizedRequiredDepartments
      : [...TECHNICAL_POWER_DEPARTMENTS];

  const availableDepartments = departmentsToCheck.filter(
    (department) => (summary.departments[department]?.rows.length || 0) > 0
  );

  return {
    ready:
      departmentsToCheck.length > 0 &&
      availableDepartments.length === departmentsToCheck.length,
    requiredDepartments: departmentsToCheck,
    availableDepartments,
    missingDepartments: departmentsToCheck.filter(
      (department) => !availableDepartments.includes(department)
    ),
  };
};
