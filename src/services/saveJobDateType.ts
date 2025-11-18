import { supabase } from "@/lib/supabase";
import type { PostgrestError } from "@supabase/supabase-js";

interface SaveJobDateTypeResult {
  error: PostgrestError | null;
}

export async function saveJobDateType(
  jobId: string,
  date: string,
  type: string
): Promise<SaveJobDateTypeResult> {
  const payload = { job_id: jobId, date, type };

  const { error: insertError } = await supabase.from("job_date_types").insert(payload);

  if (!insertError) {
    return { error: null };
  }

  if (insertError.code !== "23505") {
    return { error: insertError };
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("job_date_types")
    .select("id")
    .eq("job_id", jobId)
    .eq("date", date)
    .limit(1);

  if (fetchError) {
    return { error: fetchError };
  }

  if (!existingRows || existingRows.length === 0) {
    // Nothing to update – treat as success since another client likely inserted it already
    return { error: null };
  }

  const existingId = existingRows[0].id;
  const { error: updateError } = await supabase
    .from("job_date_types")
    .update({ type })
    .eq("id", existingId);

  return { error: updateError };
}
