import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
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
  const { error } = await supabase
    .from('flex_crew_calls')
    .upsert(
      { job_id: jobId, department: dept, flex_element_id: elementId },
      { onConflict: 'job_id,department' }
    );

  if (error) {
    console.error('Failed to upsert flex_crew_calls:', { jobId, dept, elementId, error });
    throw new Error(
      `Failed to upsert crew call for ${dept} (job_id: ${jobId}, element_id: ${elementId}). Original error: ${error.message}`
    );
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

  // Query existing folders by job_id first
  let allExistingFolders: FlexFolderRow[] = [];

  const { data: existingByJobId, error: existingFoldersError } = await supabase
    .from("flex_folders")
    .select("id, element_id, parent_id, folder_type, department")
    .eq("job_id", job.id);

  if (existingFoldersError) {
    console.error("Failed to load existing Flex folders:", existingFoldersError);
    throw existingFoldersError;
  }

  allExistingFolders = existingByJobId ?? [];

  // For tourdate jobs, also query by tour_date_id to catch folders created via createFoldersForDate
  if (job.job_type === "tourdate" && job.tour_date_id) {
    const { data: existingByTourDateId, error: tourDateFoldersError } = await supabase
      .from("flex_folders")
      .select("id, element_id, parent_id, folder_type, department")
      .eq("tour_date_id", job.tour_date_id);

    if (tourDateFoldersError) {
      console.warn("Failed to load existing Flex folders by tour_date_id:", tourDateFoldersError);
    } else if (existingByTourDateId && existingByTourDateId.length > 0) {
      // Merge, deduplicating by id
      const existingIds = new Set(allExistingFolders.map(f => f.id));
      for (const folder of existingByTourDateId) {
        if (!existingIds.has(folder.id)) {
          allExistingFolders.push(folder);
          existingIds.add(folder.id);
        }
      }
    }
  }

  const existingFolders = allExistingFolders;

  const existingMainFolder =
    existingFolders?.find(folder => folder.folder_type === "main_event") ??
    existingFolders?.find(folder => folder.folder_type === "main");
  const isLegacyMainFolder = existingMainFolder?.folder_type === "main";

  const existingDepartmentMap = new Map<string, FlexFolderRow>();
  const existingWorkOrderMap = new Map<string, FlexFolderRow>();
  // Map of existing tourdate folders per department
  const existingTourdateMap = new Map<string, FlexFolderRow>();
  // Map of ALL existing subfolder types per department: dept -> Set of folder_type strings
  const existingSubfolderTypes = new Map<string, Set<string>>();

  for (const folder of existingFolders ?? []) {
    if (folder.folder_type === "department" && folder.department) {
      existingDepartmentMap.set(folder.department, folder);
    }
    if (folder.folder_type === "work_orders" && folder.department) {
      existingWorkOrderMap.set(folder.department, folder);
    }
    if (folder.folder_type === "tourdate" && folder.department) {
      existingTourdateMap.set(folder.department, folder);
    }
    // Track all folder types per department for sub-element deduplication
    if (folder.department && folder.folder_type) {
      if (!existingSubfolderTypes.has(folder.department)) {
        existingSubfolderTypes.set(folder.department, new Set());
      }
      existingSubfolderTypes.get(folder.department)!.add(folder.folder_type);
    }
  }

  if (isLegacyMainFolder) {
    existingDepartmentMap.clear();
    existingWorkOrderMap.clear();
    existingTourdateMap.clear();
    existingSubfolderTypes.clear();
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
    const dryHirePresupuestoDocumentNumber = `${documentNumber}${dryHireDocumentSuffix}`;
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
      documentNumber: dryHirePresupuestoDocumentNumber,
      personResponsibleId: dryHireFolderPayload.personResponsibleId,
    });

    // Save both dryhire parent and presupuesto folders
    const { error: dryHireInsertErr } = await supabase
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

    if (dryHireInsertErr) {
      console.error("Failed to persist dryhire folders:", dryHireInsertErr);
      console.error(`Orphaned Flex folders: dryhire=${dryHireFolder.elementId}, presupuesto=${presupuestoFolder.elementId}`);
      throw new Error(
        `Failed to persist dryhire folders (dryhire=${dryHireFolder.elementId}, presupuesto=${presupuestoFolder.elementId}). ` +
        `Flex folders were created but could not be recorded in database. Original error: ${dryHireInsertErr.message}`
      );
    }

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
    const locationName = (() => {
      // Priority 1: Main branch logic (optimized jobs)
      const optimizationCandidate = job.location?.name || job.location_data?.name;
      if (optimizationCandidate) return optimizationCandidate;

      // Priority 2: Dev branch logic (robust object scanning)
      if (typeof job.location === "string") {
        const value = job.location.trim();
        if (value) return value;
      }

      if (job.location && typeof job.location === "object") {
        const value = (job.location.name || job.location.formatted_address || "").trim();
        if (value) return value;
      }

      if (job.location_data && typeof job.location_data === "object") {
        const value = (job.location_data.name || job.location_data.formatted_address || "").trim();
        if (value) return value;
      }

      if (typeof job.venue_name === "string") {
        const value = job.venue_name.trim();
        if (value) return value;
      }

      return "No Location";
    })();
    const formattedDate = format(toZonedTime(new Date(job.start_time), "Europe/Madrid"), "MMM d, yyyy");

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

      // Check if a tourdate folder already exists for this department
      const existingTourdate = existingTourdateMap.get(dept);
      let deptFolderId: string;
      let childRow: FlexFolderRow;

      if (existingTourdate?.element_id) {
        console.log(`Reusing existing tourdate folder for ${dept}:`, existingTourdate.element_id);
        deptFolderId = existingTourdate.element_id;
        childRow = existingTourdate;
      } else {
        console.log(`Creating tour date folder for ${dept}:`, tourDateFolderPayload);
        const tourDateFolder = await createFlexFolder(tourDateFolderPayload);

        const { data, error: childErr } = await supabase
          .from("flex_folders")
          .insert({
            job_id: job.id,
            tour_date_id: job.tour_date_id || null,
            parent_id: parentRow.id,
            element_id: tourDateFolder.elementId,
            department: dept,
            folder_type: "tourdate",
          })
          .select("*");

        const insertedRow = data?.[0] ?? null;

        if (childErr || !insertedRow) {
          console.error(`Failed to persist tourdate folder for ${dept}:`, childErr);
          console.error(`Orphaned Flex folder created with element_id: ${tourDateFolder.elementId}`);
          throw new Error(
            `Failed to persist tourdate folder for ${dept} (element_id: ${tourDateFolder.elementId}). ` +
            `Flex folder was created but could not be recorded in database. Original error: ${childErr}`
          );
        }

        deptFolderId = insertedRow.element_id;
        childRow = insertedRow as FlexFolderRow;
        // Track the newly created folder so subsequent checks work
        existingTourdateMap.set(dept, childRow);
      }

      const parentName = tourDateFolderPayload.name;
      const parentDocumentNumber = tourDateFolderPayload.documentNumber;
      const deptExistingSubs = existingSubfolderTypes.get(dept) ?? new Set<string>();

      // Create department-specific hojaInfo elements for sound, lights, and video
      if (
        ["sound", "lights", "video"].includes(dept) &&
        shouldCreateItem(dept, "hojaInfo", options)
      ) {
        const hojaInfoFolderType = dept === "sound"
          ? "hoja_info_sx"
          : dept === "lights"
            ? "hoja_info_lx"
            : "hoja_info_vx";

        if (deptExistingSubs.has(hojaInfoFolderType)) {
          console.log(`Skipping hojaInfo for ${dept} - already exists`);
        } else {
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

          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              tour_date_id: job.tour_date_id || null,
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
      }

      if (dept !== "personnel" && dept !== "comercial") {
        const subfolders = [
          {
            definitionId: FLEX_FOLDER_IDS.documentacionTecnica,
            name: `${tourData.name} - ${locationName} - ${formattedDate} - Documentación Técnica - ${deptLabel}`,
            suffix: "DT",
            key: "documentacionTecnica" as const,
            folderType: "doc_tecnica",
          },
          {
            definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
            name: `${tourData.name} - ${locationName} - ${formattedDate} - Presupuestos Recibidos - ${deptLabel}`,
            suffix: "PR",
            key: "presupuestosRecibidos" as const,
            folderType: "presupuestos_recibidos",
          },
          {
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            name: `${tourData.name} - ${locationName} - ${formattedDate} - Hoja de Gastos - ${deptLabel}`,
            suffix: "HG",
            key: "hojaGastos" as const,
            folderType: "hoja_gastos",
          },
        ];

        for (const sf of subfolders) {
          if (!shouldCreateItem(dept, sf.key, options)) continue;

          if (deptExistingSubs.has(sf.folderType)) {
            console.log(`Skipping ${sf.key} for ${dept} - already exists`);
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
            departmentId: DEPARTMENT_IDS[dept as Department],
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          const subFolderResponse = await createFlexFolder(subPayload);

          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              tour_date_id: job.tour_date_id || null,
              parent_id: childRow.id,
              element_id: subFolderResponse.elementId,
              department: dept,
              folder_type: sf.folderType,
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
        // Only create comercial extras if none exist yet for this department
        const hasComercialExtras = deptExistingSubs.has("comercial_extras") || deptExistingSubs.has("comercial_presupuesto");
        if (!hasComercialExtras) {
          await createComercialExtras(
            deptFolderId,
            parentName,
            parentDocumentNumber,
            safeJobTitle
          );
        } else {
          console.log(`Skipping comercial extras for ${dept} - already exist`);
        }
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

          // Legacy records use generic "pull_sheet"; if present, skip all pullsheets
          const hasLegacyPullSheet = deptExistingSubs.has("pull_sheet");

          const documentPrefix = `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`;

          for (const template of templates) {
            const specificType = `pull_sheet_${template.suffix.toLowerCase()}`;
            if (hasLegacyPullSheet || deptExistingSubs.has(specificType)) {
              console.log(`Skipping pullsheet ${template.suffix} for ${dept} - already exists`);
              continue;
            }

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

            // Persist pullsheet element ID to database with specific folder_type
            try {
              await supabase.from("flex_folders").insert({
                job_id: job.id,
                tour_date_id: job.tour_date_id || null,
                parent_id: childRow.id,
                element_id: pullsheetResponse.elementId,
                department: dept,
                folder_type: specificType,
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
          folderType: string;
        }[] = [];
        if (shouldCreateItem("personnel", "workOrder", options)) {
          personnelSubfolders.push({
            name: `Orden de Trabajo - ${job.title}`,
            suffix: "OT",
            definitionId: FLEX_FOLDER_IDS.ordenTrabajo,
            folderType: "work_orders",
          });
        }
        if (shouldCreateItem("personnel", "gastosDePersonal", options)) {
          personnelSubfolders.push({
            name: `Gastos de Personal - ${job.title}`,
            suffix: "GP",
            definitionId: FLEX_FOLDER_IDS.hojaGastos,
            folderType: "hoja_gastos",
          });
        }

        for (const sf of personnelSubfolders) {
          if (deptExistingSubs.has(sf.folderType)) {
            console.log(`Skipping ${sf.folderType} for personnel - already exists`);
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
            documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
            departmentId: DEPARTMENT_IDS[dept as Department],
            personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
          };

          const created = await createFlexFolder(subPayload);

          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              tour_date_id: job.tour_date_id || null,
              parent_id: childRow.id,
              element_id: created.elementId,
              department: dept,
              folder_type: sf.folderType,
            });
            console.log(`Persisted ${sf.folderType} for personnel with element_id: ${created.elementId}`);
          } catch (err) {
            console.error(`Failed to persist ${sf.folderType} for personnel:`, err);
            console.error(`Orphaned Flex folder created with element_id: ${created.elementId}`);
            throw new Error(
              `Failed to persist ${sf.folderType} for personnel (element_id: ${created.elementId}). ` +
              `Flex folder was created but could not be recorded in database. Original error: ${err}`
            );
          }
        }

        const personnelcrewCall: { name: string; suffix: "CCS" | "CCL"; folderType: string }[] = [];
        if (shouldCreateItem("personnel", "crewCallSound", options)) {
          personnelcrewCall.push({ name: `Crew Call Sonido - ${job.title}`, suffix: "CCS", folderType: "crew_call_sound" });
        }
        if (shouldCreateItem("personnel", "crewCallLights", options)) {
          personnelcrewCall.push({ name: `Crew Call Luces - ${job.title}`, suffix: "CCL", folderType: "crew_call_lights" });
        }

        for (const sf of personnelcrewCall) {
          if (deptExistingSubs.has(sf.folderType)) {
            console.log(`Skipping ${sf.folderType} for personnel - already exists`);
            continue;
          }

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

          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              tour_date_id: job.tour_date_id || null,
              parent_id: childRow.id,
              element_id: cc.elementId,
              department: dept,
              folder_type: sf.folderType,
            });
            console.log(`Persisted ${sf.folderType} for personnel with element_id: ${cc.elementId}`);
          } catch (err) {
            console.error(`Failed to persist ${sf.folderType} for personnel:`, err);
            console.error(`Orphaned Flex folder created with element_id: ${cc.elementId}`);
            throw new Error(
              `Failed to persist ${sf.folderType} for personnel (element_id: ${cc.elementId}). ` +
              `Flex folder was created but could not be recorded in database. Original error: ${err}`
            );
          }
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

    const { error: mainInsertErr } = await supabase
      .from("flex_folders")
      .insert({
        job_id: job.id,
        element_id: topFolderId,
        folder_type: "main_event",
      });

    if (mainInsertErr) {
      console.error("Failed to persist main folder:", mainInsertErr);
      console.error(`Orphaned Flex folder created with element_id: ${topFolderId}`);
      throw new Error(
        `Failed to persist main folder (element_id: ${topFolderId}). ` +
        `Flex folder was created but could not be recorded in database. Original error: ${mainInsertErr.message}`
      );
    }
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

      const { data, error: childErr } = await supabase
        .from("flex_folders")
        .insert({
          job_id: job.id,
          parent_id: topFolderId,
          element_id: deptFolder.elementId,
          department: dept,
          folder_type: "department",
        })
        .select("*");

      const childRow = data?.[0] ?? null;

      if (childErr || !childRow) {
        console.error(`Failed to persist department folder for ${dept}:`, childErr);
        console.error(`Orphaned Flex folder created with element_id: ${deptFolder.elementId}`);
        throw new Error(
          `Failed to persist department folder for ${dept} (element_id: ${deptFolder.elementId}). ` +
          `Flex folder was created but could not be recorded in database. Original error: ${childErr}`
        );
      }

      deptFolderId = childRow.element_id ?? deptFolder.elementId;

      if (childRow.department) {
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
    const deptExistingSubs = existingSubfolderTypes.get(dept) ?? new Set<string>();

    // Create department-specific hojaInfo elements for sound, lights, and video
    if (
      ["sound", "lights", "video"].includes(dept) &&
      shouldCreateItem(dept, "hojaInfo", options)
    ) {
      const hojaInfoFolderType = dept === "sound"
        ? "hoja_info_sx"
        : dept === "lights"
          ? "hoja_info_lx"
          : "hoja_info_vx";

      if (deptExistingSubs.has(hojaInfoFolderType)) {
        console.log(`Skipping hojaInfo for ${dept} - already exists`);
      } else {
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

        // Legacy records use generic "pull_sheet"; if present, skip all pullsheets
        const hasLegacyPullSheet = deptExistingSubs.has("pull_sheet");

        const documentPrefix = `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}`;

        for (const template of templates) {
          const specificType = `pull_sheet_${template.suffix.toLowerCase()}`;
          if (hasLegacyPullSheet || deptExistingSubs.has(specificType)) {
            console.log(`Skipping pullsheet ${template.suffix} for ${dept} - already exists`);
            continue;
          }

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

          // Persist pullsheet element ID to database with specific folder_type
          const parentFolderRow = existingDepartmentMap.get(dept);
          try {
            await supabase.from("flex_folders").insert({
              job_id: job.id,
              parent_id: parentFolderRow?.id ?? null,
              element_id: pullsheetResponse.elementId,
              department: dept,
              folder_type: specificType,
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
          folderType: "doc_tecnica",
        },
        {
          definitionId: FLEX_FOLDER_IDS.presupuestosRecibidos,
          name: `${job.title} - Presupuestos Recibidos - ${deptLabel}`,
          suffix: "PR",
          key: "presupuestosRecibidos" as const,
          folderType: "presupuestos_recibidos",
        },
        {
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
          name: `${job.title} - Hoja de Gastos - ${deptLabel}`,
          suffix: "HG",
          key: "hojaGastos" as const,
          folderType: "hoja_gastos",
        },
      ];

      for (const sf of subfolders) {
        if (!shouldCreateItem(dept, sf.key, options)) continue;

        if (deptExistingSubs.has(sf.folderType)) {
          console.log(`Skipping ${sf.key} for ${dept} - already exists`);
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
          departmentId: DEPARTMENT_IDS[dept as Department],
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
        };

        const created = await createFlexFolder(subPayload);

        const parentFolderRow = existingDepartmentMap.get(dept);
        try {
          await supabase.from("flex_folders").insert({
            job_id: job.id,
            parent_id: parentFolderRow?.id ?? null,
            element_id: created.elementId,
            department: dept,
            folder_type: sf.folderType,
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
      // Only create comercial extras if none exist yet for this department
      const hasComercialExtras = deptExistingSubs.has("comercial_extras") || deptExistingSubs.has("comercial_presupuesto");
      if (!hasComercialExtras) {
        await createComercialExtras(
          deptFolderId,
          parentName,
          parentDocumentNumber,
          safeJobTitle
        );
      } else {
        console.log(`Skipping comercial extras for ${dept} - already exist`);
      }
    } else if (dept === "personnel") {
      // Non-crew-call personnel subfolders
      const personnelSubfolders = [
        {
          name: `Orden de Trabajo - ${job.title}`,
          suffix: "OT",
          key: "workOrder" as const,
          definitionId: FLEX_FOLDER_IDS.ordenTrabajo,
          folderType: "work_orders",
        },
        {
          name: `Gastos de Personal - ${job.title}`,
          suffix: "GP",
          key: "gastosDePersonal" as const,
          definitionId: FLEX_FOLDER_IDS.hojaGastos,
          folderType: "hoja_gastos",
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
        if (sf.key === "gastosDePersonal" && deptExistingSubs.has("hoja_gastos")) {
          console.log(`Skipping gastos de personal for ${dept} - already exists`);
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
          documentNumber: `${documentNumber}${DEPARTMENT_SUFFIXES[dept as Department]}${sf.suffix}`,
          departmentId: DEPARTMENT_IDS[dept as Department],
          personResponsibleId: RESPONSIBLE_PERSON_IDS[dept as Department],
        };

        const created = await createFlexFolder(subPayload);

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

      // Crew call subfolders (with dedup guards and DB persistence)
      const personnelCrewCalls: { name: string; suffix: "CCS" | "CCL"; folderType: string; crewCallDepartment: "sound" | "lights" }[] = [];
      if (shouldCreateItem("personnel", "crewCallSound", options)) {
        personnelCrewCalls.push({ name: `Crew Call Sonido - ${job.title}`, suffix: "CCS", folderType: "crew_call_sound", crewCallDepartment: "sound" });
      }
      if (shouldCreateItem("personnel", "crewCallLights", options)) {
        personnelCrewCalls.push({ name: `Crew Call Luces - ${job.title}`, suffix: "CCL", folderType: "crew_call_lights", crewCallDepartment: "lights" });
      }

      for (const sf of personnelCrewCalls) {
        if (deptExistingSubs.has(sf.folderType)) {
          console.log(`Skipping ${sf.folderType} for personnel - already exists`);
          continue;
        }

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
        await upsertCrewCall(job.id, sf.crewCallDepartment, cc.elementId);

        const parentFolderRow = existingDepartmentMap.get(dept);
        try {
          await supabase.from("flex_folders").insert({
            job_id: job.id,
            parent_id: parentFolderRow?.id ?? null,
            element_id: cc.elementId,
            department: dept,
            folder_type: sf.folderType,
          });
          console.log(`Persisted ${sf.folderType} for personnel with element_id: ${cc.elementId}`);
        } catch (err) {
          console.error(`Failed to persist ${sf.folderType} for personnel:`, err);
          console.error(`Orphaned Flex folder created with element_id: ${cc.elementId}`);
          throw new Error(
            `Failed to persist ${sf.folderType} for personnel (element_id: ${cc.elementId}). ` +
            `Flex folder was created but could not be recorded in database. Original error: ${err}`
          );
        }
      }
    }
  }
}
