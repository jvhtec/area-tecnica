import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import {
  CreateFoldersOptions,
  DepartmentKey,
  SubfolderKey,
  getDepartmentCustomPullsheetMetadata,
  getDepartmentExtrasPresupuestoMetadata,
  getSubfolderSelectionSummary,
} from "./types";
import { createFlexFolder } from "./api";
import {
  FLEX_FOLDER_IDS,
  DEPARTMENT_IDS,
  RESPONSIBLE_PERSON_IDS,
  DEPARTMENT_SUFFIXES
} from "./constants";
import { getDryhireParentFolderId } from "./dryhireFolderService";

/**
 * Format date string for Flex API (ISO format with milliseconds)
 * @param dateStr Date string to format
 * @returns Formatted date string or undefined if invalid
 */
function formatDateForFlex(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString().split('.')[0] + '.000Z';
  } catch {
    return undefined;
  }
}

/**
 * Helper function to fetch selected departments for a job
 */
async function getJobDepartments(jobId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("job_departments")
    .select("department")
    .eq("job_id", jobId);

  if (error) {
    console.error("Error fetching job departments:", error);
    return [];
  }

  return data.map(d => d.department);
}

/**
 * Helper function to get departments for a tour job
 */
async function getTourJobDepartments(tourId: string): Promise<string[]> {
  // Get departments from any job in the tour
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      job_departments (department)
    `)
    .eq("tour_id", tourId)
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error("Error fetching tour job departments:", error);
    return [];
  }

  return data[0].job_departments?.map((jd: any) => jd.department) || [];
}

// Save or update the Flex crew call element id for a job/department
async function upsertCrewCall(jobId: string, dept: 'sound' | 'lights', elementId: string) {
  try {
    const { data: existing } = await supabase
      .from('flex_crew_calls')
      .select('id')
      .eq('job_id', jobId)
      .eq('department', dept)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('flex_crew_calls')
        .update({ flex_element_id: elementId })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('flex_crew_calls')
        .insert({ job_id: jobId, department: dept, flex_element_id: elementId });
    }
  } catch (err) {
    console.error('Failed to upsert flex_crew_calls:', { jobId, dept, elementId, err });
  }
}

/**
 * Determines which departments should have folders created
 */
function shouldCreateDepartmentFolder(department: string, selectedDepartments: string[]): boolean {
  // Always create these administrative departments
  const alwaysCreateDepartments = ["production", "personnel", "comercial"];

  if (alwaysCreateDepartments.includes(department)) {
    return true;
  }

  // For technical departments (sound, lights, video), only create if selected
  const technicalDepartments = ["sound", "lights", "video"];
  if (technicalDepartments.includes(department)) {
    return selectedDepartments.includes(department);
  }

  return false;
}

function shouldCreateItem(
  dept: DepartmentKey,
  key: SubfolderKey,
  options?: CreateFoldersOptions
): boolean {
  // Backwards-compatible default: if no options are provided, create everything.
  if (!options) return true;

  // If options are provided, treat missing departments as "not selected".
  // This matches FlexFolderPicker semantics where users explicitly choose what to create.
  const selection = options[dept];
  if (selection === undefined) return false;

  const { keys, hasExplicitSelection } = getSubfolderSelectionSummary(selection);
  if (!hasExplicitSelection) return true;
  return keys.includes(key);
}

interface PullsheetTemplate {
  name: string;
  suffix: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

interface PullsheetMetadataEntry {
  name?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

const buildPullsheetTemplates = (
  defaultEntries: PullsheetTemplate[],
  metadataEntries: PullsheetMetadataEntry[],
  fallbackStartDate: string,
  fallbackEndDate: string,
  fallbackNameForIndex: (index: number, defaultEntry?: PullsheetTemplate) => string
): PullsheetTemplate[] => {
  const templates: PullsheetTemplate[] = [];
  const usedSuffixes = new Set<string>();

  const getUniqueSuffix = (preferred?: string): string => {
    const trimmed = preferred?.trim();
    if (trimmed && !usedSuffixes.has(trimmed)) {
      usedSuffixes.add(trimmed);
      return trimmed;
    }

    let counter = 1;
    while (true) {
      const candidate = `PS${String(counter).padStart(2, "0")}`;
      if (!usedSuffixes.has(candidate)) {
        usedSuffixes.add(candidate);
        return candidate;
      }
      counter += 1;
    }
  };

  const sanitizedMetadata = metadataEntries.filter(entry =>
    Boolean(entry?.name) || Boolean(entry?.plannedStartDate) || Boolean(entry?.plannedEndDate)
  );

  if (sanitizedMetadata.length > 0) {
    sanitizedMetadata.forEach((entry, index) => {
      const defaultEntry = defaultEntries[index];
      const name = entry.name?.trim?.() || defaultEntry?.name || fallbackNameForIndex(index, defaultEntry);

      const plannedStartDate =
        formatDateForFlex(entry.plannedStartDate) ||
        formatDateForFlex(defaultEntry?.plannedStartDate) ||
        fallbackStartDate;
      const plannedEndDate =
        formatDateForFlex(entry.plannedEndDate) ||
        formatDateForFlex(defaultEntry?.plannedEndDate) ||
        fallbackEndDate;
      const suffix = getUniqueSuffix(defaultEntry?.suffix);

      templates.push({ name, plannedStartDate, plannedEndDate, suffix });
    });

    if (sanitizedMetadata.length < defaultEntries.length) {
      for (let index = sanitizedMetadata.length; index < defaultEntries.length; index += 1) {
        const defaultEntry = defaultEntries[index];
        templates.push({
          name: defaultEntry.name,
          plannedStartDate: defaultEntry.plannedStartDate || fallbackStartDate,
          plannedEndDate: defaultEntry.plannedEndDate || fallbackEndDate,
          suffix: getUniqueSuffix(defaultEntry.suffix),
        });
      }
    }
  } else {
    defaultEntries.forEach(defaultEntry => {
      templates.push({
        name: defaultEntry.name,
        plannedStartDate: defaultEntry.plannedStartDate || fallbackStartDate,
        plannedEndDate: defaultEntry.plannedEndDate || fallbackEndDate,
        suffix: getUniqueSuffix(defaultEntry.suffix),
      });
    });
  }

  return templates;
};

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
  documentNumber: string,
  options?: CreateFoldersOptions
) {
  type FlexFolderRow = {
    id: string;
    element_id: string;
    parent_id: string | null;
    folder_type: string | null;
    department: string | null;
  };

  const { data: existingFolders, error: existingFoldersError } = await supabase
    .from("flex_folders")
    .select("id, element_id, parent_id, folder_type, department")
    .eq("job_id", job.id);

  if (existingFoldersError) {
    console.error("Failed to load existing Flex folders:", existingFoldersError);
    throw existingFoldersError;
  }

  const existingMainFolder =
    existingFolders?.find(folder => folder.folder_type === "main_event") ??
    existingFolders?.find(folder => folder.folder_type === "main");
  const isLegacyMainFolder = existingMainFolder?.folder_type === "main";

  const existingDepartmentMap = new Map<string, FlexFolderRow>();
  const existingWorkOrderMap = new Map<string, FlexFolderRow>();
  for (const folder of existingFolders ?? []) {
    if (folder.folder_type === "department" && folder.department) {
      existingDepartmentMap.set(folder.department, folder);
    }
    if (folder.folder_type === "work_orders" && folder.department) {
      existingWorkOrderMap.set(folder.department, folder);
    }
  }

  if (isLegacyMainFolder) {
    existingDepartmentMap.clear();
    existingWorkOrderMap.clear();
  }

  const safeJobTitle = job?.title?.trim?.() || job?.title || "Sin título";

  const createComercialExtras = async (
    parentElementId: string,
    parentName: string,
    parentDocumentNumber: string | undefined,
    jobTitle: string
  ) => {
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
        departmentId: DEPARTMENT_IDS[extra.dept as Department],
        documentNumber: `${parentDoc}${extra.suffix}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[extra.dept as Department],
      };

      let presupuestoParentId = parentElementId; // Default: create presupuesto directly in comercial folder
      let presupuestoParentDbId: string | null = null;

      // Create extras folder if requested
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

        // Persist comercial extras folder and capture DB row ID
        try {
          const { data: insertedRow, error: insertError } = await supabase
            .from("flex_folders")
            .insert({
              job_id: job.id,
              parent_id: parentElementId,
              element_id: extrasFolderElementId,
              department: extra.dept,
              folder_type: "comercial_extras",
            })
            .select('id')
            .single();

          if (insertError) {
            throw insertError;
          }

          if (!insertedRow?.id) {
            throw new Error('Failed to retrieve inserted row ID');
          }

          console.log(`Persisted comercial extras folder for ${extra.dept} with element_id: ${extrasFolderElementId}, db_id: ${insertedRow.id}`);

          // If extras folder was created, presupuestos go inside it
          presupuestoParentId = extrasFolderElementId; // Element ID for Flex API
          presupuestoParentDbId = insertedRow.id; // DB row ID for parent_id field
        } catch (err) {
          console.error(`Failed to persist comercial extras folder for ${extra.dept}:`, err);
          console.error(`Orphaned Flex folder created with element_id: ${extrasFolderElementId}`);
          throw new Error(
            `Failed to persist comercial extras folder for ${extra.dept} (element_id: ${extrasFolderElementId}). ` +
            `Flex folder was created but could not be recorded in database. Original error: ${err}`
          );
        }
      }

      // Create presupuesto(s) if requested
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

          // Name differs based on whether it's inside extras or standalone
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
            departmentId: DEPARTMENT_IDS[extra.dept as Department],
            documentNumber:
              presupuestoEntries.length > 1
                ? `${sharedPayload.documentNumber}PR${String(index + 1).padStart(2, "0")}`
                : sharedPayload.documentNumber,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[extra.dept as Department],
          };

          const presupuestoResponse = await createFlexFolder(childPayload);

          // Persist comercial presupuesto
          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
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

  if (job.job_type === "dryhire") {
    console.log("Dryhire job type detected. Creating dryhire folder...");

    const hasExistingDryhire = (existingFolders ?? []).some(
      folder => folder.folder_type === "dryhire"
    );

    if (hasExistingDryhire) {
      console.log("Dryhire Flex folder already exists. Skipping creation.");
      return;
    }

    const department = job.job_departments[0]?.department;
    if (!department || !["sound", "lights"].includes(department)) {
      throw new Error("Invalid department for dryhire job");
    }

    const startDate = new Date(job.start_time);
    const year = startDate.getFullYear();
    const monthKey = startDate.toISOString().slice(5, 7);
    const parentFolderId = await getDryhireParentFolderId(year, department as "sound" | "lights", monthKey);

    if (!parentFolderId) {
      throw new Error(`No parent folder found for ${year}/${monthKey}. Please create dryhire folders for ${year} in Settings.`);
    }

    const parentDocumentNumber = `${documentNumber}${DEPARTMENT_SUFFIXES[department as Department]}`;
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
      documentNumber: parentDocumentNumber,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[department as Department],
    };

    console.log("Creating dryhire folder with payload:", dryHireFolderPayload);
    const dryHireFolder = await createFlexFolder(dryHireFolderPayload);

    const dryHireDocumentSuffix = department === "sound" ? "SDH" : "LDH";
    const presupuestoFolder = await createFlexFolder({
      definitionId: FLEX_FOLDER_IDS.presupuestoDryHire,
      parentElementId: dryHireFolder.elementId,
      open: true,
      locked: false,
      name: dryHireFolderPayload.name,
      plannedStartDate: dryHireFolderPayload.plannedStartDate,
      plannedEndDate: dryHireFolderPayload.plannedEndDate,
      locationId: dryHireFolderPayload.locationId,
      departmentId: dryHireFolderPayload.departmentId,
      documentNumber: `${parentDocumentNumber}${dryHireDocumentSuffix}`,
      personResponsibleId: dryHireFolderPayload.personResponsibleId,
    });

    // Save both dryhire parent and presupuesto folders
    await supabase
      .from("flex_folders")
      .insert([
        {
          job_id: job.id,
          parent_id: parentFolderId,
          element_id: dryHireFolder.elementId,
          department: department,
          folder_type: "dryhire",
        },
        {
          job_id: job.id,
          parent_id: dryHireFolder.elementId,
          element_id: presupuestoFolder.elementId,
          department: department,
          folder_type: "dryhire_presupuesto",
        }
      ]);

    return;
  }

  if (job.job_type === "tourdate") {
    console.log("Tourdate job type detected. Validating tour data...");

    if (!job.tour_id) {
      throw new Error("Tour ID is missing for tourdate job");
    }

    // Get selected departments for the tour
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

    // Get tour date info to check if it's tour pack only
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

    // Check both possible location sources (from different hooks)
    // useJobs uses job.location, useOptimizedJobs uses job.location_data
    let locationName = job.location?.name || job.location_data?.name;

    // If no location in the job object, fetch it from the database using location_id
    if (!locationName && job.location_id) {
      const { data: locationData } = await supabase
        .from("locations")
        .select("name")
        .eq("id", job.location_id)
        .single();
      locationName = locationData?.name;
    }
    locationName = locationName || "No Location";

    const formattedDate = format(new Date(job.start_time), "MMM d, yyyy");

    for (const dept of allDepartments) {
      // Check if this department should have a folder created
      if (!shouldCreateDepartmentFolder(dept, selectedDepartments)) {
        console.log(`Skipping ${dept} folder - department not selected`);
        continue;
      }

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

      const deptLabel = dept.charAt(0).toUpperCase() + dept.slice(1);

      const tourDateFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: parentFolderId,
        open: true,
        locked: false,
        name: `${locationName} - ${formattedDate} - ${deptLabel}`,
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

      const deptFolderId = childRow.element_id;
      const parentName = tourDateFolderPayload.name;
      const parentDocumentNumber = tourDateFolderPayload.documentNumber;

      // Create department-specific hojaInfo elements for sound, lights, and video
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
          departmentId: DEPARTMENT_IDS[dept as Department],
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${hojaInfoSuffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
        };

        console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
        const hojaInfoResponse = await createFlexFolder(hojaInfoPayload);

        // Persist hojaInfo element ID
        const hojaInfoFolderType = dept === "sound"
          ? "hoja_info_sx"
          : dept === "lights"
            ? "hoja_info_lx"
            : "hoja_info_vx";

        try {
          await supabase.from("flex_folders").insert({
            job_id: job.id,
            parent_id: childRow.id,
            element_id: hojaInfoResponse.elementId,
            department: dept,
            folder_type: hojaInfoFolderType,
          });
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
            departmentId: DEPARTMENT_IDS[dept as Department],
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          const subFolderResponse = await createFlexFolder(subPayload);

          // Persist subfolder element ID
          const folderTypeMap: Record<string, string> = {
            documentacionTecnica: "doc_tecnica",
            presupuestosRecibidos: "presupuestos_recibidos",
            hojaGastos: "hoja_gastos",
          };

          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              parent_id: childRow.id,
              element_id: subFolderResponse.elementId,
              department: dept,
              folder_type: folderTypeMap[sf.key],
            });
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
        await createComercialExtras(
          deptFolderId,
          parentName,
          parentDocumentNumber,
          safeJobTitle
        );
      }
      if (["sound", "lights", "video"].includes(dept)) {
        const metadataEntries = getDepartmentCustomPullsheetMetadata(options?.[dept]);
        const defaultPullsheets: PullsheetTemplate[] = [];

        if (dept === "sound") {
          const isTourPackOnly = tourDateInfo?.is_tour_pack_only || false;
          console.log(`Tour pack only setting for sound folder:`, isTourPackOnly);

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
          const fallbackNameForIndex = (index: number, defaultEntry?: PullsheetTemplate) => {
            if (defaultEntry?.name) return defaultEntry.name;
            const base = `${parentName} - Pullsheet`;
            return `${base}${index > 0 ? ` ${index + 1}` : ""}`;
          };

          const templates = buildPullsheetTemplates(
            defaultPullsheets,
            metadataEntries,
            formattedStartDate,
            formattedEndDate,
            fallbackNameForIndex
          );

          const documentPrefix = `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`;

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
              departmentId: DEPARTMENT_IDS[dept as Department],
              documentNumber: `${documentPrefix}${template.suffix}`,
              personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
            };

            const pullsheetResponse = await createFlexFolder(pullsheetPayload);

            // Persist pullsheet element ID to database
            try {
              await supabase.from("flex_folders").insert({
                job_id: job.id,
                parent_id: childRow.id,
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
      if (dept === "personnel") {
        const personnelSubfolders: {
          name: string;
          suffix: string;
          definitionId: string;
        }[] = [];
        if (shouldCreateItem("personnel", "workOrder", options)) {
          personnelSubfolders.push({
            name: `Orden de Trabajo - ${job.title}`,
            suffix: "OT",
            definitionId: FLEX_FOLDER_IDS.ordenTrabajo,
          });
        }
        if (shouldCreateItem("personnel", "gastosDePersonal", options)) {
          personnelSubfolders.push({
            name: `Gastos de Personal - ${job.title}`,
            suffix: "GP",
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
          });
        }

        for (const sf of personnelSubfolders) {
          const subPayload = {
            definitionId: sf.definitionId,
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
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept as Department],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          const cc = await createFlexFolder(subPayload);
          const mappedDept = sf.suffix === 'CCS' ? 'sound' : 'lights';
          await upsertCrewCall(job.id, mappedDept, cc.elementId);
        }
      }
    }
    return;
  }

  console.log("Default job type detected. Creating full folder structure.");

  // Get selected departments for regular jobs
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
    // Check if this department should have a folder created
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
      departmentId: DEPARTMENT_IDS[dept as Department],
      documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`,
      personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
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

    // Create department-specific hojaInfo elements for sound, lights, and video
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
        departmentId: DEPARTMENT_IDS[dept as Department],
        documentNumber: `${documentNumber}${hojaInfoSuffix}`,
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
      };

      console.log(`Creating hojaInfo element for ${dept}:`, hojaInfoPayload);
      const hojaInfoResponse = await createFlexFolder(hojaInfoPayload);

      // Persist hojaInfo element ID
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
        const fallbackNameForIndex = (index: number, defaultEntry?: PullsheetTemplate) => {
          if (defaultEntry?.name) return defaultEntry.name;
          const base = `${safeJobTitle} - ${deptLabel} Pullsheet`;
          return `${base}${index > 0 ? ` ${index + 1}` : ""}`;
        };

        const templates = buildPullsheetTemplates(
          defaultPullsheets,
          metadataEntries,
          formattedStartDate,
          formattedEndDate,
          fallbackNameForIndex
        );

        const documentPrefix = `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`;

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
            departmentId: DEPARTMENT_IDS[dept as Department],
            documentNumber: `${documentPrefix}${template.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          const pullsheetResponse = await createFlexFolder(pullsheetPayload);

          // Persist pullsheet element ID to database
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
          departmentId: DEPARTMENT_IDS[dept as Department],
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
        };

        const created = await createFlexFolder(subPayload);

        // Persist subfolder element ID
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
      await createComercialExtras(
        deptFolderId,
        parentName,
        parentDocumentNumber,
        safeJobTitle
      );
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
            console.log(
              `Reusing existing work order folder for ${dept}:`,
              existingWorkOrder.element_id
            );
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
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
          departmentId: DEPARTMENT_IDS[dept as Department],
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
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
}
