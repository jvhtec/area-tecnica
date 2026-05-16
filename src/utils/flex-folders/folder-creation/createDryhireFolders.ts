import { supabase } from "@/lib/supabase";

import {
  createFlexFolder,
  deleteFlexFolder,
  updateFlexElementHeader,
} from "../api";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "../constants";
import { getDryhireParentFolderId } from "../dryhireFolderService";
import {
  getDryhireFlexSchedule,
  getErrorMessage,
} from "./helpers";
import type {
  DryhireCreatedElement,
  DryhireHeaderFields,
  FlexFolderJob,
  FlexFolderRow,
} from "./types";

type CreateDryhireFoldersArgs = {
  existingFolders: FlexFolderRow[] | null | undefined;
  job: FlexFolderJob;
};

const enforceDryhireHeaderFields = async ({
  label,
  elementId,
  documentNumber,
  plannedStartDate,
  plannedEndDate,
}: DryhireHeaderFields) => {
  if (!elementId) {
    throw new Error(`Flex dryhire ${label} creation returned no element ID`);
  }

  const fields = [
    { fieldType: "documentNumber", value: documentNumber },
    { fieldType: "plannedStartDate", value: plannedStartDate },
    { fieldType: "plannedEndDate", value: plannedEndDate },
  ];

  for (const field of fields) {
    try {
      await updateFlexElementHeader(elementId, field.fieldType, field.value);
    } catch (error) {
      console.error("Failed to enforce dryhire Flex header field:", {
        label,
        elementId,
        documentNumber,
        fieldType: field.fieldType,
        value: field.value,
        error,
      });
      throw new Error(
        `Failed to enforce dryhire ${label} ${field.fieldType} for element ${elementId} (${documentNumber}): ${getErrorMessage(error)}`
      );
    }
  }
};

const cleanupCreatedDryhireElements = async (elements: DryhireCreatedElement[]) => {
  const cleanupFailures: string[] = [];

  for (const element of elements) {
    if (!element.elementId) continue;

    try {
      await deleteFlexFolder(element.elementId);
      console.warn("Deleted dryhire Flex element after header enforcement failure:", element);
    } catch (error) {
      console.error("Failed to delete dryhire Flex element after header enforcement failure:", {
        ...element,
        error,
      });
      cleanupFailures.push(
        `${element.label} ${element.elementId} (${element.documentNumber}): ${getErrorMessage(error)}`
      );
    }
  }

  return cleanupFailures;
};

