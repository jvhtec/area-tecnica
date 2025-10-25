import { supabase } from "@/lib/supabase";

export interface FlexFolder {
  id: string;
  element_id: string;
  department: string | null;
  folder_type: string;
}

export interface JobWithFlexFolders {
  id: string;
  flex_folders?: FlexFolder[];
}

/**
 * Resolves the main Flex element ID for a job.
 * Prefers `job.flex_folders` entry with `folder_type === 'main_event'`.
 * Falls back to Supabase lookup if not found in the provided job data.
 * 
 * @param job - Job object that may contain flex_folders array
 * @returns Promise resolving to { elementId: string, department: string | null } or null if not found
 */
export async function resolveMainFlexElementId(
  job: JobWithFlexFolders
): Promise<{ elementId: string; department: string | null } | null> {
  // First, try to find main_event in the job's flex_folders array
  if (job.flex_folders && Array.isArray(job.flex_folders)) {
    const mainEventFolder = job.flex_folders.find(
      (folder) => folder.folder_type === "main_event"
    );
    
    if (mainEventFolder) {
      return {
        elementId: mainEventFolder.element_id,
        department: mainEventFolder.department,
      };
    }
    
    // Fallback to 'main' for legacy data
    const mainFolder = job.flex_folders.find(
      (folder) => folder.folder_type === "main"
    );
    
    if (mainFolder) {
      return {
        elementId: mainFolder.element_id,
        department: mainFolder.department,
      };
    }
  }

  // Fallback: query Supabase directly
  try {
    const { data, error } = await supabase
      .from("flex_folders")
      .select("element_id, department")
      .eq("job_id", job.id)
      .in("folder_type", ["main_event", "main"])
      .order("folder_type", { ascending: false }) // main_event comes before main
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching main Flex folder from Supabase:", error);
      return null;
    }

    if (data) {
      return {
        elementId: data.element_id,
        department: data.department,
      };
    }
  } catch (err) {
    console.error("Exception while resolving main Flex element ID:", err);
  }

  return null;
}

/**
 * Synchronously extracts the main Flex element ID from job data if available.
 * This is a fast, non-async alternative that only checks the job's flex_folders array.
 * 
 * @param job - Job object that may contain flex_folders array
 * @returns { elementId: string, department: string | null } or null if not found
 */
export function getMainFlexElementIdSync(
  job: JobWithFlexFolders
): { elementId: string; department: string | null } | null {
  if (!job.flex_folders || !Array.isArray(job.flex_folders)) {
    return null;
  }

  const mainEventFolder = job.flex_folders.find(
    (folder) => folder.folder_type === "main_event"
  );
  
  if (mainEventFolder) {
    return {
      elementId: mainEventFolder.element_id,
      department: mainEventFolder.department,
    };
  }

  const mainFolder = job.flex_folders.find(
    (folder) => folder.folder_type === "main"
  );
  
  if (mainFolder) {
    return {
      elementId: mainFolder.element_id,
      department: mainFolder.department,
    };
  }

  return null;
}
