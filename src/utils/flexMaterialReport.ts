import { dataLayerClient } from "@/services/dataLayerClient";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";

export interface FlexMaterialReportResult {
  url: string;
  fileName: string;
  elementId: string;
  folderType: string | null;
  elementValidated: boolean;
  elementJobMismatch: boolean;
  reportType: FlexMaterialReportType;
}

export type FlexMaterialReportDepartment = "sound" | "lights" | "video" | "production";
export type FlexMaterialReportType = "material-list" | "quote";

/**
 * Resolves the job's Flex quote (flex_folders.element_id) for the given department
 * and fetches Flex's own "Listado de Material" report, persisting it into
 * job_documents (calculators/lista-material) so it's picked up by the same
 * stage-aware auto-fill lookup as Pesos/Consumos/SV Report.
 */
export const fetchFlexMaterialReport = async (
  jobId: string,
  department: FlexMaterialReportDepartment,
  overrideElementId?: string,
  stage?: TechnicalStage | null,
  reportType: FlexMaterialReportType = "material-list"
): Promise<FlexMaterialReportResult> => {
  const { data, error } = await dataLayerClient.functions.invoke("fetch-flex-material-report", {
    body: {
      jobId,
      department,
      overrideElementId: overrideElementId || undefined,
      reportType,
      stageNumber: stage?.number,
      stageName: stage?.name,
    },
  });

  if (error) {
    throw new Error(error.message || "No se pudo obtener la lista de material de Flex");
  }

  return data as FlexMaterialReportResult;
};
