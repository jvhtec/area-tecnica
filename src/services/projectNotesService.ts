import type { Database } from "@/integrations/supabase/types";
import { dataLayerClient } from "@/services/dataLayerClient";

export type JobProjectNoteRow = Pick<
  Database["public"]["Tables"]["job_project_notes"]["Row"],
  "job_id" | "notes" | "updated_at" | "updated_by"
>;

export async function getJobProjectNote(jobId: string): Promise<JobProjectNoteRow | null> {
  const { data, error } = await dataLayerClient
    .from("job_project_notes")
    .select("job_id, notes, updated_at, updated_by")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveJobProjectNote(jobId: string, notes: string): Promise<void> {
  const { data: authData } = await dataLayerClient.auth.getUser();

  const { error } = await dataLayerClient
    .from("job_project_notes")
    .upsert(
      {
        job_id: jobId,
        notes,
        updated_by: authData.user?.id ?? null,
      },
      { onConflict: "job_id" },
    );

  if (error) throw error;
}
