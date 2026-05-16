import { formatInTimeZone } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "@/utils/flex-folders/api";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "@/utils/flex-folders/constants";
import { getDepartmentCustomPullsheetMetadata, type DepartmentKey } from "@/utils/flex-folders/types";
import { createComercialExtras } from "@/utils/flex-folders/folder-creation/createComercialExtras";
import {
  buildPullsheetTemplates,
  getTourJobDepartments,
  resolveTourdateLocationName,
  shouldCreateDepartmentFolder,
  shouldCreateItem,
  upsertCrewCall,
} from "@/utils/flex-folders/folder-creation/helpers";
import type {
  ExistingFolderMaps,
  FlexFolderRow,
  FolderCreationBaseArgs,
  PullsheetTemplate,
} from "@/utils/flex-folders/folder-creation/types";

type CreateTourdateFoldersArgs = FolderCreationBaseArgs & Pick<
  ExistingFolderMaps,
  "existingTourDateDepartmentMap"
> & {
  existingFolders: FlexFolderRow[];
};

const FOLDER_LABEL_TIMEZONE = "Europe/Madrid";

export const createTourdateFolders = async ({
  documentNumber,
  existingFolders,
  existingTourDateDepartmentMap,
  formattedEndDate,
  formattedStartDate,
  job,
  options,
  safeJobTitle,
}: CreateTourdateFoldersArgs) => {
  console.log("Tourdate job type detected. Validating tour data...");

  if (!job.tour_id) {
    throw new Error("Tour ID is missing for tourdate job");
  }

  const selectedDepartments = await getTourJobDepartments(job.tour_id);
  console.log("Selected departments for tour:", selectedDepartments);

  const { data: tourData, error: tourError } = await supabase
    .from("tours")
    .select(`
      id,
      name,
      flex_main_folder_id,
      flex_sound_folder_id,
      flex_lights_folder_id,
      flex_video_folder_id,
      flex_production_folder_id,
      flex_personnel_folder_id,
      flex_comercial_folder_id
    `)
    .eq("id", job.tour_id)
    .single();

  if (tourError || !tourData) {
    console.error("Error fetching tour data:", tourError);
    throw new Error(`Tour not found for tour_id: ${job.tour_id}`);
  }

  if (!tourData.flex_main_folder_id) {
    throw new Error("Tour folders have not been created yet. Please create tour folders first.");
  }

  if (job.tour_date_id) {
    const { data: existingTourDateFolders, error: existingTourDateFoldersError } = await supabase
      .from("flex_folders")
      .select("id, element_id, parent_id, folder_type, department")
      .eq("tour_date_id", job.tour_date_id)
      .eq("folder_type", "tourdate");

    if (existingTourDateFoldersError) {
      console.error(
        "Failed to load existing tour date department folders:",
        existingTourDateFoldersError
      );
      throw existingTourDateFoldersError;
    }

    for (const folder of existingTourDateFolders ?? []) {
      if (folder.department && !existingTourDateDepartmentMap.has(folder.department)) {
        existingTourDateDepartmentMap.set(folder.department, folder as FlexFolderRow);
      }
    }
  }

  let tourDateInfo = null;
  if (job.tour_date_id) {
    const { data: tourDateData, error: tourDateError } = await supabase
      .from("tour_dates")
      .select("is_tour_pack_only")
      .eq("id", job.tour_date_id)
      .single();

    if (!tourDateError && tourDateData) {
      tourDateInfo = tourDateData;
    }
  }

  console.log("Using tour folders:", tourData);
  console.log("Tour date info:", tourDateInfo);

  const allDepartments: DepartmentKey[] = [
    "sound",
    "lights",
    "video",
    "production",
    "personnel",
    "comercial",
  ];
  const locationName = resolveTourdateLocationName(job);
  const formattedDate = formatInTimeZone(new Date(job.start_time), FOLDER_LABEL_TIMEZONE, "MMM d, yyyy");
  const existingPersonnelSubfolderMap = new Map<string, FlexFolderRow>();
  for (const folder of existingFolders) {
    if (folder.department !== "personnel") continue;
    if (folder.folder_type === "work_orders") {
      existingPersonnelSubfolderMap.set("workOrder", folder);
    }
    if (folder.folder_type === "hoja_gastos") {
      existingPersonnelSubfolderMap.set("gastosDePersonal", folder);
    }
  }

  for (const dept of allDepartments) {
    if (!shouldCreateDepartmentFolder(dept, selectedDepartments)) {
      console.log(`Skipping ${dept} folder - department not selected`);
      continue;
    }

    const parentFolderId = tourData[`flex_${dept}_folder_id`];
    if (!parentFolderId) {
      console.warn(`No parent folder ID found for ${dept} department`);
      continue;
    }

    const { data: parentRows, error: parentErr } = await supabase
      .from("flex_folders")
      .select("*")
      .eq("element_id", parentFolderId)
      .limit(1);

    if (parentErr) {
      console.error("Error fetching parent row:", parentErr);
      continue;
    }
    const parentRow = parentRows?.[0];
    if (!parentRow) {
      console.warn(`No local DB row found for parent element_id=${parentFolderId}`);
      continue;
    }

    const deptLabel = dept.charAt(0).toUpperCase() + dept.slice(1);
    const tourDateFolderName = `${locationName} - ${formattedDate} - ${deptLabel}`;
    const tourDateDocumentNumber = `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`;
    let deptFolderId = existingTourDateDepartmentMap.get(dept)?.element_id ?? null;
    let deptFolderRowId = existingTourDateDepartmentMap.get(dept)?.id ?? null;

    if (!deptFolderId) {
      const tourDateFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId,
        open: true,
        locked: false,
        name: tourDateFolderName,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: tourDateDocumentNumber,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };

      console.log(`Creating tour date folder for ${dept}:`, tourDateFolderPayload);
      const tourDateFolder = await createFlexFolder(tourDateFolderPayload);

      const { data: childRows, error: childErr } = await supabase
        .from("flex_folders")
        .insert({
          job_id: job.id,
          tour_date_id: job.tour_date_id ?? null,
          parent_id: parentRow.id,
          element_id: tourDateFolder.elementId,
          department: dept,
          folder_type: "tourdate",
        })
        .select("*");

      if (childErr) {
        console.error("Error inserting child folder row:", childErr);
        throw new Error(
          `Failed to persist tourdate folder for ${dept} (job_id: ${job.id}, element_id: ${tourDateFolder.elementId}): ${childErr.message}`
        );
      }

      const childRow = childRows?.[0];
      if (!childRow) {
        throw new Error(
          `Failed to retrieve persisted tourdate folder row for ${dept} (job_id: ${job.id}, element_id: ${tourDateFolder.elementId})`
        );
      }

      deptFolderId = childRow?.element_id ?? tourDateFolder.elementId;
      deptFolderRowId = childRow?.id ?? null;
      if (childRow?.department) {
        existingTourDateDepartmentMap.set(childRow.department, childRow as FlexFolderRow);
      }
    } else {
      console.log(`Reusing existing tour date folder for ${dept}:`, deptFolderId);
    }

    if (!deptFolderId) {
      console.warn(`Unable to determine tour date folder for ${dept}, skipping subfolders.`);
      continue;
    }

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
        name: `Hoja de Información - ${locationName} - ${formattedDate}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}${hojaInfoSuffix}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };

      console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
      const hojaInfoResponse = await createFlexFolder(hojaInfoPayload);
      const hojaInfoFolderType = dept === "sound"
        ? "hoja_info_sx"
        : dept === "lights"
          ? "hoja_info_lx"
          : "hoja_info_vx";

      try {
        const { error: insertError } = await supabase.from("flex_folders").insert({
          job_id: job.id,
          tour_date_id: job.tour_date_id ?? null,
          parent_id: deptFolderRowId ?? null,
          element_id: hojaInfoResponse.elementId,
          department: dept,
          folder_type: hojaInfoFolderType,
        });
        if (insertError) throw insertError;
        console.log(`Persisted hojaInfo for ${dept} with element_id: ${hojaInfoResponse.elementId}`);
      } catch (err) {
        console.error(`Failed to persist hojaInfo for ${dept}:`, err);
        console.error(`Orphaned Flex folder created with element_id: ${hojaInfoResponse.elementId}`);
        throw new Error(
          `Failed to persist hojaInfo for ${dept} (element_id: ${hojaInfoResponse.elementId}). ` +
          `Flex folder was created but could not be recorded in database. Original error: ${err}`
        );
      }
    }

    if (dept !== "personnel" && dept !== "comercial") {
      const subfolders = [
        {
          definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
          name: `${tourData.name} - ${locationName} - ${formattedDate} - Documentación Técnica - ${deptLabel}`,
          suffix: "DT",
          key: "documentacionTecnica" as const,
        },
        {
          definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
          name: `${tourData.name} - ${locationName} - ${formattedDate} - Presupuestos Recibidos - ${deptLabel}`,
          suffix: "PR",
          key: "presupuestosRecibidos" as const,
        },
        {
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
          name: `${tourData.name} - ${locationName} - ${formattedDate} - Hoja de Gastos - ${deptLabel}`,
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
        const subFolderResponse = await createFlexFolder(subPayload);
        const folderTypeMap: Record<string, string> = {
          documentacionTecnica: "doc_tecnica",
          presupuestosRecibidos: "presupuestos_recibidos",
          hojaGastos: "hoja_gastos",
        };

        try {
          const { error: insertError } = await supabase.from("flex_folders").insert({
            job_id: job.id,
            tour_date_id: job.tour_date_id ?? null,
            parent_id: deptFolderRowId ?? null,
            element_id: subFolderResponse.elementId,
            department: dept,
            folder_type: folderTypeMap[sf.key],
          });
          if (insertError) throw insertError;
          console.log(`Persisted ${sf.key} for ${dept} with element_id: ${subFolderResponse.elementId}`);
        } catch (err) {
          console.error(`Failed to persist ${sf.key} for ${dept}:`, err);
          console.error(`Orphaned Flex folder created with element_id: ${subFolderResponse.elementId}`);
          throw new Error(
            `Failed to persist ${sf.key} for ${dept} (element_id: ${subFolderResponse.elementId}). ` +
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
        parentDocumentNumber: tourDateDocumentNumber,
        parentElementId: deptFolderId,
        parentName: tourDateFolderName,
        tourDateId: job.tour_date_id ?? null,
      });
    }

    if (["sound", "lights", "video"].includes(dept)) {
      const metadataEntries = getDepartmentCustomPullsheetMetadata(options?.[dept]);
      const defaultPullsheets: PullsheetTemplate[] = [];

      if (dept === "sound") {
        const isTourPackOnly = tourDateInfo?.is_tour_pack_only || false;
        console.log("Tour pack only setting for sound folder:", isTourPackOnly);

        if (shouldCreateItem("sound", "pullSheetTP", options)) {
          defaultPullsheets.push({
            name: `${safeJobTitle} - Tour Pack`,
            suffix: "TP",
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
          });
        }

        if (!isTourPackOnly && shouldCreateItem("sound", "pullSheetPA", options)) {
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
            const base = `${tourDateFolderName} - Pullsheet`;
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

          try {
            const { error: insertError } = await supabase.from("flex_folders").insert({
              job_id: job.id,
              tour_date_id: job.tour_date_id ?? null,
              parent_id: deptFolderRowId ?? null,
              element_id: pullsheetResponse.elementId,
              department: dept,
              folder_type: "pull_sheet",
            });
            if (insertError) throw insertError;
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

    if (dept === "personnel") {
      const personnelSubfolders: {
        name: string;
        suffix: string;
        key: "gastosDePersonal" | "workOrder";
        definitionId: string;
        folderType: "hoja_gastos" | "work_orders";
      }[] = [];
      if (shouldCreateItem("personnel", "workOrder", options)) {
        personnelSubfolders.push({
          name: `Orden de Trabajo - ${job.title}`,
          suffix: "OT",
          key: "workOrder",
          definitionId: FLEX_FOLDER_IDS.ordenTrabajo,
          folderType: "work_orders",
        });
      }
      if (shouldCreateItem("personnel", "gastosDePersonal", options)) {
        personnelSubfolders.push({
          name: `Gastos de Personal - ${job.title}`,
          suffix: "GP",
          key: "gastosDePersonal",
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
          folderType: "hoja_gastos",
        });
      }

      for (const sf of personnelSubfolders) {
        const existingSubfolder = existingPersonnelSubfolderMap.get(sf.key);
        if (existingSubfolder?.element_id) {
          console.log(`Reusing existing personnel ${sf.key} folder:`, existingSubfolder.element_id);
          continue;
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

        const subFolderResponse = await createFlexFolder(subPayload);

        try {
          const { data: insertedRow, error: insertError } = await supabase
            .from("flex_folders")
            .insert({
              job_id: job.id,
              tour_date_id: job.tour_date_id ?? null,
              parent_id: deptFolderRowId ?? null,
              element_id: subFolderResponse.elementId,
              department: dept,
              folder_type: sf.folderType,
            })
            .select("*")
            .single();

          if (insertError) throw insertError;
          if (!insertedRow) {
            throw new Error(
              `Failed to retrieve persisted personnel ${sf.key} folder row for job ${job.id} (element_id: ${subFolderResponse.elementId})`
            );
          }

          existingPersonnelSubfolderMap.set(sf.key, insertedRow as FlexFolderRow);
          console.log(`Persisted personnel ${sf.key} with element_id: ${subFolderResponse.elementId}`);
        } catch (err) {
          console.error(`Failed to persist personnel ${sf.key}:`, err);
          console.error(`Orphaned Flex folder created with element_id: ${subFolderResponse.elementId}`);
          throw new Error(
            `Failed to persist personnel ${sf.key} (element_id: ${subFolderResponse.elementId}). ` +
            `Flex folder was created but could not be recorded in database. Original error: ${err}`
          );
        }
      }

      const personnelcrewCall: { name: string; suffix: "CCS" | "CCL" }[] = [];
      if (shouldCreateItem("personnel", "crewCallSound", options)) {
        personnelcrewCall.push({ name: `Crew Call Sonido - ${job.title}`, suffix: "CCS" });
      }
      if (shouldCreateItem("personnel", "crewCallLights", options)) {
        personnelcrewCall.push({ name: `Crew Call Luces - ${job.title}`, suffix: "CCL" });
      }

      for (const sf of personnelcrewCall) {
        const subPayload = {
          definitionId: FLEX_FOLDER_IDS.crewCall,
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

        const cc = await createFlexFolder(subPayload);
        const mappedDept = sf.suffix === "CCS" ? "sound" : "lights";
        await upsertCrewCall(job.id, mappedDept, cc.elementId);
      }
    }
  }
};
