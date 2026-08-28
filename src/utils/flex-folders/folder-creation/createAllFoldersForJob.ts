import { supabase } from "@/integrations/supabase/client";
import type { CreateFoldersOptions } from "@/utils/flex-folders/types";

import { createDryhireFolders } from "@/utils/flex-folders/folder-creation/createDryhireFolders";
import { createStandardJobFolders } from "@/utils/flex-folders/folder-creation/createStandardJobFolders";
import { createTourdateFolders } from "@/utils/flex-folders/folder-creation/createTourdateFolders";
import type { FlexFolderJob, FlexFolderRow } from "@/utils/flex-folders/folder-creation/types";
import {
  ESTRUCTURA_DEPARTMENT,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
  type EstructuraSourceDepartment,
} from "@/domain/estructura";

const buildExistingFolderMaps = (existingFolders: FlexFolderRow[] | null | undefined) => {
  const existingDepartmentMap = new Map<string, FlexFolderRow>();
  const existingWorkOrderMap = new Map<string, FlexFolderRow>();
  const existingTourDateDepartmentMap = new Map<string, FlexFolderRow>();
  const existingEstructuraPullSheetMap = new Map<EstructuraSourceDepartment, FlexFolderRow>();

  for (const folder of existingFolders ?? []) {
    if (folder.folder_type === "department" && folder.department) {
      existingDepartmentMap.set(folder.department, folder);
    }
    if (folder.folder_type === "work_orders" && folder.department) {
      existingWorkOrderMap.set(folder.department, folder);
    }
    if (folder.folder_type === "tourdate" && folder.department) {
      existingTourDateDepartmentMap.set(folder.department, folder);
    }
    if (
      folder.folder_type === "pull_sheet" &&
      folder.department === ESTRUCTURA_DEPARTMENT &&
      folder.source_department &&
      ESTRUCTURA_SOURCE_DEPARTMENTS.includes(folder.source_department)
    ) {
      existingEstructuraPullSheetMap.set(folder.source_department, folder);
    }
  }

  return {
    existingDepartmentMap,
    existingEstructuraPullSheetMap,
    existingTourDateDepartmentMap,
    existingWorkOrderMap,
  };
};

/**
 * Creates all necessary folders in Flex for a job.
 */
export async function createAllFoldersForJob(
  job: FlexFolderJob,
  formattedStartDate: string,
  formattedEndDate: string,
  documentNumber: string,
  options?: CreateFoldersOptions
) {
  const { data: existingFolders, error: existingFoldersError } = await supabase
    .from("flex_folders")
    .select("id, element_id, parent_id, folder_type, department, source_department")
    .eq("job_id", job.id);

  if (existingFoldersError) {
    console.error("Failed to load existing Flex folders:", existingFoldersError);
    throw existingFoldersError;
  }

  const typedExistingFolders = (existingFolders ?? []) as FlexFolderRow[];
  const existingMainFolder =
    typedExistingFolders.find((folder) => folder.folder_type === "main_event") ??
    typedExistingFolders.find((folder) => folder.folder_type === "main");
  const isLegacyMainFolder = existingMainFolder?.folder_type === "main";
  const {
    existingDepartmentMap,
    existingEstructuraPullSheetMap,
    existingTourDateDepartmentMap,
    existingWorkOrderMap,
  } = buildExistingFolderMaps(typedExistingFolders);

  if (isLegacyMainFolder) {
    existingDepartmentMap.clear();
    existingEstructuraPullSheetMap.clear();
    existingWorkOrderMap.clear();
  }

  const safeJobTitle = job?.title?.trim?.() || job?.title || "Sin título";

  if (job.job_type === "dryhire") {
    return createDryhireFolders({
      existingFolders: typedExistingFolders,
      job,
    });
  }

  if (job.job_type === "tourdate") {
    return createTourdateFolders({
      documentNumber,
      existingFolders: typedExistingFolders,
      existingEstructuraPullSheetMap,
      existingTourDateDepartmentMap,
      formattedEndDate,
      formattedStartDate,
      job,
      options,
      safeJobTitle,
    });
  }

  return createStandardJobFolders({
    documentNumber,
    existingDepartmentMap,
    existingEstructuraPullSheetMap,
    existingMainFolder,
    existingTourDateDepartmentMap,
    existingWorkOrderMap,
    formattedEndDate,
    formattedStartDate,
    isLegacyMainFolder,
    job,
    options,
    safeJobTitle,
  });
}
