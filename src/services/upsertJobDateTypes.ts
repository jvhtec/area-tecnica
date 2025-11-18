import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";
import type { TablesInsert } from "@/integrations/supabase/types";

export type JobDateTypeUpsertPayload = Pick<
  TablesInsert<"job_date_types">,
  "job_id" | "date" | "type"
>;

const isMissingConstraintError = (error: PostgrestError): boolean => {
  const message = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return message.includes("no unique or exclusion constraint") && message.includes("on conflict");
};

const deleteExistingDateTypes = async (
  payload: JobDateTypeUpsertPayload[]
): Promise<void> => {
  const groupedByJob = payload.reduce<Record<string, Set<string>>>((acc, row) => {
    if (!acc[row.job_id]) {
      acc[row.job_id] = new Set();
    }
    acc[row.job_id].add(row.date);
    return acc;
  }, {});

  for (const [jobId, datesSet] of Object.entries(groupedByJob)) {
    const dates = Array.from(datesSet);
    let deleteBuilder = supabase.from("job_date_types").delete().eq("job_id", jobId);
    if (dates.length > 0) {
      deleteBuilder = deleteBuilder.in("date", dates);
    }
    const { error } = await deleteBuilder;
    if (error) {
      console.error("[upsertJobDateTypes] Fallback delete failed", { jobId, error });
      throw error;
    }
  }
};

export const upsertJobDateTypes = async (
  input: JobDateTypeUpsertPayload | JobDateTypeUpsertPayload[]
): Promise<void> => {
  const payload = Array.isArray(input) ? input : [input];
  if (payload.length === 0) return;

  const { error } = await supabase
    .from("job_date_types")
    .upsert(payload, { onConflict: "job_id,date" });

  if (!error) {
    return;
  }

  if (!isMissingConstraintError(error)) {
    throw error;
  }

  console.warn(
    "[upsertJobDateTypes] job_id,date constraint missing – falling back to delete + insert",
    error
  );

  await deleteExistingDateTypes(payload);

  const { error: insertError } = await supabase.from("job_date_types").insert(payload);
  if (insertError) {
    console.error("[upsertJobDateTypes] Fallback insert failed", insertError);
    throw insertError;
  }
};
