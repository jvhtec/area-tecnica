import { format } from "date-fns";

import { supabase } from "@/lib/supabase";
import {
  DEPARTMENT_IDS,
  DEPARTMENT_SUFFIXES,
  FLEX_FOLDER_IDS,
  RESPONSIBLE_PERSON_IDS,
} from "@/utils/flex-folders/constants";
import { createFlexFolder, deleteFlexFolder } from "@/utils/flex-folders/api";

export async function createFoldersForDate(
  dateObj: any,
  tourId: string | null,
  skipExistingCheck = false
) {
  const createdFlexElementIds: string[] = [];
  const createdLocalRows: Array<{ id: string; elementId: string }> = [];
  let foldersCreationCompleted = false;

  const insertFlexFolderRow = async (payload: any) => {
    const { data, error } = await supabase.from("flex_folders").insert(payload).select("id, element_id");
    if (error) throw error;
    const insertedRow = Array.isArray(data) ? data[0] : data;
    if (insertedRow?.id && insertedRow?.element_id) {
      createdLocalRows.push({ id: insertedRow.id, elementId: insertedRow.element_id });
    }
  };

  const rollbackCreatedFolders = async () => {
    if (!createdFlexElementIds.length && !createdLocalRows.length) return;

    const deletedElementIds = new Set<string>();
    for (const elementId of [...createdFlexElementIds].reverse()) {
      try {
        await deleteFlexFolder(elementId);
        deletedElementIds.add(elementId);
      } catch (err) {
        console.error("[createFoldersForDate] Rollback failed deleting Flex element:", elementId, err);
      }
    }

    const rowIdsToDelete = createdLocalRows.filter((row) => deletedElementIds.has(row.elementId)).map((row) => row.id);
    if (rowIdsToDelete.length) {
      const { error } = await supabase.from("flex_folders").delete().in("id", rowIdsToDelete);
      if (error) {
        console.error("[createFoldersForDate] Rollback failed deleting local flex_folders rows:", error);
      }
    }
  };

  try {
    console.log("Creating folders for tour date:", dateObj);

    if (!skipExistingCheck) {
      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("flex_folders_created")
        .eq("tour_date_id", dateObj.id);
      if (jobsError) {
        console.error("Error checking existing jobs:", jobsError);
        throw jobsError;
      }
      if (jobs && jobs.some((j) => j.flex_folders_created)) {
        console.log("Skipping date – folders already exist:", dateObj.date);
        return false;
      }
    }

    const { data: tourData, error: tourError } = await supabase
      .from("tours")
      .select(`
        name,
        flex_main_folder_id,
        flex_sound_folder_id,
        flex_lights_folder_id,
        flex_video_folder_id,
        flex_production_folder_id,
        flex_personnel_folder_id
      `)
      .eq("id", tourId)
      .single();
    if (tourError) {
      console.error("Error fetching tour:", tourError);
      throw tourError;
    }
    if (!tourData || !tourData.flex_main_folder_id) {
      throw new Error("Parent tour folders not found. Please create tour folders first.");
    }

    const formattedStartDate = new Date(dateObj.date).toISOString().split(".")[0] + ".000Z";
    const formattedEndDate = formattedStartDate;
    const documentNumber = new Date(dateObj.date).toISOString().slice(2, 10).replace(/-/g, "");
    const formattedDate = format(new Date(dateObj.date), "MMM d, yyyy");
    const locationName = dateObj.location?.name || "No Location";

    const departments: (keyof typeof DEPARTMENT_IDS)[] = ["sound", "lights", "video", "production", "personnel"];

    for (const dept of departments) {
      const parentFolderId = tourData[`flex_${dept}_folder_id`];
      const capitalizedDept = dept.charAt(0).toUpperCase() + dept.slice(1);
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
      if (!parentRows || parentRows.length === 0) {
        console.warn(`No local record found for parent element_id=${parentFolderId}`);
        continue;
      }
      const parentRow = parentRows[0];

      const mainFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId,
        open: true,
        locked: false,
        name: `${locationName} - ${formattedDate} - ${capitalizedDept}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept]}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      };
      console.log(`Creating main tour date folder for ${dept}:`, mainFolderPayload);
      const mainFolderResponse = await createFlexFolder(mainFolderPayload);
      const mainFolderElementId = mainFolderResponse.elementId;
      createdFlexElementIds.push(mainFolderElementId);

      await insertFlexFolderRow({
        tour_date_id: dateObj.id,
        parent_id: parentRow.id,
        element_id: mainFolderElementId,
        department: dept,
        folder_type: "tourdate",
      });

      if (dept !== "personnel") {
        const subfolders = [
          {
            definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
            name: `Documentación Técnica - ${capitalizedDept}`,
            suffix: "DT",
          },
          {
            definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
            name: `Presupuestos Recibidos - ${capitalizedDept}`,
            suffix: "PR",
          },
          {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            name: `Hoja de Gastos - ${capitalizedDept}`,
            suffix: "HG",
          },
        ];
        for (const sf of subfolders) {
          const subPayload = {
            definitionId: sf.definitionId,
            parentElementId: mainFolderElementId,
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
          console.log(`Creating subfolder ${sf.name} for ${dept}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          createdFlexElementIds.push(subFolderElementId);
          await insertFlexFolderRow({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }

      if (["sound", "lights", "video"].includes(dept)) {
        const folderTitle = `${locationName} - ${formattedDate}`;
        const hojaInfoType =
          dept === "sound"
            ? FLEX_FOLDER_IDS.hojaInfoSx
            : dept === "lights"
              ? FLEX_FOLDER_IDS.hojaInfoLx
              : FLEX_FOLDER_IDS.hojaInfoVx;

        const hojaInfoSuffix = dept === "sound" ? "SIP" : dept === "lights" ? "LIP" : "VIP";

        const hojaInfoPayload = {
          definitionId: hojaInfoType,
          parentElementId: mainFolderElementId,
          open: true,
          locked: false,
          name: `Hoja de Información - ${folderTitle}`,
          plannedStartDate: formattedStartDate,
          plannedEndDate: formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS[dept as keyof typeof DEPARTMENT_IDS],
          documentNumber: `${documentNumber}${hojaInfoSuffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as keyof typeof RESPONSIBLE_PERSON_IDS],
        };

        console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
        const hojaInfoResponse = await createFlexFolder(hojaInfoPayload);
        createdFlexElementIds.push(hojaInfoResponse.elementId);
      }

      if (dept === "sound") {
        const isTourPackOnly = dateObj.is_tour_pack_only;
        console.log(`Tour pack only setting for ${dateObj.date}:`, isTourPackOnly);

        const soundSubfolders = [{ name: `${tourData.name} - Tour Pack`, suffix: "TP" }];

        if (!isTourPackOnly) {
          soundSubfolders.push({ name: `${tourData.name} - PA`, suffix: "PA" });
        }

        for (const sf of soundSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.pullSheet,
            parentElementId: mainFolderElementId,
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
          console.log(`Creating sound extra subfolder ${sf.name}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          createdFlexElementIds.push(subFolderElementId);
          await insertFlexFolderRow({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }

      if (dept === "personnel") {
        // ... keep existing code (personnel subfolder creation)
        const personnelSubfolders = [{ name: `Gastos de Personal - ${tourData.name}`, suffix: "GP" }];
        for (const sf of personnelSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            parentElementId: mainFolderElementId,
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
          console.log(`Creating personnel subfolder ${sf.name}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          createdFlexElementIds.push(subFolderElementId);
          await insertFlexFolderRow({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
        const personnelCrewCall = [
          { name: `Crew Call Sonido - ${tourData.name}`, suffix: "CCS" },
          { name: `Crew Call Luces - ${tourData.name}`, suffix: "CCL" },
        ];
        for (const sf of personnelCrewCall) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.crewCall,
            parentElementId: mainFolderElementId,
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
          console.log(`Creating personnel crew call subfolder ${sf.name}:`, subPayload);
          const subResponse = await createFlexFolder(subPayload);
          const subFolderElementId = subResponse.elementId;
          createdFlexElementIds.push(subFolderElementId);
          await insertFlexFolderRow({
            tour_date_id: dateObj.id,
            parent_id: parentRow.id,
            element_id: subFolderElementId,
            department: dept,
            folder_type: "tourdate_subfolder",
          });
        }
      }
    }
    foldersCreationCompleted = true;

    const { error: updateError } = await supabase
      .from("tour_dates")
      .update({ flex_folders_created: true })
      .eq("id", dateObj.id);
    if (updateError) {
      console.error("Error updating tour date:", updateError);
      throw updateError;
    }
    return true;
  } catch (error: any) {
    console.error("Error creating folders for tour date:", error);
    if (!foldersCreationCompleted) {
      await rollbackCreatedFolders();
    }
    throw error;
  }
}
