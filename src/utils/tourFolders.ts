import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/utils/errorMessage";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { formatInTimeZone } from "date-fns-tz";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";
import type { FlexFolderJob } from "@/utils/flex-folders/folder-creation/types";

export interface TourFolderCreationResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

type TourProvisioningOperation = "tour-root";

const provisionTourFolders = async (
  tourId: string,
  operation: TourProvisioningOperation
): Promise<TourFolderCreationResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("create-flex-folders", {
      body: { operation, tourId },
    });

    if (error) {
      return { success: false, error: error.message || "No se pudieron crear las carpetas Flex" };
    }

    const response = data as { success?: boolean; error?: string } | null;
    if (response?.success === false) {
      return { success: false, error: response.error || "No se pudieron crear las carpetas Flex" };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "No se pudieron crear las carpetas Flex") };
  }
};

export const createTourRootFolders = (tourId: string) =>
  provisionTourFolders(tourId, "tour-root");

export const createTourDateFolders = async (tourId: string): Promise<TourFolderCreationResult> => {
  try {
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("tour_id", tourId)
      .eq("job_type", "tourdate")
      .order("start_time", { ascending: true });
    if (error) throw error;
    if (!jobs?.length) throw new Error("No hay fechas de gira con trabajo asociado");

    for (const job of jobs as FlexFolderJob[]) {
      if (!job.start_time || !job.end_time) {
        throw new Error(`El trabajo ${job.id} no tiene fechas válidas`);
      }
      const start = new Date(job.start_time);
      const end = new Date(job.end_time);
      const documentNumber = formatInTimeZone(start, MADRID_TIMEZONE, "yyMMdd");
      await createAllFoldersForJob(
        job,
        `${start.toISOString().split(".")[0]}.000Z`,
        `${end.toISOString().split(".")[0]}.000Z`,
        documentNumber,
      );
    }

    return { success: true, data: { jobsProcessed: jobs.length } };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "No se pudieron crear las fechas Flex") };
  }
};

/** @deprecated Kept for stale callers; root creation is now always server-orchestrated. */
export const createTourRootFoldersManual = (tourId: string) =>
  provisionTourFolders(tourId, "tour-root");

export const createAllTourFolders = async (tourId: string): Promise<TourFolderCreationResult> => {
  const rootResult = await createTourRootFolders(tourId);
  if (!rootResult.success) return rootResult;
  return createTourDateFolders(tourId);
};
