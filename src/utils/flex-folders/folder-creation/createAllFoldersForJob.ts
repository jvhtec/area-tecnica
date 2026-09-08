import { supabase } from "@/integrations/supabase/client";
import { normalizeCreateFoldersOptions, type CreateFoldersOptions } from "@/utils/flex-folders/types";

import type { FlexFolderJob } from "@/utils/flex-folders/folder-creation/types";

/**
 * Creates all necessary folders in Flex for a job.
 */
export async function createAllFoldersForJob(
  job: FlexFolderJob,
  formattedStartDate: string,
  formattedEndDate: string,
  documentNumber: string,
  options?: CreateFoldersOptions
) {
  void formattedStartDate;
  void formattedEndDate;
  void documentNumber;
  const normalizedOptions = normalizeCreateFoldersOptions(options);
  const { data, error } = await supabase.functions.invoke("create-flex-folders", {
    body: {
      operation: job.job_type === "tourdate" ? "tour-date" : "job",
      jobId: job.id,
      options: normalizedOptions,
    },
  });
  if (error) throw error;
  const result = data as { success?: boolean; error?: string } | null;
  if (result?.success === false) throw new Error(result.error || "La creación requiere reconciliación");
  return data;
}
