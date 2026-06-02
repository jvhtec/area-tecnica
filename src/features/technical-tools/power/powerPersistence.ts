import type { Json } from "@/integrations/supabase/types";
import type { supabase as typedSupabase } from "@/integrations/supabase/client";
import type {
  PowerElectricalSettings,
  PowerTable,
  TechnicalDepartment,
} from "@/features/technical-tools/power/types";

type PowerPersistenceClient = Pick<typeof typedSupabase, "from">;

export const getPowerReportUploadCategory = (department: TechnicalDepartment) =>
  department === "lights" ? "calculators/lights-consumos" : "calculators/consumos";

export const buildPowerTableData = (table: PowerTable, settings: PowerElectricalSettings & { powerFactor?: number }) => {
  const payload = {
    rows: table.rows,
    ...(table.id !== undefined ? { sourceTableId: String(table.id) } : {}),
    safetyMargin: settings.safetyMargin,
    phaseMode: settings.phaseMode,
    voltage: settings.voltage,
    ...(settings.powerFactor !== undefined ? { pf: settings.powerFactor } : {}),
  };

  return payload as unknown as Json;
};

export const buildPowerTableMetadata = (
  table: PowerTable,
  settings: PowerElectricalSettings & { orderIndex?: number; powerFactor?: number },
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
  }) as unknown as Json;

export const buildPowerRequirementInsert = ({
  department,
  jobId,
  settings,
  table,
}: {
  department: TechnicalDepartment;
  jobId: string;
  settings?: PowerElectricalSettings & { powerFactor?: number };
  table: PowerTable;
}) => ({
  job_id: jobId,
  department,
  table_name: table.name,
  total_watts: table.totalWatts || 0,
  current_per_phase: table.currentPerPhase || 0,
  pdu_type: table.customPduType || table.pduType || "",
  custom_pdu_type: table.customPduType,
  position: table.position || null,
  custom_position: table.customPosition || null,
  table_data: (settings ? buildPowerTableData(table, settings) : ({ rows: table.rows } as unknown as Json)),
  includes_hoist: table.includesHoist || false,
});

export const saveJobPowerRequirementTable = async ({
  client,
  department,
  jobId,
  settings,
  table,
}: {
  client: PowerPersistenceClient;
  department: TechnicalDepartment;
  jobId: string;
  settings?: PowerElectricalSettings & { powerFactor?: number };
  table: PowerTable;
}): Promise<string> => {
  const payload = buildPowerRequirementInsert({
    department,
    jobId,
    settings,
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
  settings: PowerElectricalSettings & { powerFactor?: number };
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

export const uploadPowerReportAndCompleteTask = async ({
  department,
  fileName,
  jobId,
  pdfBlob,
}: {
  department: TechnicalDepartment;
  fileName: string;
  jobId: string;
  pdfBlob: Blob;
}) => {
  const { uploadJobPdfWithCleanup } = await import("@/utils/jobDocumentsUpload");
  await uploadJobPdfWithCleanup(jobId, pdfBlob, fileName, getPowerReportUploadCategory(department));

  try {
    const { autoCompleteConsumosTasks } = await import("@/utils/taskAutoCompletion");
    const result = await autoCompleteConsumosTasks(jobId, department);

    return result.completedCount;
  } catch (error) {
    console.warn("Task auto-completion failed:", error);
    return 0;
  }
};
