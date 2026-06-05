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
  const { data: authData, error: authError } = await dataLayerClient.auth.getUser();

  if (authError) throw authError;
  if (!authData.user) {
    throw new Error("An authenticated user is required to save project notes.");
  }

  const { error } = await dataLayerClient
    .from("job_project_notes")
    .upsert(
      {
        job_id: jobId,
        notes,
        updated_by: authData.user.id,
      },
      { onConflict: "job_id" },
    );

  if (error) throw error;
}
