import type { Json } from "@/integrations/supabase/types";
import type { supabase as typedSupabase } from "@/integrations/supabase/client";
import type {
  PowerElectricalSettings,
  PowerTable,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
import { getTechnicalStageStorageScope } from "@/features/technical-tools/stage/stageUtils";
import { getTechnicalPowerDepartmentFromDocument } from "@/utils/powerReportReadiness";

type PowerPersistenceClient = Pick<typeof typedSupabase, "from">;
type PowerRequirementInsertPayload = ReturnType<typeof buildPowerRequirementInsert>;
type PowerRequirementSettingsResolver =
  | (PowerElectricalSettings & { powerFactor?: number })
  | ((table: PowerTable) => PowerElectricalSettings & { powerFactor?: number });

type SavedPowerRequirementGenerationTable = {
  generationTimestamp: string;
  powerRequirementId: string;
  tableId?: PowerTable["id"];
};

export const getPowerReportUploadCategory = (department: TechnicalDepartment) =>
  department === "lights" ? "calculators/lights-consumos" : "calculators/consumos";

export const buildPowerTableData = (
  table: PowerTable,
  settings: PowerElectricalSettings & { powerFactor?: number },
  options: { generationTimestamp?: string } = {},
) => {
  const payload = {
    rows: table.rows,
    ...(table.id !== undefined ? { sourceTableId: String(table.id) } : {}),
    ...(options.generationTimestamp || table.generationTimestamp
      ? { generationTimestamp: options.generationTimestamp || table.generationTimestamp }
      : {}),
    ...(table.stageNumber ? { stageNumber: table.stageNumber } : {}),
    ...(table.stageName ? { stageName: table.stageName } : {}),
    safetyMargin: settings.safetyMargin,
    phaseMode: settings.phaseMode,
    voltage: settings.voltage,
    ...(settings.powerFactor !== undefined ? { pf: settings.powerFactor } : {}),
  };

  return payload as unknown as Json;
};

export const buildPowerTableMetadata = (
  table: PowerTable,
  settings: PowerElectricalSettings & {
    orderIndex?: number;
    powerFactor?: number;
    fohSchuko?: boolean;
  },
) =>
  ({
    current_per_phase: table.currentPerPhase,
    pdu_type: table.customPduType || table.pduType,
    custom_pdu_type: table.customPduType,
    position: table.position,
    custom_position: table.customPosition,
    includes_hoist: table.includesHoist || false,
    safetyMargin: settings.safetyMargin,
    phaseMode: settings.phaseMode,
    voltage: settings.voltage,
    ...(settings.powerFactor !== undefined ? { pf: settings.powerFactor } : {}),
    ...(settings.orderIndex !== undefined ? { order_index: settings.orderIndex } : {}),
    ...(settings.fohSchuko !== undefined ? { foh_schuko: settings.fohSchuko } : {}),
  }) as unknown as Json;

const getPowerTableStage = (
  table: PowerTable,
  stage?: TechnicalStage | null
): TechnicalStage | null => {
  if (stage) return stage;
  if (!table.stageNumber) return null;

  return {
    number: table.stageNumber,
    name: table.stageName || `Stage ${table.stageNumber}`,
  };
};

export const buildPowerRequirementInsert = ({
  department,
  generationTimestamp,
  jobId,
  settings,
  stage,
  table,
}: {
  department: TechnicalDepartment;
  generationTimestamp?: string;
  jobId: string;
  settings?: PowerElectricalSettings & { powerFactor?: number };
  stage?: TechnicalStage | null;
  table: PowerTable;
}) => {
  const tableStage = getPowerTableStage(table, stage);
  const resolvedGenerationTimestamp = generationTimestamp || table.generationTimestamp;

  return {
    ...(resolvedGenerationTimestamp ? { created_at: resolvedGenerationTimestamp } : {}),
    job_id: jobId,
    department,
    stage_number: tableStage?.number ?? null,
    stage_name: tableStage?.name ?? null,
    table_name: table.name,
    total_watts: table.totalWatts || 0,
    current_per_phase: table.currentPerPhase || 0,
    pdu_type: table.customPduType || table.pduType || "",
    custom_pdu_type: table.customPduType,
    position: table.position || null,
    custom_position: table.customPosition || null,
    table_data: (settings ? buildPowerTableData({
      ...table,
      generationTimestamp: resolvedGenerationTimestamp,
      stageName: tableStage?.name ?? table.stageName,
      stageNumber: tableStage?.number ?? table.stageNumber,
    }, settings, { generationTimestamp: resolvedGenerationTimestamp }) : ({
      rows: table.rows,
      ...(resolvedGenerationTimestamp ? { generationTimestamp: resolvedGenerationTimestamp } : {}),
      ...(tableStage ? { stageNumber: tableStage.number, stageName: tableStage.name } : {}),
    } as unknown as Json)),
    includes_hoist: table.includesHoist || false,
  };
};

const formatPostgrestInList = (values: string[]) =>
  `(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",")})`;

const deleteStalePowerRequirementGenerationRows = async ({
  client,
  department,
  keepIds,
  jobId,
  stageNumber,
}: {
  client: PowerPersistenceClient;
  department: TechnicalDepartment;
  keepIds: string[];
  jobId: string;
  stageNumber?: number | null;
}) => {
  let deleteQuery = client
    .from("power_requirement_tables")
    .delete()
    .eq("job_id", jobId)
    .eq("department", department);

  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not("id", "in", formatPostgrestInList(keepIds));
  }

  if (stageNumber !== undefined) {
    deleteQuery =
      stageNumber === null
        ? deleteQuery.is("stage_number", null)
        : deleteQuery.eq("stage_number", stageNumber);
  }

  const { error } = await deleteQuery;
  if (error) throw error;
};

