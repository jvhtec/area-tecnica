import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { aggregatePowerCalculations } from '@/features/technical-tools/power/powerAggregation';
import {
  POWER_CALCULATION_VERSION,
  type PhaseMode,
  type PowerTableRow,
} from '@/features/technical-tools/power/types';
import {
  buildNormalizedTourPowerTables,
  computePowerTotalVa,
} from '@/utils/tourPowerTables';
import { getResolvedPowerPosition } from '@/utils/powerPositions';
import {
  getCurrentPowerRequirementTables,
  getPowerRequirementStageName,
  getPowerRequirementStageNumber,
} from '@/utils/powerRequirementSelection';
export {
  formatPowerRequirementsText,
  getCurrentPowerRequirementTables,
} from '@/utils/powerRequirementSelection';
import {
  TECHNICAL_POWER_DEPARTMENTS,
  type CombinedTechnicalPowerSummaryData,
  type DepartmentPowerSummaryData,
  type DepartmentPowerSummaryRow,
  type TechnicalPowerSummaryAvailability,
  type TechnicalPowerDepartment,
  normalizeTechnicalPowerDepartments,
} from '@/utils/technicalPowerTypes';
import {
  getDepartmentPackageSize,
  isPackageDepartment,
  resolveDefaultSetForTourDate,
  type TourPackageDateLike,
} from '@/utils/tourPackages';

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
  const aggregation = aggregatePowerCalculations(rows);
  const rowMargins = [...new Set(rows.map((row) => row.calculation?.safetyMargin))]
    .filter((margin): margin is number => margin !== undefined);

  return {
    department,
    rows,
    safetyMargin: rowMargins.length === 1
      ? rowMargins[0]
      : rows.length ? null : safetyMargin ?? null,
    totalWatts: aggregation.totalWatts,
    totalAmps: aggregation.currentLine,
    totalKva: aggregation.totalVa === null ? null : aggregation.totalVa / 1000,
    aggregationReason: aggregation.reason,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DEPARTMENT_POWER_FACTOR: Record<TechnicalPowerDepartment, number> = {
  sound: 0.95,
  lights: 0.9,
  video: 0.9,
};

const getJobPowerCalculation = (
  row: PowerRequirementTableRow,
  department: TechnicalPowerDepartment,
) => {
  const data = isRecord(row.table_data) ? row.table_data : {};
  const phaseMode: PhaseMode = data.phaseMode === 'single' ? 'single' : 'three';
  const rows = Array.isArray(data.rows)
    ? (data.rows.filter(isRecord) as unknown as PowerTableRow[])
    : [];
  const storedPf =
    typeof data.pf === 'number' && data.pf > 0 && data.pf <= 1
      ? data.pf
      : DEPARTMENT_POWER_FACTOR[department];
  const safetyMargin = typeof data.safetyMargin === 'number'
    ? Math.min(Math.max(data.safetyMargin, 0), 100)
    : 0;
  const voltage = typeof data.voltage === 'number' && data.voltage > 0
    ? data.voltage
    : phaseMode === 'single' ? 230 : 400;
  const totalWatts = row.total_watts || 0;
  const adjustedWatts = totalWatts * (1 + safetyMargin / 100);
  const totalVa = computePowerTotalVa(totalWatts, data, department, rows);
  return {
    version: POWER_CALCULATION_VERSION,
    totalWatts,
    adjustedWatts,
    totalVa,
    currentLine: totalVa / ((phaseMode === 'single' ? 1 : Math.sqrt(3)) * voltage),
    safetyMargin,
    phaseMode,
    voltage,
    ...(department === 'lights' && rows.length ? {} : { powerFactor: storedPf }),
    powerFactorSource: department === 'lights' && rows.length ? 'per-row' as const : 'legacy-default' as const,
    isEstimate: true,
  };
};

const buildPowerRowNotes = (includesHoist: boolean, isEstimate: boolean) => [
  includesHoist ? 'Motor auxiliar CEE32A 3P+N+G excluido de totales' : '',
  isEstimate ? 'Cálculo estimado' : '',
].filter(Boolean).join(' · ');

const mapPowerRequirementTable = (
  row: PowerRequirementTableRow,
  department: TechnicalPowerDepartment,
): DepartmentPowerSummaryRow => {
  const calculation = getJobPowerCalculation(row, department);
  const pduLabel = row.custom_pdu_type || row.pdu_type || 'N/A';

  return {
    name: row.table_name || 'Unnamed',
    stageName: getPowerRequirementStageName(row),
    stageNumber: getPowerRequirementStageNumber(row),
    pduLabel,
    positionLabel: getResolvedPowerPosition(row.position, row.custom_position) || 'N/A',
    totalWatts: calculation.totalWatts,
    currentPerPhase: calculation.currentLine,
    totalVa: calculation.totalVa,
    calculation,
    notes: buildPowerRowNotes(row.includes_hoist, calculation.isEstimate),
    source: 'job',
  };
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
  calculation: table.calculation,
  notes: buildPowerRowNotes(table.includesHoist, table.calculation.isEstimate),
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
    .in('department', [...TECHNICAL_POWER_DEPARTMENTS])
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const rowsByDepartment = Object.fromEntries(
    TECHNICAL_POWER_DEPARTMENTS.map((department) => [department, [] as PowerRequirementTableRow[]])
  ) as Record<TechnicalPowerDepartment, PowerRequirementTableRow[]>;

  for (const row of getCurrentPowerRequirementTables(data || [])) {
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

  const { data: tourDateRows, error: tourDateError } = await supabase
    .from('tour_dates')
    .select(`
      id,
      tour_id,
      is_tour_pack_only,
      sound_package_size,
      lights_package_size,
      video_package_size,
      sound_default_set_id,
      lights_default_set_id,
      video_default_set_id
    `)
    .eq('id', tourDateId);

  if (tourDateError) throw tourDateError;

  const tourDate =
    (tourDateRows?.[0] as TourPackageDateLike | undefined) ||
    (resolvedTourId ? ({ tour_id: resolvedTourId } satisfies TourPackageDateLike) : null);

  if (!resolvedTourId) {
    resolvedTourId =
      (tourDate as Pick<TourDateRow, 'tour_id'> | null | undefined)?.tour_id || null;
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
      : { data: [] as TourDefaultTableRow[], error: null as null };

  if (defaultTablesResponse.error) throw defaultTablesResponse.error;

  return {
    overrides: overridesResponse.data || [],
    legacyDefaults: legacyDefaultsResponse.data || [],
    defaultSets: defaultSetsResponse.data || [],
    defaultTables: defaultTablesResponse.data || [],
    tourDate,
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
    { overrides, legacyDefaults, defaultSets, defaultTables, tourDate },
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

      const resolvedDefaultSet =
        tourDate && isPackageDepartment(department)
          ? resolveDefaultSetForTourDate({
              tourDate,
              department,
              defaultSets,
            })
          : null;

      const departmentDefaultTables =
        resolvedDefaultSet?.status === 'resolved'
          ? (defaultTables.filter((table) => table.set_id === resolvedDefaultSet.set.id) as TourDefaultTableRow[])
          : [];

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

      const hasPackageIntent =
        tourDate && isPackageDepartment(department)
          ? Boolean(getDepartmentPackageSize(tourDate, department))
          : false;
      const hasResolvedPackageDefaults =
        hasPackageIntent && departmentDefaultTables.length > 0;
      const jobSpecificSummary = jobSpecificDepartments[department];

      // Package-bound tour dates must keep following their resolved defaults.
      // Intentional date-specific changes are stored as overrides and returned
      // above; legacy job snapshots are only a fallback when no package default
      // can currently be resolved.
      if (jobSpecificSummary.rows.length > 0 && !hasResolvedPackageDefaults) {
        return [department, jobSpecificSummary];
      }

      const canUseLegacyDefaults =
        departmentDefaultTables.length === 0 &&
        !hasPackageIntent &&
        (!resolvedDefaultSet ||
          resolvedDefaultSet.status === 'missing' ||
          resolvedDefaultSet.status === 'resolved');

      const normalized = buildNormalizedTourPowerTables({
        department,
        defaultTables: departmentDefaultTables,
        legacyDefaults: canUseLegacyDefaults ? departmentLegacyDefaults : [],
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
  const allRows = TECHNICAL_POWER_DEPARTMENTS.flatMap(
    (department) => safeDepartments[department].rows,
  );
  const systemAggregation = aggregatePowerCalculations(allRows);

  return {
    departments: safeDepartments,
    totalSystemWatts: systemAggregation.totalWatts,
    totalSystemAmps: systemAggregation.currentLine,
    totalSystemKva:
      systemAggregation.totalVa === null ? null : systemAggregation.totalVa / 1000,
    aggregationReason: systemAggregation.reason,
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
