import { dataLayerClient } from "@/services/dataLayerClient";

export interface FestivalShiftCopyResult {
  copiedAssignments: number;
  copiedShifts: number;
}

/** Copy a complete festival day in one database transaction. */
export async function copyFestivalShifts({
  jobId,
  sourceDate,
  targetDate,
}: {
  jobId: string;
  sourceDate: string;
  targetDate: string;
}): Promise<FestivalShiftCopyResult> {
  const { data, error } = await dataLayerClient.rpc("copy_festival_shifts", {
    p_job_id: jobId,
    p_source_date: sourceDate,
    p_target_date: targetDate,
  });

  if (error) throw error;

  const row = data?.[0];
  if (
    !row ||
    typeof row.copied_shifts !== "number" ||
    typeof row.copied_assignments !== "number"
  ) {
    throw new Error("The shift copy did not return a valid result");
  }

  return {
    copiedAssignments: row.copied_assignments,
    copiedShifts: row.copied_shifts,
  };
}
