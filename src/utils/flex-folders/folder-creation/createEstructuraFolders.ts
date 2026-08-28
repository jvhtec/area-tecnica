import {
  ESTRUCTURA_DEPARTMENT,
  ESTRUCTURA_PULL_SHEETS,
  ESTRUCTURA_SOURCE_DEPARTMENTS,
  type EstructuraSourceDepartment,
} from "@/domain/estructura";
import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "@/utils/flex-folders/api";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "@/utils/flex-folders/constants";
import type { FlexFolderRow } from "@/utils/flex-folders/folder-creation/types";

type EnsureEstructuraFoldersArgs = {
  jobId: string;
  tourDateId?: string | null;
  parentElementId: string;
  parentTrackingId: string | null;
  existingDepartmentFolder?: FlexFolderRow;
  existingPullSheets: Map<EstructuraSourceDepartment, FlexFolderRow>;
  departmentFolderName: string;
  pullSheetNamePrefix: string;
  documentNumber: string;
  plannedStartDate: string;
  plannedEndDate: string;
};

export async function ensureEstructuraFolders({
  jobId,
  tourDateId = null,
  parentElementId,
  parentTrackingId,
  existingDepartmentFolder,
  existingPullSheets,
  departmentFolderName,
  pullSheetNamePrefix,
  documentNumber,
  plannedStartDate,
  plannedEndDate,
}: EnsureEstructuraFoldersArgs): Promise<FlexFolderRow> {
  let departmentFolder = existingDepartmentFolder;

  if (!departmentFolder?.element_id) {
    const created = await createFlexFolder({
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId,
      open: true,
      locked: false,
      name: departmentFolderName,
      plannedStartDate,
      plannedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS.estructura,
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES.estructura}`,
      personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
    });

    const { data, error } = await supabase
      .from("flex_folders")
      .insert({
        job_id: jobId,
        tour_date_id: tourDateId,
        parent_id: parentTrackingId,
        element_id: created.elementId,
        department: ESTRUCTURA_DEPARTMENT,
        folder_type: tourDateId ? "tourdate" : "department",
      })
      .select("id, element_id, parent_id, folder_type, department, source_department")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to persist Estructura folder for job ${jobId} (element_id: ${created.elementId}): ${error?.message ?? "missing row"}`,
      );
    }
    departmentFolder = data as FlexFolderRow;
  }

  for (const sourceDepartment of ESTRUCTURA_SOURCE_DEPARTMENTS) {
    if (existingPullSheets.has(sourceDepartment)) continue;

    const config = ESTRUCTURA_PULL_SHEETS[sourceDepartment];
    const created = await createFlexFolder({
      definitionId: FLEX_FOLDER_IDS.pullSheet,
      parentElementId: departmentFolder.element_id,
      open: true,
      locked: false,
      name: `${pullSheetNamePrefix} - ${config.nameSuffix}`,
      plannedStartDate,
      plannedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS.estructura,
      documentNumber: `${documentNumber}${config.documentSuffix}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[sourceDepartment],
    });

    const { data, error } = await supabase
      .from("flex_folders")
      .insert({
        job_id: jobId,
        tour_date_id: tourDateId,
        parent_id: departmentFolder.id,
        element_id: created.elementId,
        department: ESTRUCTURA_DEPARTMENT,
        folder_type: "pull_sheet",
        source_department: sourceDepartment,
      })
      .select("id, element_id, parent_id, folder_type, department, source_department")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to persist Estructura ${config.label} pull sheet for job ${jobId} (element_id: ${created.elementId}): ${error?.message ?? "missing row"}`,
      );
    }
    existingPullSheets.set(sourceDepartment, data as FlexFolderRow);
  }

  return departmentFolder;
}