const resolvePowerRequirementSettings = (
  settings: PowerRequirementSettingsResolver,
  table: PowerTable,
) => (typeof settings === "function" ? settings(table) : settings);

export const saveJobPowerRequirementTable = async ({
  client,
  department,
  generationTimestamp,
  jobId,
  settings,
  stage,
  table,
}: {
  client: PowerPersistenceClient;
  department: TechnicalDepartment;
  generationTimestamp?: string;
  jobId: string;
  settings?: PowerElectricalSettings & { powerFactor?: number };
  stage?: TechnicalStage | null;
  table: PowerTable;
}): Promise<string> => {
  const payload = buildPowerRequirementInsert({
    department,
    generationTimestamp,
    jobId,
    settings,
    stage,
    table,
  });

  if (table.powerRequirementId) {
    const { data, error } = await client
      .from("power_requirement_tables")
      .update(payload)
      .eq("id", table.powerRequirementId)
      .eq("job_id", jobId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;
  }

  const { data, error } = await client
    .from("power_requirement_tables")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
};

export const saveJobPowerRequirementTablesGeneration = async ({
  client,
  department,
  generationTimestamp = new Date().toISOString(),
  jobId,
  settings,
  stage,
  tables,
}: {
  client: PowerPersistenceClient;
  department: TechnicalDepartment;
  generationTimestamp?: string;
  jobId: string;
  settings: PowerRequirementSettingsResolver;
  stage?: TechnicalStage | null;
  tables: PowerTable[];
}): Promise<SavedPowerRequirementGenerationTable[]> => {
  if (tables.length === 0) {
    await deleteStalePowerRequirementGenerationRows({
      client,
      department,
      keepIds: [],
      jobId,
      stageNumber: stage?.number,
    });
    return [];
  }

  const payloads = tables.map((table) =>
    buildPowerRequirementInsert({
      department,
      generationTimestamp,
      jobId,
      settings: resolvePowerRequirementSettings(settings, table),
      stage,
      table,
    })
  );

  const { data, error } = await client
    .from("power_requirement_tables")
    .insert(payloads)
    .select("id, stage_number");

  if (error) throw error;

  const insertedRows = (data || []) as Array<{ id: string; stage_number: number | null }>;
  const savedTables = insertedRows.map((row, index) => ({
    generationTimestamp,
    powerRequirementId: row.id,
    tableId: tables[index]?.id,
  }));

  const keepIdsByStage = new Map<string, { ids: string[]; stageNumber: number | null }>();
  insertedRows.forEach((row, index) => {
    const stageNumber = typeof row.stage_number === "number"
      ? row.stage_number
      : payloads[index]?.stage_number ?? null;
    const stageKey = stageNumber === null ? "no-stage" : `stage-${stageNumber}`;
    const stageGroup = keepIdsByStage.get(stageKey) || { ids: [], stageNumber };
    stageGroup.ids.push(row.id);
    keepIdsByStage.set(stageKey, stageGroup);
  });

  await Promise.all(
    [...keepIdsByStage.values()].map((stageGroup) =>
      deleteStalePowerRequirementGenerationRows({
        client,
        department,
        keepIds: stageGroup.ids,
        jobId,
        stageNumber: stageGroup.stageNumber,
      })
    )
  );

  return savedTables;
};

export const deleteJobPowerRequirementTable = async ({
  client,
  jobId,
  table,
}: {
  client: PowerPersistenceClient;
  jobId: string;
  table: Pick<PowerTable, "powerRequirementId">;
}) => {
  if (!table.powerRequirementId) return;

  const { error } = await client
    .from("power_requirement_tables")
    .delete()
    .eq("id", table.powerRequirementId)
    .eq("job_id", jobId);

  if (error) throw error;
};

export const buildTourPowerDefaultTable = ({
  orderIndex,
  setId,
  settings,
  table,
}: {
  orderIndex?: number;
  setId: string;
  settings: PowerElectricalSettings & { powerFactor?: number; fohSchuko?: boolean };
  table: PowerTable;
}) => ({
  set_id: setId,
  table_name: table.name,
  table_data: buildPowerTableData(table, settings),
  table_type: "power" as const,
  total_value: table.totalWatts || 0,
  metadata: buildPowerTableMetadata(table, { ...settings, orderIndex }),
});

export const buildPowerOverridePayload = ({
  department,
  settings,
  table,
  tourDateId,
}: {
  department: TechnicalDepartment;
  settings: PowerElectricalSettings & { powerFactor?: number };
  table: PowerTable;
  tourDateId: string;
}) => ({
  tour_date_id: tourDateId,
  table_name: table.name,
  total_watts: table.totalWatts || 0,
  current_per_phase: table.currentPerPhase || 0,
  pdu_type: table.customPduType || table.pduType || "",
  custom_pdu_type: table.customPduType,
  position: table.position || null,
  custom_position: table.customPosition || null,
  includes_hoist: table.includesHoist || false,
  department,
  override_data: buildPowerTableData(table, settings),
});

export const buildLegacyPowerOverridePayload = ({
  settings,
  table,
}: {
  settings: PowerElectricalSettings & { powerFactor?: number };
  table: PowerTable;
}) => ({
  table_name: table.name,
  total_watts: table.totalWatts || 0,
  current_per_phase: table.currentPerPhase || 0,
  pdu_type: table.customPduType || table.pduType || "",
  custom_pdu_type: table.customPduType,
  position: table.position || null,
  custom_position: table.customPosition || null,
  includes_hoist: table.includesHoist || false,
  override_data: buildPowerTableData(table, settings),
});

/**
 * Sound and video Consumos PDFs share the calculators/consumos folder, so the
 * pre-upload cleanup must only delete the current department's previous
 * report. Reuses the same classifier the readers (Memoria auto-fill, power
 * report readiness) use, so what gets deleted matches what gets detected.
 */
export const buildPowerReportCleanupFilter = (department: TechnicalDepartment) => {
  return (candidate: { fileName: string; filePath: string }): boolean =>
    getTechnicalPowerDepartmentFromDocument({
      file_name: candidate.fileName,
      file_path: candidate.filePath,
      uploaded_at: null,
    }) === department;
};

export const uploadPowerReportAndCompleteTask = async ({
  department,
  fileName,
  jobId,
  pdfBlob,
  stage,
}: {
  department: TechnicalDepartment;
  fileName: string;
  jobId: string;
  pdfBlob: Blob;
  stage?: TechnicalStage | null;
}) => {
  const { uploadJobPdfWithCleanup } = await import("@/utils/jobDocumentsUpload");
  const cleanupScope = getTechnicalStageStorageScope(stage);
  const category = getPowerReportUploadCategory(department);

  await uploadJobPdfWithCleanup(jobId, pdfBlob, fileName, category, {
    ...(cleanupScope ? { cleanupScope } : {}),
    cleanupFilter: buildPowerReportCleanupFilter(department),
  });

  try {
    const { autoCompleteConsumosTasks } = await import("@/utils/taskAutoCompletion");
    const result = await autoCompleteConsumosTasks(jobId, department);

    return result.completedCount;
  } catch (error) {
    console.warn("Task auto-completion failed:", error);
    return 0;
  }
};
