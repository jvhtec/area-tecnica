import { dataLayerClient } from "@/services/dataLayerClient";

export type MemoriaTecnicaTable =
  | "memoria_tecnica_documents"
  | "lights_memoria_tecnica_documents"
  | "video_memoria_tecnica_documents";

const UNIQUE_VIOLATION = "23505";

/**
 * Upsert "the" Memoria Técnica row for a given job + festival stage.
 *
 * The DB enforces uniqueness per (job_id, stage_number) via a partial unique
 * index (see 20260705121000_add_stage_scope_to_memoria_tecnica.sql), but that
 * index is partial (WHERE job_id IS NOT NULL) to avoid colliding with
 * pre-existing orphaned rows -- PostgREST/Supabase-js can't target a partial
 * index via `.upsert({ onConflict })`, so this does the find-then-write
 * itself: look up the existing row for this job+stage, UPDATE it if found,
 * otherwise INSERT. The unique index remains as a safety net against races
 * (concurrent tabs generating the same job+stage at once) -- a violation
 * there is retried once as an update rather than surfaced as a failure.
 */
export const upsertMemoriaTecnicaDocument = async (
  table: MemoriaTecnicaTable,
  payload: Record<string, unknown> & { job_id: string; stage_number: number | null }
): Promise<void> => {
  const client = dataLayerClient as unknown as {
    from: (t: string) => any;
  };

  let findQuery = client.from(table).select("id").eq("job_id", payload.job_id);
  findQuery =
    payload.stage_number === null
      ? findQuery.is("stage_number", null)
      : findQuery.eq("stage_number", payload.stage_number);

  const { data: existing, error: findError } = await findQuery.maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { data: updated, error } = await client
      .from(table)
      .update(payload)
      .eq("id", existing.id)
      .select("id");
    if (error) throw error;
    if ((updated || []).length > 0) return;
  }

  const { error: insertError } = await client.from(table).insert(payload);
  if (!insertError) return;

  if (insertError.code !== UNIQUE_VIOLATION) throw insertError;

  // Lost a race with another concurrent generation for the same job+stage --
  // fall back to updating whatever row won.
  let raceQuery = client.from(table).select("id").eq("job_id", payload.job_id);
  raceQuery =
    payload.stage_number === null
      ? raceQuery.is("stage_number", null)
      : raceQuery.eq("stage_number", payload.stage_number);
  const { data: winner, error: raceFindError } = await raceQuery.maybeSingle();
  if (raceFindError || !winner?.id) throw insertError;

  const { data: updated, error: updateError } = await client
    .from(table)
    .update(payload)
    .eq("id", winner.id)
    .select("id");
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) throw insertError;
};
