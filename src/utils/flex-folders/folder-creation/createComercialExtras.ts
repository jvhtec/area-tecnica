import { supabase } from "@/lib/supabase";

import { createFlexFolder } from "../api";
import {
  DEPARTMENT_IDS,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "../constants";
import {
  getDepartmentExtrasPresupuestoMetadata,
  type CreateFoldersOptions,
} from "../types";
import { shouldCreateItem } from "./helpers";
import type { FlexFolderJob } from "./types";

type CreateComercialExtrasArgs = {
  formattedEndDate: string;
  formattedStartDate: string;
  job: FlexFolderJob;
  jobTitle: string;
  options?: CreateFoldersOptions;
  parentDocumentNumber?: string;
  parentElementId: string;
  parentName: string;
  tourDateId?: string | null;
};

export const createComercialExtras = async ({
  formattedEndDate,
  formattedStartDate,
  job,
  jobTitle,
  options,
  parentDocumentNumber,
  parentElementId,
  parentName,
  tourDateId,
}: CreateComercialExtrasArgs) => {
  const parentDoc = parentDocumentNumber ?? "";
  const extrasMetadata = getDepartmentExtrasPresupuestoMetadata(options?.comercial);
  const replacements = [
    {
      label: "Sonido",
      dept: "sound" as const,
      suffix: "SQT",
      extrasKey: "extrasSound" as const,
      presupuestoKey: "presupuestoSound" as const,
    },
    {
      label: "Luces",
      dept: "lights" as const,
      suffix: "LQT",
      extrasKey: "extrasLights" as const,
      presupuestoKey: "presupuestoLights" as const,
    },
  ];

  const extrasJobTitle = jobTitle?.trim?.() || job?.title?.trim?.() || parentName;

  for (const extra of replacements) {
    const shouldCreateExtras = shouldCreateItem("comercial", extra.extrasKey, options);
    const shouldCreatePresupuesto = shouldCreateItem("comercial", extra.presupuestoKey, options);

    if (!shouldCreateExtras && !shouldCreatePresupuesto) {
      continue;
    }

    const extrasBaseName = `Extras ${extrasJobTitle} - ${extra.label}`;
    const sharedPayload = {
      parentElementId,
      open: true,
      locked: false,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[extra.dept],
      documentNumber: `${parentDoc}${extra.suffix}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[extra.dept],
    };

    let presupuestoParentId = parentElementId;
    let presupuestoParentDbId: string | null = null;

    if (shouldCreateExtras) {
      const extrasPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        name: extrasBaseName,
        ...sharedPayload,
      };

      const extrasFolder = await createFlexFolder(extrasPayload);
      const extrasFolderElementId = extrasFolder.elementId;

      if (!extrasFolderElementId) {
        console.warn("Unable to resolve extras folder element id for", extrasPayload);
        continue;
      }

      try {
        const { data: insertedRow, error: insertError } = await supabase
          .from("flex_folders")
          .insert({
            job_id: job.id,
            tour_date_id: tourDateId ?? null,
            parent_id: parentElementId,
            element_id: extrasFolderElementId,
            department: extra.dept,
            folder_type: "comercial_extras",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        if (!insertedRow?.id) throw new Error("Failed to retrieve inserted row ID");

        console.log(`Persisted comercial extras folder for ${extra.dept} with element_id: ${extrasFolderElementId}, db_id: ${insertedRow.id}`);
        presupuestoParentId = extrasFolderElementId;
        presupuestoParentDbId = insertedRow.id;
      } catch (err) {
        console.error(`Failed to persist comercial extras folder for ${extra.dept}:`, err);
        console.error(`Orphaned Flex folder created with element_id: ${extrasFolderElementId}`);
        throw new Error(
          `Failed to persist comercial extras folder for ${extra.dept} (element_id: ${extrasFolderElementId}). ` +
          `Flex folder was created but could not be recorded in database. Original error: ${err}`
        );
      }
    }

    if (shouldCreatePresupuesto) {
      const presupuestoEntries = extrasMetadata.length > 0
        ? extrasMetadata
        : [
            {
              name: "",
              plannedStartDate: formattedStartDate,
              plannedEndDate: formattedEndDate,
            },
          ];

      for (let index = 0; index < presupuestoEntries.length; index += 1) {
        const entry = presupuestoEntries[index];
        const trimmedName = entry?.name?.trim?.();
        const childNameBase = shouldCreateExtras
          ? (trimmedName
              ? `Extras ${extrasJobTitle} - ${trimmedName}`
              : `${extrasBaseName} - Presupuesto${presupuestoEntries.length > 1 ? ` ${index + 1}` : ""}`)
          : (trimmedName
              ? `${extrasJobTitle} - ${extra.label} - ${trimmedName}`
              : `${extrasJobTitle} - ${extra.label} - Presupuesto${presupuestoEntries.length > 1 ? ` ${index + 1}` : ""}`);

        const childPayload = {
          definitionId: FLEX_FOLDER_IDS.presupuesto,
          parentElementId: presupuestoParentId,
          open: true,
          locked: false,
          name: childNameBase,
          plannedStartDate: entry?.plannedStartDate || formattedStartDate,
          plannedEndDate: entry?.plannedEndDate || formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS[extra.dept],
          documentNumber:
            presupuestoEntries.length > 1
              ? `${sharedPayload.documentNumber}PR${String(index + 1).padStart(2, "0")}`
              : sharedPayload.documentNumber,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[extra.dept],
        };

        const presupuestoResponse = await createFlexFolder(childPayload);

        try {
          await supabase.from("flex_folders").insert({
            job_id: job.id,
            tour_date_id: tourDateId ?? null,
            parent_id: presupuestoParentDbId || parentElementId,
            element_id: presupuestoResponse.elementId,
            department: extra.dept,
            folder_type: "comercial_presupuesto",
          });
          console.log(`Persisted comercial presupuesto for ${extra.dept} with element_id: ${presupuestoResponse.elementId}`);
        } catch (err) {
          console.error(`Failed to persist comercial presupuesto for ${extra.dept}:`, err);
          console.error(`Orphaned Flex folder created with element_id: ${presupuestoResponse.elementId}`);
          throw new Error(
            `Failed to persist comercial presupuesto for ${extra.dept} (element_id: ${presupuestoResponse.elementId}). ` +
            `Flex folder was created but could not be recorded in database. Original error: ${err}`
          );
        }
      }
    }
  }
};