export const createDryhireFolders = async ({
  existingFolders,
  job,
}: CreateDryhireFoldersArgs) => {
  console.log("Dryhire job type detected. Creating dryhire folder...");

  const hasExistingDryhire = (existingFolders ?? []).some(
    (folder) => folder.folder_type === "dryhire"
  );

  if (hasExistingDryhire) {
    console.log("Dryhire Flex folder already exists. Skipping creation.");
    return;
  }

  if (!job.job_departments || job.job_departments.length === 0) {
    throw new Error("Missing job_departments for dryhire job");
  }

  const departmentCandidate = job.job_departments[0]?.department;
  if (departmentCandidate !== "sound" && departmentCandidate !== "lights") {
    throw new Error("Invalid department for dryhire job");
  }
  const department: "sound" | "lights" = departmentCandidate;

  const dryhireSchedule = getDryhireFlexSchedule(job);
  const { year, monthKey } = dryhireSchedule;
  const parentFolderId = await getDryhireParentFolderId(year, department, monthKey);

  if (!parentFolderId) {
    throw new Error(`No parent folder found for ${year}/${monthKey}. Please create dryhire folders for ${year} in Settings.`);
  }

  const parentDocumentNumber = `${dryhireSchedule.documentNumber}${DEPARTMENT_SUFFIXES[department]}`;
  const dryHireFolderPayload = {
    definitionId: FLEX_FOLDER_IDS.subFolder,
    parentElementId: parentFolderId,
    open: true,
    locked: false,
    name: `Dry Hire - ${job.title}`,
    plannedStartDate: dryhireSchedule.plannedStartDate,
    plannedEndDate: dryhireSchedule.plannedEndDate,
    locationId: FLEX_FOLDER_IDS.location,
    departmentId: DEPARTMENT_IDS[department],
    documentNumber: parentDocumentNumber,
    personResponsibleId: RESPONSIBLE_PERSON_IDS[department],
  };

  console.log("Creating dryhire folder with payload:", dryHireFolderPayload);
  const dryHireFolder = await createFlexFolder(dryHireFolderPayload);

  if (!dryHireFolder.elementId) {
    throw new Error("Flex dryhire folder creation returned no element ID");
  }

  const dryHireDocumentSuffix = department === "sound" ? "SDH" : "LDH";
  const dryHirePresupuestoDocumentNumber = `${dryhireSchedule.documentNumber}${dryHireDocumentSuffix}`;
  const presupuestoFolderPayload = {
    definitionId: FLEX_FOLDER_IDS.presupuestoDryHire,
    parentElementId: dryHireFolder.elementId,
    open: true,
    locked: false,
    name: dryHireFolderPayload.name,
    plannedStartDate: dryHireFolderPayload.plannedStartDate,
    plannedEndDate: dryHireFolderPayload.plannedEndDate,
    locationId: dryHireFolderPayload.locationId,
    departmentId: dryHireFolderPayload.departmentId,
    documentNumber: dryHirePresupuestoDocumentNumber,
    personResponsibleId: dryHireFolderPayload.personResponsibleId,
  };
  const presupuestoFolder = await createFlexFolder(presupuestoFolderPayload);

  const dryhireHeaderFields: DryhireHeaderFields = {
    label: "folder",
    elementId: dryHireFolder.elementId,
    documentNumber: dryHireFolderPayload.documentNumber,
    plannedStartDate: dryHireFolderPayload.plannedStartDate,
    plannedEndDate: dryHireFolderPayload.plannedEndDate,
  };
  const presupuestoHeaderFields: DryhireHeaderFields = {
    label: "presupuesto",
    elementId: presupuestoFolder.elementId,
    documentNumber: presupuestoFolderPayload.documentNumber,
    plannedStartDate: presupuestoFolderPayload.plannedStartDate,
    plannedEndDate: presupuestoFolderPayload.plannedEndDate,
  };

  try {
    await enforceDryhireHeaderFields(dryhireHeaderFields);
    await enforceDryhireHeaderFields(presupuestoHeaderFields);
  } catch (error) {
    console.error("Dryhire Flex header enforcement failed before local persistence. Attempting cleanup.", {
      jobId: job.id,
      dryhireElementId: dryhireHeaderFields.elementId,
      dryhireDocumentNumber: dryhireHeaderFields.documentNumber,
      presupuestoElementId: presupuestoHeaderFields.elementId,
      presupuestoDocumentNumber: presupuestoHeaderFields.documentNumber,
      error,
    });

    const cleanupFailures = await cleanupCreatedDryhireElements([
      presupuestoHeaderFields,
      dryhireHeaderFields,
    ]);
    const cleanupMessage =
      cleanupFailures.length > 0
        ? ` Cleanup also failed for: ${cleanupFailures.join("; ")}. Manual cleanup may be required.`
        : " Created Flex elements were deleted; no local folder rows were persisted.";

    throw new Error(
      `Dryhire Flex header enforcement failed before local persistence: ${getErrorMessage(error)}.${cleanupMessage}`
    );
  }

  await supabase
    .from("flex_folders")
    .insert([
      {
        job_id: job.id,
        parent_id: parentFolderId,
        element_id: dryHireFolder.elementId,
        department,
        folder_type: "dryhire",
      },
      {
        job_id: job.id,
        parent_id: dryHireFolder.elementId,
        element_id: presupuestoFolder.elementId,
        department,
        folder_type: "dryhire_presupuesto",
      },
    ]);
};
