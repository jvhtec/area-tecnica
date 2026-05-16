import { supabase } from "@/lib/supabase";

import { createFlexFolder } from "../api";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "../constants";
import { getDepartmentCustomPullsheetMetadata, type DepartmentKey } from "../types";
import { createComercialExtras } from "./createComercialExtras";
import {
  buildPullsheetTemplates,
  getJobDepartments,
  shouldCreateDepartmentFolder,
  shouldCreateItem,
  upsertCrewCall,
} from "./helpers";
import type {
  ExistingFolderMaps,
  FlexFolderRow,
  FolderCreationBaseArgs,
  PullsheetTemplate,
} from "./types";

type CreateStandardJobFoldersArgs = FolderCreationBaseArgs & ExistingFolderMaps & {
  existingMainFolder?: FlexFolderRow;
  isLegacyMainFolder: boolean;
};

export const createStandardJobFolders = async ({
  documentNumber,
  existingDepartmentMap,
  existingMainFolder,
  existingWorkOrderMap,
  formattedEndDate,
  formattedStartDate,
  isLegacyMainFolder,
  job,
  options,
  safeJobTitle,
}: CreateStandardJobFoldersArgs) => {
  console.log("Default job type detected. Creating full folder structure.");

  const selectedDepartments = await getJobDepartments(job.id);
  console.log("Selected departments for job:", selectedDepartments);

  const topPayload = {
    definitionId: FLEX_FOLDER_IDS.mainFolder,
    open: true,
    locked: false,
    name: job.title,
    plannedStartDate: formattedStartDate,
    plannedEndDate: formattedEndDate,
    locationId: FLEX_FOLDER_IDS.location,
    personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
    documentNumber,
  };

  let topFolderId = !isLegacyMainFolder
    ? existingMainFolder?.element_id ?? undefined
    : undefined;

  if (!topFolderId) {
    if (isLegacyMainFolder) {
      console.log("Legacy Flex folder record detected; creating a new main folder instance.");
    }
    const topFolder = await createFlexFolder(topPayload);
    topFolderId = topFolder.elementId;

    await supabase
      .from("flex_folders")
      .insert({
        job_id: job.id,
        element_id: topFolderId,
        folder_type: "main_event",
      });
  } else {
    console.log("Reusing existing main Flex folder for job:", topFolderId);
  }

  if (!topFolderId) {
    throw new Error("Unable to resolve main Flex folder for job");
  }

  const allDepartments: DepartmentKey[] = [
    "sound",
    "lights",
    "video",
    "production",
    "personnel",
    "comercial",
  ];

  for (const dept of allDepartments) {
    if (!shouldCreateDepartmentFolder(dept, selectedDepartments)) {
      console.log(`Skipping ${dept} folder - department not selected`);
      continue;
    }

    const deptLabel = dept.charAt(0).toUpperCase() + dept.slice(1);
    const deptPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: topFolderId,
      open: true,
      locked: false,
      name: `${job.title} - ${deptLabel}`,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[dept],
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
    };

    let deptFolderId = existingDepartmentMap.get(dept)?.element_id ?? null;

    if (!deptFolderId) {
      console.log(`Creating department folder for ${dept}:`, deptPayload);
      const deptFolder = await createFlexFolder(deptPayload);

      const { data: [childRow], error: childErr } = await supabase
        .from("flex_folders")
        .insert({
          job_id: job.id,
          parent_id: topFolderId,
          element_id: deptFolder.elementId,
          department: dept,
          folder_type: "department",
        })
        .select("*");

      if (childErr) {
        console.error("Error inserting department folder row:", childErr);
      }

      deptFolderId = childRow?.element_id ?? deptFolder.elementId;
      if (childRow?.department) {
        existingDepartmentMap.set(childRow.department, childRow as FlexFolderRow);
      }
    } else {
      console.log(`Reusing existing department folder for ${dept}:`, deptFolderId);
    }

    if (!deptFolderId) {
      console.warn(`Unable to determine Flex folder id for ${dept}, skipping subfolders.`);
      continue;
    }

    const parentName = deptPayload.name;
    const parentDocumentNumber = deptPayload.documentNumber;

    if (
      ["sound", "lights", "video"].includes(dept) &&
      shouldCreateItem(dept, "hojaInfo", options)
    ) {
      const hojaInfoType = dept === "sound"
        ? FLEX_FOLDER_IDS.hojaInfoSx
        : dept === "lights"
          ? FLEX_FOLDER_IDS.hojaInfoLx
          : FLEX_FOLDER_IDS.hojaInfoVx;
      const hojaInfoSuffix = dept === "sound" ? "SIP" : dept === "lights" ? "LIP" : "VIP";
      const hojaInfoPayload = {
        definitionId: hojaInfoType,
        parentElementId: deptFolderId,
        open: true,
        locked: false,
        name: `Hoja de Información - ${job.title}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: `${documentNumber}${hojaInfoSuffix}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };

      console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
      const hojaInfoResponse = await createFlexFolder(hojaInfoPayload);
      const hojaInfoFolderType = dept === "sound"
        ? "hoja_info_sx"
        : dept === "lights"
          ? "hoja_info_lx"
          : "hoja_info_vx";
      const parentFolderRow = existingDepartmentMap.get(dept);
      try {
        await supabase.from("flex_folders").insert({
          job_id: job.id,
          parent_id: parentFolderRow?.id ?? null,
          element_id: hojaInfoResponse.elementId,
          department: dept,
          folder_type: hojaInfoFolderType,
        });
        console.log(`Persisted hojaInfo for ${dept} with element_id: ${hojaInfoResponse.elementId}`);
      } catch (err) {
        console.error(`Failed to persist hojaInfo for ${dept}:`, err);
        console.error(`Orphaned Flex folder created with element_id: ${hojaInfoResponse.elementId}`);
        throw new Error(
          `Failed to persist hojaInfo for ${dept} (job_id: ${job.id}, element_id: ${hojaInfoResponse.elementId}). ` +
          `Flex folder was created but could not be recorded in database. Original error: ${err}`
        );
      }
    }

    if (["sound", "lights", "video"].includes(dept)) {
      const metadataEntries = getDepartmentCustomPullsheetMetadata(options?.[dept]);
      const defaultPullsheets: PullsheetTemplate[] = [];

      if (dept === "sound") {
        if (shouldCreateItem("sound", "pullSheetTP", options)) {
          defaultPullsheets.push({
            name: `${safeJobTitle} - Tour Pack`,
            suffix: "TP",
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
          });
        }

        if (shouldCreateItem("sound", "pullSheetPA", options)) {
          defaultPullsheets.push({
            name: `${safeJobTitle} - PA`,
            suffix: "PA",
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
          });
        }
      }

      if (defaultPullsheets.length > 0 || metadataEntries.length > 0) {
        const templates = buildPullsheetTemplates(
          defaultPullsheets,
          metadataEntries,
          formattedStartDate,
          formattedEndDate,
          (index, defaultEntry) => {
            if (defaultEntry?.name) return defaultEntry.name;
            const base = `${safeJobTitle} - ${deptLabel} Pullsheet`;
            return `${base}${index > 0 ? ` ${index + 1}` : ""}`;
          }
        );
        const documentPrefix = `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`;

        for (const template of templates) {
          const pullsheetPayload = {
            definitionId: FLEX_FOLDER_IDS.pullSheet,
            parentElementId: deptFolderId,
            open: true,
            locked: false,
            name: template.name,
            plannedStartDate: template.plannedStartDate,
            plannedEndDate: template.plannedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            departmentId: DEPARTMENT_IDS[dept],
            documentNumber: `${documentPrefix}${template.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
          };

          const pullsheetResponse = await createFlexFolder(pullsheetPayload);
          const parentFolderRow = existingDepartmentMap.get(dept);
          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              parent_id: parentFolderRow?.id ?? null,
              element_id: pullsheetResponse.elementId,
              department: dept,
              folder_type: "pull_sheet",
            });
            console.log(`Persisted pullsheet ${template.name} with element_id: ${pullsheetResponse.elementId}`);
          } catch (err) {
            console.error(`Failed to persist pullsheet ${template.name}:`, err);
            console.error(`Orphaned Flex folder created with element_id: ${pullsheetResponse.elementId}`);
            throw new Error(
              `Failed to persist pullsheet ${template.name} (element_id: ${pullsheetResponse.elementId}). ` +
              `Flex folder was created but could not be recorded in database. Original error: ${err}`
            );
          }
        }
      }
    }

    if (dept !== "personnel" && dept !== "comercial") {
      const subfolders = [
        {
          definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
          name: `${job.title} - Documentación Técnica - ${deptLabel}`,
          suffix: "DT",
          key: "documentacionTecnica" as const,
        },
        {
          definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
          name: `${job.title} - Presupuestos Recibidos - ${deptLabel}`,
          suffix: "PR",
          key: "presupuestosRecibidos" as const,
        },
        {
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
          name: `${job.title} - Hoja de Gastos - ${deptLabel}`,
          suffix: "HG",
          key: "hojaGastos" as const,
        },
      ];

      for (const sf of subfolders) {
        if (!shouldCreateItem(dept, sf.key, options)) continue;
        const subPayload = {
          definitionId: sf.definitionId,
          parentElementId: deptFolderId,
          open: true,
          locked: false,
          name: sf.name,
          plannedStartDate: formattedStartDate,
          plannedEndDate: formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS[dept],
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
        };

        const created = await createFlexFolder(subPayload);
        const folderTypeMap: Record<string, string> = {
          documentacionTecnica: "doc_tecnica",
          presupuestosRecibidos: "presupuestos_recibidos",
          hojaGastos: "hoja_gastos",
        };

        const parentFolderRow = existingDepartmentMap.get(dept);
        try {
          await supabase.from("flex_folders").insert({
            job_id: job.id,
            parent_id: parentFolderRow?.id ?? null,
            element_id: created.elementId,
            department: dept,
            folder_type: folderTypeMap[sf.key],
          });
          console.log(`Persisted ${sf.key} for ${dept} with element_id: ${created.elementId}`);
        } catch (err) {
          console.error(`Failed to persist ${sf.key} for ${dept}:`, err);
          console.error(`Orphaned Flex folder created with element_id: ${created.elementId}`);
          throw new Error(
            `Failed to persist ${sf.key} for ${dept} (element_id: ${created.elementId}). ` +
            `Flex folder was created but could not be recorded in database. Original error: ${err}`
          );
        }
      }
    } else if (dept === "comercial") {
      await createComercialExtras({
        formattedEndDate,
        formattedStartDate,
        job,
        jobTitle: safeJobTitle,
        options,
        parentDocumentNumber,
        parentElementId: deptFolderId,
        parentName,
      });
    } else if (dept === "personnel") {
      const personnelSubfolders = [
        {
          name: `Crew Call Sonido - ${job.title}`,
          suffix: "CCS",
          key: "crewCallSound" as const,
          definitionId: FLEX_FOLDER_IDS.crewCall,
          crewCallDepartment: "sound" as const,
        },
        {
          name: `Crew Call Luces - ${job.title}`,
          suffix: "CCL",
          key: "crewCallLights" as const,
          definitionId: FLEX_FOLDER_IDS.crewCall,
          crewCallDepartment: "lights" as const,
        },
        {
          name: `Orden de Trabajo - ${job.title}`,
          suffix: "OT",
          key: "workOrder" as const,
          definitionId: FLEX_FOLDER_IDS.ordenTrabajo,
        },
        {
          name: `Gastos de Personal - ${job.title}`,
          suffix: "GP",
          key: "gastosDePersonal" as const,
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
        },
      ];

      for (const sf of personnelSubfolders) {
        if (!shouldCreateItem("personnel", sf.key, options)) continue;
        if (sf.key === "workOrder") {
          const existingWorkOrder = existingWorkOrderMap.get(dept);
          if (existingWorkOrder?.element_id) {
            console.log(`Reusing existing work order folder for ${dept}:`, existingWorkOrder.element_id);
            continue;
          }
        }

        const subPayload = {
          definitionId: sf.definitionId,
          parentElementId: deptFolderId,
          open: true,
          locked: false,
          name: sf.name,
          plannedStartDate: formattedStartDate,
          plannedEndDate: formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${sf.suffix}`,
          departmentId: DEPARTMENT_IDS[dept],
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
        };

        const created = await createFlexFolder(subPayload);
        if (sf.crewCallDepartment) {
          await upsertCrewCall(job.id, sf.crewCallDepartment, created.elementId);
        }
        if (sf.key === "workOrder") {
          try {
            const { data: insertedRow, error: insertError } = await supabase
              .from("flex_folders")
              .insert({
                job_id: job.id,
                parent_id: deptFolderId,
                element_id: created.elementId,
                department: dept,
                folder_type: "work_orders",
              })
              .select("*")
              .single();

            if (insertError) {
              console.error("Failed to persist work order Flex folder:", insertError);
            } else if (insertedRow) {
              existingWorkOrderMap.set(dept, insertedRow as FlexFolderRow);
            }
          } catch (error) {
            console.error("Unexpected error inserting work order Flex folder:", error);
          }
        }
        if (sf.key === "gastosDePersonal") {
          const parentFolderRow = existingDepartmentMap.get(dept);
          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              parent_id: parentFolderRow?.id ?? null,
              element_id: created.elementId,
              department: dept,
              folder_type: "hoja_gastos",
            });
            console.log(`Persisted gastos de personal with element_id: ${created.elementId}`);
          } catch (err) {
            console.error("Failed to persist gastos de personal:", err);
            console.error(`Orphaned Flex folder created with element_id: ${created.elementId}`);
            throw new Error(
              `Failed to persist gastos de personal (element_id: ${created.elementId}). ` +
              `Flex folder was created but could not be recorded in database. Original error: ${err}`
            );
          }
        }
      }
    }
  }
};
