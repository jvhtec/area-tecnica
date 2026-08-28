import { supabase } from "@/integrations/supabase/client";
import { updateFlexElementHeader } from "@/utils/flex-folders/api";
import { getElementTree, FlexElementNode } from "@/utils/flex-folders/getElementTree";
import {
  capitalize,
  collectAllElements,
  extractDocumentNumberSuffix,
  FlexCrewCallSyncRow,
  FlexFolderSyncRow,
  formatDateForDisplay,
  formatDateForFlex,
  generateBaseDocumentNumber,
  generateFolderName,
  getCrewCallDocumentSuffix,
  getCrewCallName,
  getEffectiveTimezone,
  getErrorMessage,
  getKnownDocumentSuffix,
  getRecordedElementFromTree,
  mergeSyncResults,
  runWithConcurrency,
  SyncResult,
} from "@/utils/flex-folders/syncDateChange.helpers";

export { haveJobDatesChanged } from "@/utils/flex-folders/syncDateChange.helpers";
export type { SyncResult } from "@/utils/flex-folders/syncDateChange.helpers";

function getDryhireDocumentSuffix(folder: FlexFolderSyncRow): string | null {
  const department = folder.department;

  if (department !== "sound" && department !== "lights") {
    return null;
  }

  if (folder.folder_type === "dryhire") {
    return department === "sound" ? "S" : "L";
  }

  if (folder.folder_type === "dryhire_presupuesto") {
    return department === "sound" ? "SDH" : "LDH";
  }

  return null;
}

async function updateDryhireElement(
  folder: FlexFolderSyncRow,
  newBaseDocNumber: string,
  formattedStartDate: string,
  formattedEndDate: string,
  newTitle?: string
) {
  const suffix = getDryhireDocumentSuffix(folder);

  if (!suffix) {
    throw new Error(
      `Unsupported dryhire folder row: type=${folder.folder_type || "(none)"}, department=${folder.department || "(none)"}`
    );
  }

  const newDocNumber = `${newBaseDocNumber}${suffix}`;

  await updateFlexElementHeader(folder.element_id, "documentNumber", newDocNumber);
  await updateFlexElementHeader(folder.element_id, "plannedStartDate", formattedStartDate);
  await updateFlexElementHeader(folder.element_id, "plannedEndDate", formattedEndDate);

  if (newTitle) {
    await updateFlexElementHeader(folder.element_id, "name", `Dry Hire - ${newTitle}`);
  }

  return newDocNumber;
}

