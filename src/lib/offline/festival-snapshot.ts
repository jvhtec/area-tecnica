import { supabase } from "@/integrations/supabase/client";

import { offlineDb, QUEUE_STORE, SNAPSHOT_STORE } from "./offline-db";
import { notifyOfflineFestivalChanged } from "./offline-events";
import {
  OFFLINE_SNAPSHOT_SCHEMA_VERSION,
  type OfflineFestivalSnapshot,
  type OfflineFestivalSnapshotData,
  type OfflinePendingChange,
} from "./types";

type Row = Record<string, unknown>;

const PAGE_SIZE = 1000;

/**
 * Fetches every row matching a filter, paginating past the PostgREST
 * 1000-row default so large festivals are captured completely.
 * Pages are ordered by the unique `id` column so pagination is stable
 * (no skipped or duplicated rows between pages).
 */
const fetchAllRows = async (
  table: string,
  filterColumn: string,
  filterValue: string | string[],
): Promise<Row[]> => {
  const rows: Row[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from(table as never)
      .select("*")
      .order("id" as never, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    query = Array.isArray(filterValue)
      ? query.in(filterColumn as never, filterValue as never)
      : query.eq(filterColumn as never, filterValue as never);

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
};

const fetchMaybeSingle = async (table: string, filterColumn: string, filterValue: string): Promise<Row | null> => {
  const { data, error } = await supabase
    .from(table as never)
    .select("*")
    .eq(filterColumn as never, filterValue as never)
    .maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
};

/**
 * Downloads the full dataset of a festival (job, settings, dates, stages,
 * gear, artists, riders metadata, shifts, documents) and persists it to
 * IndexedDB so the festival can be consulted and edited without connection.
 */
export const downloadFestivalSnapshot = async (jobId: string): Promise<OfflineFestivalSnapshot> => {
  const { data: job, error: jobError } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (jobError) throw jobError;

  const [
    festivalSettings,
    jobDateTypes,
    stages,
    gearSetups,
    artists,
    shifts,
    logos,
    jobDocuments,
    hojaVenue,
  ] = await Promise.all([
    fetchMaybeSingle("festival_settings", "job_id", jobId),
    fetchAllRows("job_date_types", "job_id", jobId),
    fetchAllRows("festival_stages", "job_id", jobId),
    fetchAllRows("festival_gear_setups", "job_id", jobId),
    fetchAllRows("festival_artists", "job_id", jobId),
    fetchAllRows("festival_shifts", "job_id", jobId),
    fetchAllRows("festival_logos", "job_id", jobId),
    fetchAllRows("job_documents", "job_id", jobId),
    fetchMaybeSingle("hoja_de_ruta", "job_id", jobId),
  ]);

  const gearSetupIds = gearSetups.map((setup) => setup.id as string).filter(Boolean);
  const artistIds = artists.map((artist) => artist.id as string).filter(Boolean);
  const shiftIds = shifts.map((shift) => shift.id as string).filter(Boolean);
  const locationId = (job as Row).location_id as string | null;

  const [stageGearSetups, artistFormSubmissions, artistFiles, shiftAssignments, location] = await Promise.all([
    gearSetupIds.length ? fetchAllRows("festival_stage_gear_setups", "gear_setup_id", gearSetupIds) : Promise.resolve([]),
    artistIds.length ? fetchAllRows("festival_artist_form_submissions", "artist_id", artistIds) : Promise.resolve([]),
    artistIds.length ? fetchAllRows("festival_artist_files", "artist_id", artistIds) : Promise.resolve([]),
    shiftIds.length ? fetchAllRows("festival_shift_assignments", "shift_id", shiftIds) : Promise.resolve([]),
    locationId ? fetchMaybeSingle("locations", "id", locationId) : Promise.resolve(null),
  ]);

  const { data: sessionData } = await supabase.auth.getSession();

  const snapshot: OfflineFestivalSnapshot = {
    jobId,
    jobTitle: ((job as Row).title as string) || "Festival",
    schemaVersion: OFFLINE_SNAPSHOT_SCHEMA_VERSION,
    downloadedAt: new Date().toISOString(),
    downloadedBy: sessionData?.session?.user?.id ?? null,
    data: {
      job: job as Row,
      festivalSettings,
      jobDateTypes,
      stages,
      gearSetups,
      stageGearSetups,
      artists,
      artistFormSubmissions,
      artistFiles,
      shifts,
      shiftAssignments,
      logos,
      jobDocuments,
      hojaVenue,
      location,
    },
  };

  await offlineDb.put(SNAPSHOT_STORE, snapshot);
  notifyOfflineFestivalChanged(jobId);
  return snapshot;
};

export const getFestivalSnapshot = async (jobId: string): Promise<OfflineFestivalSnapshot | null> => {
  const snapshot = await offlineDb.get<OfflineFestivalSnapshot>(SNAPSHOT_STORE, jobId);
  if (!snapshot || snapshot.schemaVersion !== OFFLINE_SNAPSHOT_SCHEMA_VERSION) {
    return null;
  }
  return snapshot;
};

export const saveFestivalSnapshot = async (snapshot: OfflineFestivalSnapshot): Promise<void> => {
  await offlineDb.put(SNAPSHOT_STORE, snapshot);
  notifyOfflineFestivalChanged(snapshot.jobId);
};

/** Removes the offline copy and any pending changes queued against it. */
export const deleteFestivalSnapshot = async (jobId: string): Promise<void> => {
  await offlineDb.remove(SNAPSHOT_STORE, jobId);
  const pending = await offlineDb.getAll<OfflinePendingChange>(QUEUE_STORE);
  await Promise.all(pending.filter((change) => change.jobId === jobId).map((change) => offlineDb.remove(QUEUE_STORE, change.id)));
  notifyOfflineFestivalChanged(jobId);
};

const compareTimeStrings = (a: unknown, b: unknown): number => {
  const left = typeof a === "string" ? a : "";
  const right = typeof b === "string" ? b : "";
  return left.localeCompare(right);
};

/**
 * Returns the artists of one festival date exactly as the online
 * `useArtistsQuery` would (submission flag + after-midnight processing),
 * or null when no snapshot exists.
 */
export const getOfflineArtistsForDate = async (
  jobId: string,
  selectedDate: string,
  dayStartTime = "07:00",
): Promise<Row[] | null> => {
  const snapshot = await getFestivalSnapshot(jobId);
  if (!snapshot) return null;

  const submittedArtistIds = new Set(
    snapshot.data.artistFormSubmissions
      .filter((submission) => submission.status === "submitted")
      .map((submission) => submission.artist_id as string),
  );

  return snapshot.data.artists
    .filter((artist) => artist.date === selectedDate)
    .map((artist) => {
      const processed: Row = {
        ...artist,
        artist_submitted: submittedArtistIds.has(artist.id as string),
      };

      if (processed.isaftermidnight === undefined || processed.isaftermidnight === null) {
        const showStart = processed.show_start;
        if (typeof showStart === "string" && showStart) {
          const [hours] = showStart.split(":").map(Number);
          const [startHour] = dayStartTime.split(":").map(Number);
          processed.isaftermidnight = hours < startHour;
        }
      }

      return processed;
    })
    .sort((a, b) => compareTimeStrings(a.show_start, b.show_start));
};

export interface OfflineFestivalContext {
  job: Row | null;
  festivalSettings: Row | null;
  dateTypes: Record<string, string>;
  stageNames: Record<number, string>;
  stages: Array<Record<string, unknown>>;
  maxStages: number;
  artistCount: number;
  downloadedAt: string;
}

/**
 * Snapshot-backed replacement for the small context queries of the
 * festival pages (settings, date types, stage names, job row).
 */
export const getOfflineFestivalContext = async (jobId: string): Promise<OfflineFestivalContext | null> => {
  const snapshot = await getFestivalSnapshot(jobId);
  if (!snapshot) return null;

  const dateTypes: Record<string, string> = {};
  snapshot.data.jobDateTypes.forEach((item) => {
    dateTypes[`${jobId}-${item.date as string}`] = item.type as string;
  });

  const stageNames: Record<number, string> = {};
  snapshot.data.stages.forEach((stage) => {
    if (typeof stage.number === "number") {
      stageNames[stage.number] = (stage.name as string) ?? `Escenario ${stage.number}`;
    }
  });

  const latestGearSetup = [...snapshot.data.gearSetups].sort((a, b) =>
    compareTimeStrings(b.created_at, a.created_at),
  )[0];
  const gearMaxStages = Math.max(Number(latestGearSetup?.max_stages) || 1, 1);
  const stageNumbers = snapshot.data.stages
    .map((stage) => stage.number)
    .filter((value): value is number => typeof value === "number");
  const maxStages = Math.max(gearMaxStages, ...(stageNumbers.length ? stageNumbers : [1]));

  return {
    job: snapshot.data.job,
    festivalSettings: snapshot.data.festivalSettings,
    dateTypes,
    stageNames,
    stages: snapshot.data.stages,
    maxStages,
    artistCount: snapshot.data.artists.length,
    downloadedAt: snapshot.downloadedAt,
  };
};
