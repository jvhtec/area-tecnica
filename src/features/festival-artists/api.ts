import { dataLayerClient } from "@/services/dataLayerClient";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { mapFestivalGearSetup, mapStageGearSetups } from "@/utils/festivalGearMappers";
import type { FestivalGearSetup, StageGearSetup } from "@/types/festival";
import { resolveFestivalLogoUrl, resolveTourLogoUrl } from "@/utils/pdf/logoUtils";
import { fetchWithOfflineFallback, getOfflineFestivalContext } from "@/lib/offline";

/** Stage number → display name, from `festival_stages` (offline snapshot when unreachable). */
export async function fetchFestivalStageNames(jobId: string): Promise<Record<number, string>> {
  const online = async () => {
    const { data, error } = await dataLayerClient
      .from("festival_stages")
      .select("number, name")
      .eq("job_id", jobId);
    // Throwing lets the offline fallback take over.
    if (error) throw error;

    const names: Record<number, string> = {};
    for (const stage of data ?? []) names[stage.number] = stage.name;
    return names;
  };

  const result = await fetchWithOfflineFallback({
    jobId,
    online,
    offline: async () => (await getOfflineFestivalContext(jobId))?.stageNames ?? null,
  });
  return result.data ?? {};
}

const isReachable = async (url: string): Promise<boolean> => {
  try {
    return (await fetch(url, { method: "HEAD" })).ok;
  } catch {
    return false;
  }
};

/**
 * Display URL of the festival's logo, falling back to its tour's logo. The logo buckets are
 * private, so the URL is signed (`resolveFestivalLogoUrl` / `resolveTourLogoUrl`). It is only
 * returned when the file is actually reachable, so PDFs never embed a broken image.
 */
export async function fetchFestivalLogoUrl(jobId: string): Promise<string | null> {
  const { data: festivalLogo, error: festivalError } = await dataLayerClient
    .from("festival_logos")
    .select("file_path")
    .eq("job_id", jobId)
    .maybeSingle();
  if (festivalError) throw festivalError;

  if (festivalLogo?.file_path) {
    const url = await resolveFestivalLogoUrl(festivalLogo.file_path);
    if (url && (await isReachable(url))) return url;
  }

  const { data: job, error: jobError } = await dataLayerClient
    .from("jobs")
    .select("tour_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job?.tour_id) return null;

  const { data: tourLogo, error: tourLogoError } = await dataLayerClient
    .from("tour_logos")
    .select("file_path")
    .eq("tour_id", job.tour_id)
    .maybeSingle();
  if (tourLogoError) throw tourLogoError;

  if (tourLogo?.file_path) {
    const url = await resolveTourLogoUrl(tourLogo.file_path);
    if (url && (await isReachable(url))) return url;
  }
  return null;
}

/** Every artist of the festival that has a show time, in running order (full-schedule PDF). */
export async function fetchFestivalScheduleArtists(jobId: string) {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("*")
    .eq("job_id", jobId)
    .not("show_start", "is", null)
    .order("date", { ascending: true })
    .order("show_start", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** One artist row, used by the editors to refresh what the list handed them. */
export async function fetchFestivalArtist(artistId: string) {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("*")
    .eq("id", artistId)
    .single();
  if (error) throw error;
  return data;
}

/** Partial update of one artist row (the mobile per-category editor saves this way). */
export async function updateFestivalArtist(artistId: string, patch: TablesUpdate<"festival_artists">) {
  const { error } = await dataLayerClient.from("festival_artists").update(patch).eq("id", artistId);
  if (error) throw error;
}

export interface FestivalGearSetups {
  festivalGearSetup: FestivalGearSetup | null;
  /** Stage-specific setups keyed by stage number; empty when the festival has no main setup. */
  stageGearSetups: Record<number, StageGearSetup>;
}

/** The festival's main gear setup plus its per-stage setups, for artist-vs-gear comparison. */
export async function fetchFestivalGearSetups(jobId: string): Promise<FestivalGearSetups> {
  const { data: mainSetup, error: mainError } = await dataLayerClient
    .from("festival_gear_setups")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (mainError) throw mainError;
  if (!mainSetup) return { festivalGearSetup: null, stageGearSetups: {} };

  const { data: stageSetups, error: stageError } = await dataLayerClient
    .from("festival_stage_gear_setups")
    .select("*")
    .eq("gear_setup_id", mainSetup.id);
  if (stageError) throw stageError;

  return {
    festivalGearSetup: mapFestivalGearSetup(mainSetup),
    stageGearSetups: mapStageGearSetups(stageSetups),
  };
}

// --- Copying artists from another festival -------------------------------------------------

export interface CopySourceFestival {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

/** Festival and ciclo jobs (other than the current one) an artist can be copied from. */
export async function fetchCopySourceFestivals(currentJobId: string): Promise<CopySourceFestival[]> {
  const { data, error } = await dataLayerClient
    .from("jobs")
    .select("id, title, start_time, end_time")
    .in("job_type", ["festival", "ciclo"])
    .neq("id", currentJobId)
    .order("start_time", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Distinct dates on which a festival has artists, ascending. */
export async function fetchFestivalArtistDates(jobId: string): Promise<string[]> {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("date")
    .eq("job_id", jobId)
    .not("date", "is", null);
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.date))].sort();
}

export interface CopyCandidateArtist {
  id: string;
  name: string;
  stage: number | null;
  date: string | null;
  show_start: string | null;
  show_end: string | null;
}

/** Artists of one festival date, in running order. */
export async function fetchFestivalArtistsOfDate(jobId: string, date: string): Promise<CopyCandidateArtist[]> {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("id, name, stage, date, show_start, show_end")
    .eq("job_id", jobId)
    .eq("date", date)
    .order("show_start", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface CopySearchResult {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  job_id: string;
  jobTitle: string;
}

/** Name search across every other festival, newest first, with the festival's title attached. */
export async function searchArtistsInOtherFestivals(
  currentJobId: string,
  term: string,
  limit: number,
): Promise<CopySearchResult[]> {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("id, name, stage, date, show_start, show_end, job_id")
    .neq("job_id", currentJobId)
    .ilike("name", `%${term}%`)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];

  // Titles come from a second query: a typed embed on the shared FK name trips CI type-checking.
  const jobIds = [...new Set(rows.map((row) => row.job_id).filter((id): id is string => !!id))];
  const titleById: Record<string, string> = {};
  if (jobIds.length > 0) {
    const { data: jobs, error: jobsError } = await dataLayerClient
      .from("jobs")
      .select("id, title")
      .in("id", jobIds);
    if (jobsError) throw jobsError;
    for (const job of jobs ?? []) titleById[job.id] = job.title;
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name || "",
    stage: row.stage ?? 1,
    date: row.date || "",
    show_start: row.show_start || "",
    show_end: row.show_end || "",
    job_id: row.job_id as string,
    jobTitle: titleById[row.job_id as string] || "Festival sin título",
  }));
}

export async function fetchFestivalArtistsByIds(ids: readonly string[]) {
  const { data, error } = await dataLayerClient.from("festival_artists").select("*").in("id", [...ids]);
  if (error) throw error;
  return data ?? [];
}

/** Inserts all rows in one statement, so a copy either lands completely or not at all. */
export async function insertFestivalArtists(rows: TablesInsert<"festival_artists">[]) {
  const { error } = await dataLayerClient.from("festival_artists").insert(rows);
  if (error) throw error;
}
