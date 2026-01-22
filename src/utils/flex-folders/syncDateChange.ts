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
): Array<{ elementId: string; documentNumber?: string }> {
  const result: Array<{ elementId: string; documentNumber?: string }> = [];

  for (const node of nodes) {
    if (node.elementId) {
      result.push({
        elementId: node.elementId,
        documentNumber: node.documentNumber,
      });
    }

    if (node.children && node.children.length > 0) {
      result.push(...collectAllElements(node.children));
    }
  }

  return result;
}

/**
 * Sync all Flex elements for a job when its dates change
 * Updates document numbers and planned dates for all nested elements
 *
 * @param jobId The job ID whose dates changed
 * @param newStartTime The new start time (ISO string)
 * @param newEndTime The new end time (ISO string)
 * @returns Results of the sync operation
 */
export async function syncFlexElementsForJobDateChange(
  jobId: string,
  newStartTime: string,
  newEndTime: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };

  // Generate new date values
  const startDate = new Date(newStartTime);
  const endDate = new Date(newEndTime);
  const newBaseDocNumber = generateBaseDocumentNumber(startDate);
  const formattedStartDate = formatDateForFlex(startDate);
  const formattedEndDate = formatDateForFlex(endDate);

  console.log(
    `[syncFlexElements] Syncing job ${jobId} to new dates: ${newStartTime} - ${newEndTime}`
  );
  console.log(`[syncFlexElements] New base document number: ${newBaseDocNumber}`);

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
 * Updates document numbers and planned dates for all nested elements
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

  console.log(
    `[syncFlexElements] Syncing tour date ${tourDateId} to new date: ${newDate}`
  );
  console.log(`[syncFlexElements] New base document number: ${newBaseDocNumber}`);

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
