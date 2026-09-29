import { dataLayerClient } from "@/services/dataLayerClient";
import type { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import type { GearSetupFormData } from "@/types/festival-gear";
import { mapFestivalGearSetup, mapStageGearSetup } from "@/utils/festivalGearMappers";
import {
  buildEmptyGearFormData,
  globalRowToFormData,
  stageRowToFormData,
  toGlobalGearPayload,
  toStageGearPayload,
} from "./model";

/** Everything the gear form needs to render one stage. */
export interface GearSetupState {
  /** `null` until the festival has a gear setup. */
  gearSetupId: string | null;
  globalSetup: FestivalGearSetup | null;
  /** Set only when a non-primary stage has its own override row. */
  stageSetupId: string | null;
  form: GearSetupFormData;
}

/** Loads the festival-wide setup and, for stages other than 1, that stage's override. */
export async function fetchGearSetupState(jobId: string, stageNumber: number): Promise<GearSetupState> {
  const { data: globalRow, error } = await dataLayerClient
    .from("festival_gear_setups")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;

  if (!globalRow) {
    return { gearSetupId: null, globalSetup: null, stageSetupId: null, form: buildEmptyGearFormData() };
  }

  const base = { gearSetupId: globalRow.id, globalSetup: mapFestivalGearSetup(globalRow) };
  const maxStages = globalRow.max_stages || 1;

  // Stage 1 always edits the festival-wide setup itself.
  if (stageNumber === 1) {
    return { ...base, stageSetupId: null, form: globalRowToFormData(globalRow) };
  }

  const { data: stageRow, error: stageError } = await dataLayerClient
    .from("festival_stage_gear_setups")
    .select("*")
    .eq("gear_setup_id", globalRow.id)
    .eq("stage_number", stageNumber)
    .maybeSingle();
  if (stageError) throw stageError;

  return stageRow
    ? { ...base, stageSetupId: stageRow.id, form: stageRowToFormData(stageRow, maxStages) }
    : { ...base, stageSetupId: null, form: buildEmptyGearFormData(maxStages) };
}

/** Saves the festival-wide setup (one upsert keyed on the job). */
export async function saveGlobalGearSetup(setup: GearSetupFormData, jobId: string, existingId: string | null) {
  const { data, error } = await dataLayerClient
    .from("festival_gear_setups")
    .upsert(toGlobalGearPayload(setup, jobId, existingId), { onConflict: "job_id" })
    .select()
    .single();
  if (error) throw error;
  return { gearSetupId: data.id, globalSetup: mapFestivalGearSetup(data) };
}

/** Saves one stage override in a single transaction, creating or widening the global setup as needed. */
export async function saveStageGearSetup(setup: GearSetupFormData, jobId: string, stageNumber: number) {
  const { data, error } = await dataLayerClient.rpc("save_festival_stage_gear_setup", {
    p_job_id: jobId,
    p_stage_number: stageNumber,
    p_payload: toStageGearPayload(setup),
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error("No se recibió confirmación de guardado.");
  return { gearSetupId: row.gear_setup_id, stageSetupId: row.stage_setup_id, maxStages: row.max_stages };
}

/** The global setup and one stage's override, for comparing artists against the gear. */
export async function fetchCombinedGearSetup(jobId: string, stageNumber: number) {
  const { data: globalRow, error } = await dataLayerClient
    .from("festival_gear_setups")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(`Error fetching global setup: ${error.message}`);

  let stageSetup: StageGearSetup | null = null;
  if (globalRow && stageNumber) {
    const { data: stageRow, error: stageError } = await dataLayerClient
      .from("festival_stage_gear_setups")
      .select("*")
      .eq("gear_setup_id", globalRow.id)
      .eq("stage_number", stageNumber)
      .maybeSingle();
    if (stageError) throw new Error(`Error fetching stage setup: ${stageError.message}`);
    stageSetup = mapStageGearSetup(stageRow);
  }

  return { globalSetup: mapFestivalGearSetup(globalRow), stageSetup };
}

// --- Stages -------------------------------------------------------------------------------

export interface FestivalStageRow {
  id: string;
  number: number;
  name: string;
}

export async function fetchFestivalStageRows(jobId: string): Promise<FestivalStageRow[]> {
  const { data, error } = await dataLayerClient
    .from("festival_stages")
    .select("id, number, name")
    .eq("job_id", jobId)
    .order("number");
  if (error) throw error;
  return data ?? [];
}

/** Number of stages configured on the festival's gear setup (`null` when it has none). */
export async function fetchFestivalMaxStages(jobId: string): Promise<number | null> {
  const { data, error } = await dataLayerClient
    .from("festival_gear_setups")
    .select("max_stages")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.max_stages || 1 : null;
}

/** Stage numbers that have their own gear override, to badge them as "Personalizado". */
export async function fetchCustomStageNumbers(jobId: string): Promise<number[]> {
  const { data: setup, error } = await dataLayerClient
    .from("festival_gear_setups")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!setup) return [];

  const { data, error: stageError } = await dataLayerClient
    .from("festival_stage_gear_setups")
    .select("stage_number")
    .eq("gear_setup_id", setup.id);
  if (stageError) throw stageError;
  return (data ?? []).map((row) => row.stage_number);
}

/** Sets the stage count and creates the missing named stage rows atomically. */
export async function setFestivalMaxStages(jobId: string, maxStages: number): Promise<number> {
  const { data, error } = await dataLayerClient.rpc("set_festival_max_stages", {
    p_job_id: jobId,
    p_max_stages: maxStages,
  });
  if (error) throw error;
  return data;
}

/** Renames a stage, creating its row if the festival only had the implicit "Stage n" name. */
export async function renameFestivalStage(jobId: string, stageNumber: number, name: string) {
  const { error } = await dataLayerClient
    .from("festival_stages")
    .upsert({ job_id: jobId, number: stageNumber, name }, { onConflict: "job_id,number" });
  if (error) throw error;
}

export async function fetchFestivalJobTitle(jobId: string): Promise<string> {
  const { data, error } = await dataLayerClient.from("jobs").select("title").eq("id", jobId).single();
  if (error) throw error;
  return data.title;
}

// --- Wired microphone needs ---------------------------------------------------------------

/** Artists whose wired mics the festival provides (kit `festival` or `mixed`), for the needs matrix. */
export async function fetchArtistsNeedingWiredMics(jobId: string) {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("id, name, stage, date, show_start, show_end, wired_mics, mic_kit")
    .eq("job_id", jobId)
    .in("mic_kit", ["festival", "mixed"])
    .not("wired_mics", "is", null);
  if (error) throw error;
  return data ?? [];
}

/** Title and logo path used to brand the microphone needs PDF. */
export async function fetchMicMatrixJobDetails(jobId: string) {
  const { data: job, error } = await dataLayerClient.from("jobs").select("title").eq("id", jobId).single();
  if (error) throw error;

  // A missing logo only costs the branding, so its errors are not fatal.
  const { data: logo } = await dataLayerClient
    .from("festival_logos")
    .select("file_path")
    .eq("job_id", jobId)
    .maybeSingle();

  return { title: job.title, logoUrl: logo?.file_path || undefined };
}