async function syncDryhireFlexElementsForJobDateChange(
  folders: FlexFolderSyncRow[],
  newBaseDocNumber: string,
  formattedStartDate: string,
  formattedEndDate: string,
  newTitle?: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };
  const dryhireFolders = folders.filter(folder =>
    folder.folder_type === "dryhire" || folder.folder_type === "dryhire_presupuesto"
  );

  if (dryhireFolders.length === 0) {
    console.log("[syncFlexElements] No dryhire Flex folder rows found for job");
    return results;
  }

  console.log(
    `[syncFlexElements] Dryhire job detected. Syncing ${dryhireFolders.length} recorded dryhire element(s) without tree traversal.`
  );

  for (const folder of dryhireFolders) {
    try {
      const newDocNumber = await updateDryhireElement(
        folder,
        newBaseDocNumber,
        formattedStartDate,
        formattedEndDate,
        newTitle
      );

      results.success++;
      console.log(
        `[syncFlexElements] Updated dryhire element ${folder.element_id} (${folder.folder_type || "unknown"}): ${newDocNumber}`
      );
    } catch (error: unknown) {
      results.failed++;
      const errorMsg = `Dryhire element ${folder.element_id}: ${getErrorMessage(error)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  }

  console.log(
    `[syncFlexElements] Dryhire sync complete: ${results.success} succeeded, ${results.failed} failed`
  );

  return results;
}

async function syncRecordedFlexFolderRowsForDateChange(
  folders: FlexFolderSyncRow[],
  newBaseDocNumber: string,
  formattedStartDate: string,
  formattedEndDate: string,
  getFolderName: (
    folder: FlexFolderSyncRow,
    element: { elementId: string; documentNumber?: string; displayName?: string }
  ) => string | null,
  scopeLabel: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };

  console.log(
    `[syncFlexElements] Syncing ${folders.length} recorded ${scopeLabel} element(s) without tree traversal updates.`
  );

  await runWithConcurrency(folders, 4, async (folder) => {
    try {
      const tree = await getElementTree(folder.element_id);
      const element = getRecordedElementFromTree(tree, folder.element_id);
      const suffix = element.documentNumber
        ? extractDocumentNumberSuffix(element.documentNumber)
        : getKnownDocumentSuffix(folder);
      const newDocNumber = suffix === null ? null : `${newBaseDocNumber}${suffix}`;
      const updates: Promise<void>[] = [
        updateFlexElementHeader(folder.element_id, "plannedStartDate", formattedStartDate),
        updateFlexElementHeader(folder.element_id, "plannedEndDate", formattedEndDate),
      ];
      if (newDocNumber !== null) {
        updates.unshift(updateFlexElementHeader(folder.element_id, "documentNumber", newDocNumber));
      }

      const newName = getFolderName(folder, element);
      if (newName) {
        updates.push(updateFlexElementHeader(folder.element_id, "name", newName));
      }

      await Promise.all(updates);

      if (newName) {
        console.log(
          `[syncFlexElements] Updated folder name: ${element.displayName || "(unknown)"} -> ${newName}`
        );
      }

      results.success++;
      console.log(
        `[syncFlexElements] Updated recorded ${scopeLabel} element ${folder.element_id}: ${element.documentNumber || "(no doc#)"} -> ${newDocNumber || "(document number unchanged)"}`
      );
    } catch (error: unknown) {
      results.failed++;
      const errorMsg = `Recorded ${scopeLabel} element ${folder.element_id}: ${getErrorMessage(error)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  });

  console.log(
    `[syncFlexElements] ${scopeLabel} sync complete: ${results.success} succeeded, ${results.failed} failed`
  );

  return results;
}

