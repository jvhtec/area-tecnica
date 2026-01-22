import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { updateFlexElementHeader } from "@/utils/flex-folders/api";
import { getElementTree, FlexElementNode } from "@/utils/flex-folders/getElementTree";

const DEFAULT_TIMEZONE = "Europe/Madrid";

export interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * Format a date string for Flex API (ISO-like format with milliseconds)
 * Uses Europe/Madrid timezone for consistency with the app
 */
function formatDateForFlex(date: Date): string {
  const zonedDate = toZonedTime(date, DEFAULT_TIMEZONE);
  // Format as ISO-like string in Madrid timezone
  const formatted = format(zonedDate, "yyyy-MM-dd'T'HH:mm:ss");
  return formatted + ".000Z";
}

/**
 * Generate a YYMMDD document number from a date
 * Uses Europe/Madrid timezone for consistency with the app
 */
function generateBaseDocumentNumber(date: Date): string {
  const zonedDate = toZonedTime(date, DEFAULT_TIMEZONE);
  return format(zonedDate, "yyMMdd");
}

/**
 * Format date for display in folder names (e.g., "Jan 15, 2026")
 * Uses Europe/Madrid timezone for consistency with the app
 */
function formatDateForDisplay(date: Date): string {
  const zonedDate = toZonedTime(date, DEFAULT_TIMEZONE);
  return format(zonedDate, "MMM d, yyyy");
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract the suffix from an existing document number
 * Document numbers follow pattern: YYMMDD + suffix(es)
 * Examples: 260212S, 260212SDT, 260212HR, 260212HRDT
 */
function extractDocumentNumberSuffix(docNumber: string): string {
  if (!docNumber || docNumber.length <= 6) return "";

  // The base document number is always 6 characters (YYMMDD)
  return docNumber.slice(6);
}

/**
 * Recursively collect all element IDs and their document numbers from a tree
 */
function collectAllElements(
  nodes: FlexElementNode[]
): Array<{ elementId: string; documentNumber?: string; displayName?: string }> {
  const result: Array<{ elementId: string; documentNumber?: string; displayName?: string }> = [];

  for (const node of nodes) {
    if (node.elementId) {
      result.push({
        elementId: node.elementId,
        documentNumber: node.documentNumber,
        displayName: node.displayName,
      });
    }

    if (node.children && node.children.length > 0) {
      result.push(...collectAllElements(node.children));
    }
  }

  return result;
}

/**
 * Generate folder name based on folder type and job data
 */
function generateFolderName(
  folderType: string,
  department: string,
  jobTitle: string,
  locationName: string,
  displayDate: string
): string | null {
  const deptLabel = capitalize(department);

  switch (folderType) {
    // Tour date folders use location + date + department
    case "tourdate":
      return `${locationName} - ${displayDate} - ${deptLabel}`;

    // Regular job department folders use title + department
    case "department":
      return `${jobTitle} - ${deptLabel}`;

    // Subfolders for regular jobs
    case "documentacion_tecnica":
      return `${jobTitle} - Documentación Técnica - ${deptLabel}`;
    case "presupuestos_recibidos":
      return `${jobTitle} - Presupuestos Recibidos - ${deptLabel}`;
    case "hoja_gastos":
      return `${jobTitle} - Hoja de Gastos - ${deptLabel}`;

    // Other folder types don't include title/date in names
    default:
      return null;
  }
}

/**
 * Sync all Flex elements for a job when its dates or title changes
 * Updates document numbers, planned dates, and folder names for all nested elements
 *
 * @param jobId The job ID whose data changed
 * @param newStartTime The new start time (ISO string)
 * @param newEndTime The new end time (ISO string)
 * @param newTitle Optional new title (if title changed)
 * @returns Results of the sync operation
 */
export async function syncFlexElementsForJobDateChange(
  jobId: string,
  newStartTime: string,
  newEndTime: string,
  newTitle?: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };

  // Generate new date values
  const startDate = new Date(newStartTime);
  const endDate = new Date(newEndTime);
  const newBaseDocNumber = generateBaseDocumentNumber(startDate);
  const formattedStartDate = formatDateForFlex(startDate);
  const formattedEndDate = formatDateForFlex(endDate);
  const displayDate = formatDateForDisplay(startDate);

  console.log(
    `[syncFlexElements] Syncing job ${jobId} to new dates: ${newStartTime} - ${newEndTime}${newTitle ? `, new title: ${newTitle}` : ""}`
  );
  console.log(`[syncFlexElements] New base document number: ${newBaseDocNumber}`);

  // Fetch job with location to get the location name and title for folder renaming
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      title,
      job_type,
      location:locations(name)
    `)
    .eq("id", jobId)
    .single();

  if (jobError) {
    console.error("[syncFlexElements] Error fetching job:", jobError);
    throw new Error(`Failed to fetch job: ${jobError.message}`);
  }

  const locationName = jobData?.location?.name || "No Location";
  const jobTitle = newTitle || jobData?.title || "Untitled";
  const isTourDateJob = jobData?.job_type === "tourdate";

  // Fetch all flex_folders for this job
  const { data: folders, error: foldersError } = await supabase
    .from("flex_folders")
    .select("element_id, department, folder_type")
    .eq("job_id", jobId);

  if (foldersError) {
    console.error("[syncFlexElements] Error fetching flex_folders:", foldersError);
    throw new Error(`Failed to fetch flex folders: ${foldersError.message}`);
  }

  if (!folders || folders.length === 0) {
    console.log("[syncFlexElements] No flex folders found for job");
    return results;
  }

  console.log(`[syncFlexElements] Found ${folders.length} root folders to sync`);

  // Process each root folder and its tree
  for (const folder of folders) {
    try {
      // Fetch the element tree starting from this folder
      const tree = await getElementTree(folder.element_id);

      // Collect all elements (including the root and all nested children)
      const allElements = collectAllElements(tree);

      // Also add the root folder itself if not in tree response
      const hasRoot = allElements.some((e) => e.elementId === folder.element_id);
      if (!hasRoot) {
        allElements.unshift({ elementId: folder.element_id, documentNumber: undefined });
      }

      console.log(
        `[syncFlexElements] Processing folder ${folder.element_id} (${folder.department}): ${allElements.length} elements`
      );

      // Update each element
      for (const element of allElements) {
        try {
          // Build new document number preserving the suffix
          const suffix = element.documentNumber
            ? extractDocumentNumberSuffix(element.documentNumber)
            : "";
          const newDocNumber = `${newBaseDocNumber}${suffix}`;

          // Update document number
          await updateFlexElementHeader(
            element.elementId,
            "documentNumber",
            newDocNumber
          );

          // Update planned start date
          await updateFlexElementHeader(
            element.elementId,
            "plannedStartDate",
            formattedStartDate
          );

          // Update planned end date
          await updateFlexElementHeader(
            element.elementId,
            "plannedEndDate",
            formattedEndDate
          );

          // Update name for folders that include title/date in their names
          // Only update if this is the root folder (element_id matches folder.element_id)
          if (
            element.elementId === folder.element_id &&
            folder.department &&
            folder.folder_type
          ) {
            const newName = generateFolderName(
              folder.folder_type,
              folder.department,
              jobTitle,
              locationName,
              displayDate
            );

            if (newName) {
              await updateFlexElementHeader(element.elementId, "name", newName);
              console.log(
                `[syncFlexElements] Updated folder name: ${element.displayName || "(unknown)"} -> ${newName}`
              );
            }
          }

          results.success++;
          console.log(
            `[syncFlexElements] Updated element ${element.elementId}: ${element.documentNumber || "(no doc#)"} -> ${newDocNumber}`
          );
        } catch (elementError: unknown) {
          results.failed++;
          const errorMsg = `Element ${element.elementId}: ${getErrorMessage(elementError)}`;
          results.errors.push(errorMsg);
          console.error(`[syncFlexElements] ${errorMsg}`);
        }
      }
    } catch (treeError: unknown) {
      results.failed++;
      const errorMsg = `Folder ${folder.element_id}: ${getErrorMessage(treeError)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  }

  console.log(
    `[syncFlexElements] Sync complete: ${results.success} succeeded, ${results.failed} failed`
  );

  return results;
}

