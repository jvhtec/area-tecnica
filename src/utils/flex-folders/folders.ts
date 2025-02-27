
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { FolderCreationParams } from "./types";
import { createFlexFolder } from "./api";
import {
  FLEX_FOLDER_IDS,
  DRYHIRE_PARENT_IDS,
  DEPARTMENT_IDS,
  RESPONSIBLE_PERSON_IDS,
  DEPARTMENT_SUFFIXES
} from "./constants";

/**
 * Creates all necessary folders in Flex for a job
 * @param job The job object
 * @param formattedStartDate The formatted start date
 * @param formattedEndDate The formatted end date
 * @param documentNumber The document number
 */
export async function createAllFoldersForJob(
  job: any,
  formattedStartDate: string,
  formattedEndDate: string,
  documentNumber: string
) {
  if (job.job_type === "dryhire") {
    console.log("Dryhire job type detected. Creating dryhire folder...");

    const department = job.job_departments[0]?.department;
    if (!department || !["sound", "lights"].includes(department)) {
      throw new Error("Invalid department for dryhire job");
    }

    const startDate = new Date(job.start_time);
    const monthKey = startDate.toISOString().slice(5, 7);
    const parentFolderId = DRYHIRE_PARENT_IDS[department as "sound" | "lights"][monthKey];

    if (!parentFolderId) {
      throw new Error(`No parent folder found for month ${monthKey}`);
    }

    const dryHireFolderPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: parentFolderId,
      open: true,
      locked: false,
      name: `Dry Hire - ${job.title}`,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[department as Department],
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[department as Department]}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[department as Department],
    };

    console.log("Creating dryhire folder with payload:", dryHireFolderPayload);
    const dryHireFolder = await createFlexFolder(dryHireFolderPayload);

    await supabase
      .from("flex_folders")
      .insert({
        job_id: job.id,
        parent_id: parentFolderId,
        element_id: dryHireFolder.elementId,
        department: department,
        folder_type: "dryhire",
      });

    return;
  }

  if (job.job_type === "tourdate") {
    console.log("Tourdate job type detected. Validating tour data...");

    if (!job.tour_id) {
      throw new Error("Tour ID is missing for tourdate job");
    }

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
        flex_personnel_folder_id
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

    console.log("Using tour folders:", tourData);

    const departments = ["sound", "lights", "video", "production", "personnel", "comercial"];
    const locationName = job.location?.name || "No Location";
    const formattedDate = format(new Date(job.start_time), "MMM d, yyyy");

    for (const dept of departments) {
      const parentFolderId = tourData[`flex_${dept}_folder_id`];
      if (!parentFolderId) {
        console.warn(`No parent folder ID found for ${dept} department`);
        continue;
      }

      const { data: [parentRow], error: parentErr } = await supabase
        .from("flex_folders")
        .select("*")
        .eq("element_id", parentFolderId)
        .limit(1);

      if (parentErr) {
        console.error("Error fetching parent row:", parentErr);
        continue;
      }
      if (!parentRow) {
        console.warn(`No local DB row found for parent element_id=${parentFolderId}`);
        continue;
      }

      const tourDateFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId,
        open: true,
        locked: false,
        name: `${locationName} - ${formattedDate} - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
        plannedStartDate: formattedStartDate,
        plannedEndDate: formattedEndDate,
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept as Department],
        documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
      };

      console.log(`Creating tour date folder for ${dept}:`, tourDateFolderPayload);
      const tourDateFolder = await createFlexFolder(tourDateFolderPayload);

      const { data: [childRow], error: childErr } = await supabase
        .from("flex_folders")
        .insert({
          job_id: job.id,
          parent_id: parentRow.id,
          element_id: tourDateFolder.elementId,
          department: dept,
          folder_type: "tourdate",
        })
        .select("*");

      if (childErr) {
        console.error("Error inserting child folder row:", childErr);
        continue;
      }

      if (dept !== "personnel") {
        const subfolders = [
          {
            definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
            name: `Documentación Técnica - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
            suffix: "DT",
          },
          {
            definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
            name: `Presupuestos Recibidos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
            suffix: "PR",
          },
          {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            name: `Hoja de Gastos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
            suffix: "HG",
          },
        ];

        for (const sf of subfolders) {
          const subPayload = {
            definitionId: sf.definitionId,
            parentElementId: childRow.element_id,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            departmentId: DEPARTMENT_IDS[dept as Department],
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          await createFlexFolder(subPayload);
        }
      }
      if (dept === "sound") {
        const soundSubfolders = [
          { name: `${job.title} - Tour Pack`, suffix: "TP" },
          { name: `${job.title} - PA`, suffix: "PA" },
        ];

        for (const sf of soundSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.pullSheet,
            parentElementId: childRow.element_id,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept as Department],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };
          
          await createFlexFolder(subPayload);
        }
      }
      if (dept === "personnel") {
        const personnelSubfolders = [
          { name: `Gastos de Personal - ${job.title}`, suffix: "GP" },  
        ];

        for (const sf of personnelSubfolders) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.subFolder,
            parentElementId: childRow.element_id,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept as Department],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          await createFlexFolder(subPayload);
        }

        const personnelcrewCall = [
          { name: `Crew Call Sonido - ${job.title}`, suffix: "CCS" },  
          { name: `Crew Call Luces - ${job.title}`, suffix: "CCL" },
        ];

        for (const sf of personnelcrewCall) {
          const subPayload = {
            definitionId: FLEX_FOLDER_IDS.crewCall,
            parentElementId: childRow.element_id,
            open: true,
            locked: false,
            name: sf.name,
            plannedStartDate: formattedStartDate,
            plannedEndDate: formattedEndDate,
            locationId: FLEX_FOLDER_IDS.location,
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept as Department],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          await createFlexFolder(subPayload);
        }
      }
    }
    return;
  }

  console.log("Default job type detected. Creating full folder structure.");

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

  const topFolder = await createFlexFolder(topPayload);
  const topFolderId = topFolder.elementId;

  await supabase
    .from("flex_folders")
    .insert({
      job_id: job.id,
      element_id: topFolderId,
      folder_type: "main_event",
    });

  // Add hojaInfo element to the main folder
  const hojaInfoPayload = {
    definitionId: FLEX_FOLDER_IDS.hojaInfo,
    parentElementId: topFolderId,
    open: true,
    locked: false,
    name: `Hoja de Información - ${job.title}`,
    plannedStartDate: formattedStartDate,
    plannedEndDate: formattedEndDate,
    locationId: FLEX_FOLDER_IDS.location,
    personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
    documentNumber: `${documentNumber}IP`,
  };

  console.log("Creating hojaInfo element:", hojaInfoPayload);
  await createFlexFolder(hojaInfoPayload);

  const departments = ["sound", "lights", "video", "production", "personnel", "comercial"];
  for (const dept of departments) {
    const deptPayload = {
      definitionId: FLEX_FOLDER_IDS.subFolder,
      parentElementId: topFolderId,
      open: true,
      locked: false,
      name: `${job.title} - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
      plannedStartDate: formattedStartDate,
      plannedEndDate: formattedEndDate,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[dept as Department],
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
    };

    console.log(`Creating department folder for ${dept}:`, deptPayload);
    const deptFolder = await createFlexFolder(deptPayload);

    // IMPORTANT: capture the inserted row so we get its internal (local DB) ID,
    // similar to what we do in the tourdate branch.
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

    if (childErr || !childRow) {
      console.error("Error inserting department folder row:", childErr);
      continue;
    }

    const deptFolderId = childRow.element_id;

    if (dept !== "personnel") {
      const subfolders = [
        {
          definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
          name: `Documentación Técnica - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
          suffix: "DT",
        },
        {
          definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
          name: `Presupuestos Recibidos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
          suffix: "PR",
        },
        {
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
          name: `Hoja de Gastos - ${dept.charAt(0).toUpperCase() + dept.slice(1)}`,
          suffix: "HG",
        },
      ];

      for (const sf of subfolders) {
        const subPayload = {
          definitionId: sf.definitionId,
          parentElementId: deptFolderId,
          open: true,
          locked: false,
          name: sf.name,
          plannedStartDate: formattedStartDate,
          plannedEndDate: formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          departmentId: DEPARTMENT_IDS[dept as Department],
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
        };

        await createFlexFolder(subPayload);
      }
    } else if (dept === "personnel") {
      const personnelSubfolders = [
        { name: `Crew Call Sonido - ${job.title}`, suffix: "CCS" },
        { name: `Crew Call Luces - ${job.title}`, suffix: "CCL" },
        { name: `Gastos de Personal - ${job.title}`, suffix: "GP" },
      ];

      for (const sf of personnelSubfolders) {
        const subPayload = {
          definitionId: FLEX_FOLDER_IDS.subFolder,
          parentElementId: deptFolderId,
          open: true,
          locked: false,
          name: sf.name,
          plannedStartDate: formattedStartDate,
          plannedEndDate: formattedEndDate,
          locationId: FLEX_FOLDER_IDS.location,
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
          departmentId: DEPARTMENT_IDS[dept as Department],
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
        };

        await createFlexFolder(subPayload);
      }
    }
  }
}
