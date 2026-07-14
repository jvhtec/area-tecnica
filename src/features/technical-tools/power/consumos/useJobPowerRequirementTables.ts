import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { queryKeys } from "@/lib/react-query";
import type {
  PhaseMode,
  PowerTable,
  PowerTableRow,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";
import { getVoltageForPhase } from "@/features/technical-tools/power/powerCalculations";
import {
  buildLegacyPowerCalculationSnapshot,
  parsePowerCalculationSnapshot,
} from "@/features/technical-tools/power/powerSnapshots";

type PowerRequirementTableData = {
  rows?: PowerTableRow[];
  safetyMargin?: number;
  phaseMode?: PhaseMode;
  voltage?: number;
  pf?: number;
  generationTimestamp?: string;
  stageNumber?: number;
  stageName?: string;
  calculation?: unknown;
  [key: string]: unknown;
};

export type PowerRequirementTableRow = {
  id: string;
  job_id: string;
  department: string;
  stage_number: number | null;
  stage_name: string | null;
  table_name: string;
  total_watts: number;
  current_per_phase: number;
  pdu_type: string;
  custom_pdu_type: string | null;
  position: string | null;
  custom_position: string | null;
  includes_hoist: boolean;
  table_data: PowerRequirementTableData | null;
  created_at: string;
};

export const jobPowerRequirementTablesQueryKey = (
  jobId: string,
  department: TechnicalDepartment,
) => queryKeys.scope("job-power-requirement-tables", jobId, department);

/**
 * Maps a persisted power_requirement_tables row back into an editable
 * PowerTable, restoring the electrical settings snapshotted at save time so
 * the table can be edited and re-saved without drifting values.
 */
export const mapPowerRequirementRowToTable = (
  row: PowerRequirementTableRow,
  options: {
    fallbackPowerFactor?: number;
    fallbackSafetyMargin: number;
    perRowPf: boolean;
  },
): PowerTable => {
  const data = row.table_data ?? {};
  const rows = Array.isArray(data.rows) ? data.rows : [];

  const safetyMargin =
    typeof data.safetyMargin === "number"
      ? data.safetyMargin
      : options.fallbackSafetyMargin;
  const phaseMode: PhaseMode = data.phaseMode === "single" ? "single" : "three";
  const voltage =
    typeof data.voltage === "number" ? data.voltage : getVoltageForPhase(phaseMode);
  const powerFactor = typeof data.pf === "number" ? data.pf : undefined;

  const storedCalculation = parsePowerCalculationSnapshot(data.calculation);
  const calculation =
    storedCalculation ??
    buildLegacyPowerCalculationSnapshot({
      fallbackPowerFactor:
        options.fallbackPowerFactor ?? (options.perRowPf ? 0.9 : powerFactor ?? 0.9),
      perRowPowerFactor: options.perRowPf,
      rows,
      settings: { safetyMargin, phaseMode, voltage, powerFactor },
      totalWatts: row.total_watts || 0,
    });
  return {
    id: row.id,
    powerRequirementId: row.id,
    generationTimestamp:
      typeof data.generationTimestamp === "string"
        ? data.generationTimestamp
        : row.created_at,
    name: row.table_name,
    rows,
    stageNumber: row.stage_number ?? data.stageNumber ?? null,
    stageName: row.stage_name ?? data.stageName ?? null,
    totalWatts: calculation.totalWatts,
    adjustedWatts: calculation.adjustedWatts,
    totalVa: calculation.totalVa,
    currentPerPhase: calculation.currentLine,
    calculation,
    pduType: row.pdu_type || "",
    customPduType: row.custom_pdu_type ?? undefined,
    position: row.position ?? undefined,
    customPosition: row.custom_position ?? undefined,
    includesHoist: row.includes_hoist || false,
  };
};

/**
 * Loads the saved power requirement set for a job/department so it can be
 * edited in the Consumos tool instead of starting from a blank slate.
 */
export const useJobPowerRequirementTables = ({
  department,
  enabled,
  jobId,
}: {
  department: TechnicalDepartment;
  enabled: boolean;
  jobId: string;
}) =>
  useQuery({
    queryKey: jobPowerRequirementTablesQueryKey(jobId, department),
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId)
        .eq("department", department)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as PowerRequirementTableRow[];
    },
    enabled: enabled && !!jobId,
  });