async function syncRecordedCrewCallsForJobDateChange(
  crewCalls: FlexCrewCallSyncRow[],
  newBaseDocNumber: string,
  formattedStartDate: string,
  formattedEndDate: string,
  jobTitle: string,
  updateNames: boolean
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };

  await runWithConcurrency(crewCalls, 4, async (crewCall) => {
    try {
      const suffix = getCrewCallDocumentSuffix(crewCall.department);
      if (!suffix) {
        throw new Error(`Unsupported crew-call department: ${crewCall.department}`);
      }

      const updates: Promise<void>[] = [
        updateFlexElementHeader(
          crewCall.flex_element_id,
          "documentNumber",
          `${newBaseDocNumber}${suffix}`
        ),
        updateFlexElementHeader(
          crewCall.flex_element_id,
          "plannedStartDate",
          formattedStartDate
        ),
        updateFlexElementHeader(
          crewCall.flex_element_id,
          "plannedEndDate",
          formattedEndDate
        ),
      ];

      const crewCallName = updateNames
        ? getCrewCallName(crewCall.department, jobTitle)
        : null;
      if (crewCallName) {
        updates.push(updateFlexElementHeader(crewCall.flex_element_id, "name", crewCallName));
      }

      await Promise.all(updates);
      results.success++;
    } catch (error: unknown) {
      results.failed++;
      const errorMsg = `Crew call ${crewCall.flex_element_id}: ${getErrorMessage(error)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  });

  return results;
}

async function syncStandardFlexElementsForJobDateChange(
  folders: FlexFolderSyncRow[],
  crewCalls: FlexCrewCallSyncRow[],
  newBaseDocNumber: string,
  formattedStartDate: string,
  formattedEndDate: string,
  jobTitle: string,
  locationName: string,
  displayDate: string,
  newTitle?: string,
  previousTitle?: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };
  const roots = folders.filter(
    (folder) => folder.folder_type === "main_event" || folder.folder_type === "main"
  );

  if (roots.length === 0) {
    const recordedResult = await syncRecordedFlexFolderRowsForDateChange(
      folders,
      newBaseDocNumber,
      formattedStartDate,
      formattedEndDate,
      (folder, element) =>
        newTitle && folder.folder_type
          ? generateFolderName(
              folder.folder_type,
              folder.department,
              jobTitle,
              locationName,
              displayDate,
              element.displayName,
              previousTitle
            )
          : null,
      "legacy job"
    );
    const crewResult = await syncRecordedCrewCallsForJobDateChange(
      crewCalls,
      newBaseDocNumber,
      formattedStartDate,
      formattedEndDate,
      jobTitle,
      Boolean(newTitle)
    );
    return mergeSyncResults(recordedResult, crewResult);
  }

  const elementsById = new Map<
    string,
    { elementId: string; documentNumber?: string; displayName?: string }
  >();
  const folderByElementId = new Map(folders.map((folder) => [folder.element_id, folder]));
  const crewCallByElementId = new Map(
    crewCalls.map((crewCall) => [crewCall.flex_element_id, crewCall])
  );

  await runWithConcurrency(roots, 2, async (root) => {
    try {
      const tree = await getElementTree(root.element_id);
      const treeElements = collectAllElements(tree);
      if (!treeElements.some((element) => element.elementId === root.element_id)) {
        treeElements.unshift({ elementId: root.element_id });
      }

      treeElements.forEach((element) => {
        if (element.elementId && !elementsById.has(element.elementId)) {
          elementsById.set(element.elementId, element);
        }
      });
    } catch (error: unknown) {
      results.failed++;
      const errorMsg = `Root ${root.element_id}: ${getErrorMessage(error)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  });

  folders.forEach((folder) => {
    if (!elementsById.has(folder.element_id)) {
      elementsById.set(folder.element_id, { elementId: folder.element_id });
    }
  });
  crewCalls.forEach((crewCall) => {
    if (!elementsById.has(crewCall.flex_element_id)) {
      elementsById.set(crewCall.flex_element_id, { elementId: crewCall.flex_element_id });
    }
  });

  const elements = Array.from(elementsById.values());
  console.log(
    `[syncFlexElements] Syncing ${elements.length} unique standard-job element(s) from ${roots.length} root tree(s).`
  );

  await runWithConcurrency(elements, 4, async (element) => {
    try {
      const folder = folderByElementId.get(element.elementId);
      const crewCall = crewCallByElementId.get(element.elementId);
      const suffix = element.documentNumber
        ? extractDocumentNumberSuffix(element.documentNumber)
        : folder
          ? getKnownDocumentSuffix(folder)
          : crewCall
            ? getCrewCallDocumentSuffix(crewCall.department)
            : null;
      const updates: Promise<void>[] = [
        updateFlexElementHeader(element.elementId, "plannedStartDate", formattedStartDate),
        updateFlexElementHeader(element.elementId, "plannedEndDate", formattedEndDate),
      ];

      if (suffix !== null) {
        updates.unshift(
          updateFlexElementHeader(
            element.elementId,
            "documentNumber",
            `${newBaseDocNumber}${suffix}`
          )
        );
      }

      let newName: string | null = null;
      if (newTitle) {
        if (crewCall) {
          newName = getCrewCallName(crewCall.department, jobTitle);
        } else if (folder?.folder_type) {
          newName = generateFolderName(
            folder.folder_type,
            folder.department || "",
            jobTitle,
            locationName,
            displayDate,
            element.displayName,
            previousTitle
          );
        } else if (previousTitle && element.displayName?.includes(previousTitle)) {
          newName = element.displayName.replace(previousTitle, jobTitle);
        }
      }

      if (newName) {
        updates.push(updateFlexElementHeader(element.elementId, "name", newName));
      }

      await Promise.all(updates);
      results.success++;
    } catch (error: unknown) {
      results.failed++;
      const errorMsg = `Element ${element.elementId}: ${getErrorMessage(error)}`;
      results.errors.push(errorMsg);
      console.error(`[syncFlexElements] ${errorMsg}`);
    }
  });

  return results;
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
  newTitle?: string,
  previousTitle?: string
): Promise<SyncResult> {
  const results: SyncResult = { success: 0, failed: 0, errors: [] };

  // Generate new date values
  const startDate = new Date(newStartTime);
  const endDate = new Date(newEndTime);

  console.log(
    `[syncFlexElements] Syncing job ${jobId} to new dates: ${newStartTime} - ${newEndTime}${newTitle ? `, new title: ${newTitle}` : ""}`
  );

  // Fetch job with location to get the location name and title for folder renaming
  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(`
      title,
      job_type,
      timezone,
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
  const effectiveTimezone = getEffectiveTimezone(jobData?.timezone);
  const newBaseDocNumber = generateBaseDocumentNumber(startDate, effectiveTimezone);
  const formattedStartDate = formatDateForFlex(startDate, effectiveTimezone);
  const formattedEndDate = formatDateForFlex(endDate, effectiveTimezone);
  const displayDate = formatDateForDisplay(startDate, effectiveTimezone);

  console.log(`[syncFlexElements] New base document number: ${newBaseDocNumber}`);

  // Fetch all flex_folders for this job
  const { data: folders, error: foldersError } = await supabase
    .from("flex_folders")
    .select("element_id, department, folder_type, parent_id")
    .eq("job_id", jobId);

  if (foldersError) {
    console.error("[syncFlexElements] Error fetching flex_folders:", foldersError);
    throw new Error(`Failed to fetch flex folders: ${foldersError.message}`);
  }

  if (!folders || folders.length === 0) {
    console.log("[syncFlexElements] No flex folders found for job");
    return results;
  }

  const { data: crewCalls, error: crewCallsError } = await supabase
    .from("flex_crew_calls")
    .select("flex_element_id, department")
    .eq("job_id", jobId);

  if (crewCallsError) {
    throw new Error(`Failed to fetch Flex crew calls: ${crewCallsError.message}`);
  }

  const recordedCrewCalls = crewCalls || [];

  if (jobData?.job_type === "dryhire") {
    const dryhireResult = await syncDryhireFlexElementsForJobDateChange(
      folders,
      newBaseDocNumber,
      formattedStartDate,
      formattedEndDate,
      newTitle
    );
    const crewResult = await syncRecordedCrewCallsForJobDateChange(
      recordedCrewCalls,
      newBaseDocNumber,
      formattedStartDate,
      formattedEndDate,
      jobTitle,
      Boolean(newTitle)
    );
    return mergeSyncResults(dryhireResult, crewResult);
  }

  if (isTourDateJob) {
    const folderResult = await syncRecordedFlexFolderRowsForDateChange(
      folders,
      newBaseDocNumber,
      formattedStartDate,
      formattedEndDate,
      (folder, element) => {
        if (!folder.department || !folder.folder_type) {
          return null;
        }

        if (folder.folder_type !== "tourdate" && !newTitle) {
          return null;
        }

        return generateFolderName(
          folder.folder_type,
          folder.department,
          jobTitle,
          locationName,
          displayDate,
          element.displayName,
          previousTitle
        );
      },
      "tour date job"
    );
    const crewResult = await syncRecordedCrewCallsForJobDateChange(
      recordedCrewCalls,
      newBaseDocNumber,
      formattedStartDate,
      formattedEndDate,
      jobTitle,
      Boolean(newTitle)
    );
    return mergeSyncResults(folderResult, crewResult);
  }

  return syncStandardFlexElementsForJobDateChange(
    folders,
    recordedCrewCalls,
    newBaseDocNumber,
    formattedStartDate,
    formattedEndDate,
    jobTitle,
    locationName,
    displayDate,
    newTitle,
    previousTitle
  );
}

/**
 * Sync recorded Flex elements for a tour date when its date changes
 * Updates only elements linked to the tour date in flex_folders.
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

  return syncRecordedFlexFolderRowsForDateChange(
    folders,
    newBaseDocNumber,
    formattedDate,
    formattedDate,
    (folder) => {
      if (folder.folder_type !== "tourdate" || !folder.department) {
        return null;
      }

      const deptLabel = capitalize(folder.department);
      return `${locationName} - ${displayDate} - ${deptLabel}`;
    },
    "tour date"
  );
}