/**
 * Sync all Flex elements for a tour date when its date changes
 * Updates document numbers, planned dates, and folder names for all nested elements
 *
 * @param tourDateId The tour_date ID whose date changed
 * @param newDate The new date (ISO string)
 * @returns Results of the sync operation
 */
export async function syncFlexElementsForTourDateChange(
  tourDateId: string,
  newDate: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };

  // Generate new date values (tour dates are typically single-day)
  const date = new Date(newDate);
  const newBaseDocNumber = generateBaseDocumentNumber(date);
  const formattedDate = formatDateForFlex(date);
  const displayDate = formatDateForDisplay(date);

  console.log(
    `[syncFlexElements] Syncing tour date ${tourDateId} to new date: ${newDate}`
  );
  console.log(`[syncFlexElements] New base document number: ${newBaseDocNumber}`);

  // Fetch tour date with location to get the location name for folder renaming
  const { data: tourDateData, error: tourDateError } = await supabase
    .from("tour_dates")
    .select(`
      location:locations(name)
    `)
    .eq("id", tourDateId)
    .single();

  if (tourDateError) {
    console.error("[syncFlexElements] Error fetching tour date:", tourDateError);
    throw new Error(`Failed to fetch tour date: ${tourDateError.message}`);
  }

  const locationName = tourDateData?.location?.name || "No Location";

  // Fetch all flex_folders for this tour date
  const { data: folders, error: foldersError } = await supabase
    .from("flex_folders")
    .select("element_id, department, folder_type")
    .eq("tour_date_id", tourDateId);

  if (foldersError) {
    console.error("[syncFlexElements] Error fetching flex_folders:", foldersError);
    throw new Error(`Failed to fetch flex folders: ${foldersError.message}`);
  }

  if (!folders || folders.length === 0) {
    console.log("[syncFlexElements] No flex folders found for tour date");
    return results;
  }

  console.log(`[syncFlexElements] Found ${folders.length} root folders to sync`);

  // Process each root folder and its tree
  for (const folder of folders) {
    try {
      // Fetch the element tree starting from this folder
      const tree = await getElementTree(folder.element_id);

      // Collect all elements (including the root and all nested children)
      const allElements = collectAllElements(tree);

      // Also add the root folder itself if not in tree response
      const hasRoot = allElements.some((e) => e.elementId === folder.element_id);
      if (!hasRoot) {
        allElements.unshift({ elementId: folder.element_id, documentNumber: undefined });
      }

      console.log(
        `[syncFlexElements] Processing folder ${folder.element_id} (${folder.department}): ${allElements.length} elements`
      );

      // Update each element
      for (const element of allElements) {
        try {
          // Build new document number preserving the suffix
          const suffix = element.documentNumber
            ? extractDocumentNumberSuffix(element.documentNumber)
            : "";
          const newDocNumber = `${newBaseDocNumber}${suffix}`;

          // Update document number
          await updateFlexElementHeader(
            element.elementId,
            "documentNumber",
            newDocNumber
          );

          // Update planned start date
          await updateFlexElementHeader(
            element.elementId,
            "plannedStartDate",
            formattedDate
          );

          // Update planned end date
          await updateFlexElementHeader(
            element.elementId,
            "plannedEndDate",
            formattedDate
          );

          // Update name for main tourdate folders (they include date in name)
          // Only update if this is the root folder and it's a tourdate type
          if (
            folder.folder_type === "tourdate" &&
            element.elementId === folder.element_id &&
            folder.department
          ) {
            const deptLabel = capitalize(folder.department);
            const newName = `${locationName} - ${displayDate} - ${deptLabel}`;
            await updateFlexElementHeader(element.elementId, "name", newName);
            console.log(
              `[syncFlexElements] Updated folder name: ${element.displayName || "(unknown)"} -> ${newName}`
            );
          }

          results.success++;
          console.log(
            `[syncFlexElements] Updated element ${element.elementId}: ${element.documentNumber || "(no doc#)"} -> ${newDocNumber}`
          );
        } catch (elementError: unknown) {
          results.failed++;
          const errorMsg = `Element ${element.elementId}: ${getErrorMessage(elementError)}`;
          results.errors.push(errorMsg);
          console.error(`[syncFlexElements] ${errorMsg}`);
        }
      }
    } catch (treeError: unknown) {
      results.failed++;
      const errorMsg = `Folder ${folder.element_id}: ${getErrorMessage(treeError)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  }

  console.log(
    `[syncFlexElements] Sync complete: ${results.success} succeeded, ${results.failed} failed`
  );

  return results;
}
