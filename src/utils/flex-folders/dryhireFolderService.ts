import { supabase } from "@/integrations/supabase/client";
import { createFlexFolder } from "./api";
import { FLEX_FOLDER_IDS, DEPARTMENT_IDS, RESPONSIBLE_PERSON_IDS } from "./constants";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

type DryhireDepartment = "sound" | "lights";

interface YearFolderStatus {
  year: number;
  sound: number;
  lights: number;
}

interface DryhireParentFolder {
  id: string;
  year: number;
  department: string;
  month: string;
  element_id: string;
  created_at: string;
}

/**
 * Get the status of dryhire folders for all years
 */
export async function getDryhireYearStatuses(): Promise<YearFolderStatus[]> {
  const { data, error } = await supabase
    .from("dryhire_parent_folders")
    .select("year, department")
    .order("year", { ascending: true });

  if (error) {
    console.error("Error fetching dryhire folder statuses:", error);
    throw new Error("Failed to fetch dryhire folder statuses");
  }

  // Group by year and count per department
  const yearMap = new Map<number, { sound: number; lights: number }>();

  for (const row of data || []) {
    if (!yearMap.has(row.year)) {
      yearMap.set(row.year, { sound: 0, lights: 0 });
    }
    const counts = yearMap.get(row.year)!;
    if (row.department === "sound") counts.sound++;
    if (row.department === "lights") counts.lights++;
  }

  return Array.from(yearMap.entries()).map(([year, counts]) => ({
    year,
    ...counts,
  }));
}

/**
 * Get the parent folder ID for a dryhire job
 */
export async function getDryhireParentFolderId(
  year: number,
  department: DryhireDepartment,
  month: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("dryhire_parent_folders")
    .select("element_id")
    .eq("year", year)
    .eq("department", department)
    .eq("month", month)
    .single();

  if (error) {
    console.error("Error fetching dryhire parent folder:", error);
    return null;
  }

  return data?.element_id || null;
}

/**
 * Create all dryhire folders for a given year
 */
export async function createDryhireYearFolders(year: number): Promise<void> {
  const departments: DryhireDepartment[] = ["sound", "lights"];
  const departmentLabels: Record<DryhireDepartment, string> = {
    sound: "Sonido",
    lights: "Luces",
  };

  // Document number prefixes: 666 for sound, 555 for lights
  const departmentPrefixes: Record<DryhireDepartment, string> = {
    sound: "666",
    lights: "555",
  };

  // Check if folders already exist for this year
  const { data: existing } = await supabase
    .from("dryhire_parent_folders")
    .select("id")
    .eq("year", year)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error(`Dryhire folders for ${year} already exist`);
  }

  // Generate dates for the year
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year}-12-31T23:59:59.000Z`;

  // Get last 2 digits of year
  const yearSuffix = String(year).slice(-2);

  for (const dept of departments) {
    // Document number for root folder: XXX.YY (e.g., 555.25 for lights 2025)
    const rootDocumentNumber = `${departmentPrefixes[dept]}.${yearSuffix}`;

    // Create main folder for the year/department
    const mainFolderPayload = {
      definitionId: FLEX_FOLDER_IDS.mainFolder,
      open: true,
      locked: false,
      name: `Dry Hire ${year} - ${departmentLabels[dept]}`,
      plannedStartDate: yearStart,
      plannedEndDate: yearEnd,
      locationId: FLEX_FOLDER_IDS.location,
      departmentId: DEPARTMENT_IDS[dept],
      personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
      documentNumber: rootDocumentNumber,
    };

    console.log(`Creating main dryhire folder for ${year} ${dept}:`, mainFolderPayload);
    const mainFolder = await createFlexFolder(mainFolderPayload);

    if (!mainFolder.elementId) {
      throw new Error(`Failed to create main folder for ${year} ${dept}`);
    }

    console.log(`Created main folder with elementId: ${mainFolder.elementId}`);

    // Create 12 month subfolders
    const insertRows: Array<{
      year: number;
      department: DryhireDepartment;
      month: string;
      element_id: string;
    }> = [];

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthKey = String(monthIndex + 1).padStart(2, "0");
      const monthName = MONTH_NAMES[monthIndex];

      // Document number for month subfolder: XXX.YY.MM (e.g., 555.25.01 for lights Jan 2025)
      const monthDocumentNumber = `${rootDocumentNumber}.${monthKey}`;

      // Calculate month start/end dates
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);

      const subFolderPayload = {
        definitionId: FLEX_FOLDER_IDS.subFolder,
        parentElementId: mainFolder.elementId,
        open: true,
        locked: false,
        name: monthName,
        plannedStartDate: monthStart.toISOString().split(".")[0] + ".000Z",
        plannedEndDate: monthEnd.toISOString().split(".")[0] + ".000Z",
        locationId: FLEX_FOLDER_IDS.location,
        departmentId: DEPARTMENT_IDS[dept],
        personResponsibleId: RESPONSIBLE_PERSON_IDS[dept],
        documentNumber: monthDocumentNumber,
      };

      console.log(`Creating ${monthName} subfolder for ${year} ${dept}:`, subFolderPayload);
      const monthFolder = await createFlexFolder(subFolderPayload);

      if (!monthFolder.elementId) {
        throw new Error(`Failed to create ${monthName} folder for ${year} ${dept}`);
      }

      console.log(`Created ${monthName} folder with elementId: ${monthFolder.elementId}`);

      insertRows.push({
        year,
        department: dept,
        month: monthKey,
        element_id: monthFolder.elementId,
      });
    }

    // Insert all month folders for this department into the database
    const { error: insertError } = await supabase
      .from("dryhire_parent_folders")
      .insert(insertRows);

    if (insertError) {
      console.error(`Error inserting dryhire folders for ${year} ${dept}:`, insertError);
      throw new Error(`Failed to save dryhire folders for ${year} ${dept}`);
    }

    console.log(`Successfully created and saved ${insertRows.length} folders for ${year} ${dept}`);
  }

  console.log(`Successfully created all dryhire folders for ${year}`);
}
