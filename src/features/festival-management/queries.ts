import { supabase } from "@/integrations/supabase/client";
import {
  buildFallbackStageOptions,
  buildFestivalStageOptions,
  buildJobDates,
  buildRiderLibraryEntries,
  type JobDateTypeRow,
} from "@/features/festival-management/selectors";
import { fetchWithOfflineFallback, getFestivalSnapshot } from "@/lib/offline";
import {
  normalizeVenueCoordinates,
  resolveHojaVenue,
} from "@/utils/hoja-de-ruta/venue-resolution";
import type {
  ArtistRiderFile,
  FestivalDocumentsData,
  FestivalJob,
  FestivalJobDetailsData,
  FestivalVenueData,
  JobDocumentEntry,
  RiderLibraryEntry,
  RiderLibraryFile,
  RiderLibrarySourceArtist,
  RiderLibrarySourceJob,
} from "@/features/festival-management/types";

type LocationRow = {
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
};

type HojaVenueRow = {
  venue_name?: string | null;
  venue_address?: string | null;
  venue_latitude?: number | null;
  venue_longitude?: number | null;
};

const RIDER_LIBRARY_FILE_LIMIT = 1000;

export const resolveFestivalVenueData = (
  hojaData: HojaVenueRow | null | undefined,
  location: LocationRow | null | undefined
): FestivalVenueData => {
  const venue = resolveHojaVenue({
    name: hojaData?.venue_name,
    address: hojaData?.venue_address,
    coordinates: {
      lat: hojaData?.venue_latitude,
      lng: hojaData?.venue_longitude,
    },
  }, {
    name: location?.name,
    address: location?.formatted_address || location?.name,
    coordinates: normalizeVenueCoordinates({
      lat: location?.latitude,
      lng: location?.longitude,
    }),
  });

  return {
    address: venue.address || undefined,
    coordinates: venue.coordinates,
  };
};

const fetchHojaVenueData = async (jobId: string): Promise<HojaVenueRow | null> => {
  const { data, error } = await supabase
    .from("hoja_de_ruta")
    .select("venue_name, venue_address, venue_latitude, venue_longitude")
    .eq("job_id", jobId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

const fetchVenueData = async (jobId: string, job: FestivalJob): Promise<FestivalVenueData> => {
  const [hojaData, locationResult] = await Promise.all([
    fetchHojaVenueData(jobId),
    job.location_id
      ? supabase
          .from("locations")
          .select("name, formatted_address, latitude, longitude")
          .eq("id", job.location_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (locationResult.error) {
    console.warn("Unable to load catalog location for festival venue; using saved Hoja venue:", locationResult.error);
  }

  return resolveFestivalVenueData(hojaData, locationResult.error ? null : locationResult.data);
};

const fetchJobDates = async (jobId: string, job: FestivalJob) => {
  const startDate = new Date(job.start_time);
  const endDate = new Date(job.end_time);

  if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    return buildJobDates(job);
  }

  console.warn("Invalid dates in job data, checking for date types");
  const { data: dateTypes, error } = await supabase.from("job_date_types").select("*").eq("job_id", jobId);

  if (error) {
    console.error("Error fetching date types:", error);
    return [new Date()];
  }

  if (dateTypes && dateTypes.length > 0) {
    return buildJobDates(job, dateTypes);
  }

  console.warn("No valid dates found for this job");
  return [new Date()];
};

const buildOfflineJobDetails = async (jobId: string): Promise<FestivalJobDetailsData | null> => {
  const snapshot = await getFestivalSnapshot(jobId);
  if (!snapshot?.data.job) {
    return null;
  }

  const jobRow = snapshot.data.job as Record<string, unknown>;
  const job = {
    ...jobRow,
    location_id: (jobRow.location_id as string | null) ?? undefined,
    tour_date_id: (jobRow.tour_date_id as string | null) ?? undefined,
  } as FestivalJob;

  const latestGearSetup = [...snapshot.data.gearSetups].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  )[0];
  let maxStages = Math.max(Number(latestGearSetup?.max_stages) || 1, 1);

  const stageRows = snapshot.data.stages
    .map((stage) => ({ number: stage.number as number, name: (stage.name as string) ?? null }))
    .sort((a, b) => a.number - b.number);
  const stageData = buildFestivalStageOptions(stageRows, maxStages);
  maxStages = stageData.maxStages;

  return {
    artistCount: snapshot.data.artists.length,
    festivalStageOptions: stageData.options,
    job,
    jobDates: buildJobDates(job, snapshot.data.jobDateTypes as JobDateTypeRow[]),
    maxStages,
    venueData: resolveFestivalVenueData(
      snapshot.data.hojaVenue as HojaVenueRow | null,
      snapshot.data.location as LocationRow | null,
    ),
  };
};

const fetchFestivalJobDetailsOnline = async (jobId: string): Promise<FestivalJobDetailsData> => {
  const { data: jobData, error: jobError } = await supabase.from("jobs").select("*").eq("id", jobId).single();

  if (jobError) {
    console.error("Error fetching job data:", jobError);
    throw jobError;
  }

  console.log("Job data retrieved:", jobData);
  const job = {
    ...jobData,
    location_id: jobData.location_id ?? undefined,
    tour_date_id: jobData.tour_date_id ?? undefined,
  } as FestivalJob;

  const { count: artistCountValue, error: artistError } = await supabase
    .from("festival_artists")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);

  if (artistError) {
    console.error("Error fetching artist count:", artistError);
    throw artistError;
  }

  const { data: gearSetups, error: gearError } = await supabase
    .from("festival_gear_setups")
    .select("max_stages")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1);

  let resolvedMaxStages = 1;
  if (gearError) {
    console.error("Error fetching gear setup:", gearError);
  } else if (gearSetups && gearSetups.length > 0) {
    resolvedMaxStages = Math.max(gearSetups[0].max_stages || 1, 1);
  }

  const { data: stageRows, error: stageError } = await supabase
    .from("festival_stages")
    .select("number, name")
    .eq("job_id", jobId)
    .order("number", { ascending: true });

  let festivalStageOptions = buildFallbackStageOptions(resolvedMaxStages);
  if (stageError) {
    console.error("Error fetching festival stages:", stageError);
  } else {
    const stageData = buildFestivalStageOptions(stageRows, resolvedMaxStages);
    festivalStageOptions = stageData.options;
    resolvedMaxStages = stageData.maxStages;
  }

  const [venueData, jobDates] = await Promise.all([fetchVenueData(jobId, job), fetchJobDates(jobId, job)]);

  return {
    artistCount: artistCountValue || 0,
    festivalStageOptions,
    job,
    jobDates,
    maxStages: resolvedMaxStages,
    venueData,
  };
};

export const fetchFestivalJobDetails = async (jobId: string): Promise<FestivalJobDetailsData> => {
  console.log("Fetching job details for jobId:", jobId);

  // Snapshot fallback covers browser-offline, online failures and
  // slow/unresponsive networks (timeout-raced).
  const result = await fetchWithOfflineFallback({
    online: () => fetchFestivalJobDetailsOnline(jobId),
    offline: () => buildOfflineJobDetails(jobId),
  });
  return result.data;
};

const buildOfflineDocuments = async (jobId: string): Promise<FestivalDocumentsData | null> => {
  const snapshot = await getFestivalSnapshot(jobId);
  if (!snapshot) {
    return null;
  }

  const artistNames = new Map(
    snapshot.data.artists.map((artist) => [artist.id as string, (artist.name as string) || "Unknown"]),
  );

  const artistRiderFiles = snapshot.data.artistFiles
    .map((file) => ({
      ...(file as unknown as ArtistRiderFile),
      festival_artists: {
        id: file.artist_id as string,
        name: artistNames.get(file.artist_id as string) || "Unknown",
      },
    }))
    .sort((a, b) => String(b.uploaded_at ?? "").localeCompare(String(a.uploaded_at ?? "")));

  const jobDocuments = [...snapshot.data.jobDocuments].sort((a, b) =>
    String(b.uploaded_at ?? "").localeCompare(String(a.uploaded_at ?? "")),
  ) as unknown as JobDocumentEntry[];

  return { artistRiderFiles, jobDocuments };
};

const fetchFestivalDocumentsOnline = async (jobId: string): Promise<FestivalDocumentsData> => {
  const { data: jobDocs, error: jobDocsError } = await supabase
    .from("job_documents")
    .select("id, file_name, file_path, uploaded_at, read_only, template_type")
    .eq("job_id", jobId)
    .order("uploaded_at", { ascending: false });

  if (jobDocsError) {
    throw jobDocsError;
  }

  const { data: artistsForJob, error: artistsError } = await supabase
    .from("festival_artists")
    .select("id, name")
    .eq("job_id", jobId);

  if (artistsError) {
    throw artistsError;
  }

  const artistIds = (artistsForJob || []).map((artist) => artist.id);
  let riderData: ArtistRiderFile[] = [];

  if (artistIds.length > 0) {
    let query = supabase
      .from("festival_artist_files")
      .select("id, file_name, file_path, uploaded_at, artist_id")
      .order("uploaded_at", { ascending: false });

    if (artistIds.length === 1) {
      query = query.eq("artist_id", artistIds[0]);
    } else {
      const orExpr = artistIds.map((id) => `artist_id.eq.${id}`).join(",");
      query = query.or(orExpr);
    }

    const { data, error } = await query;
    if (error) throw error;

    const nameMap = new Map((artistsForJob || []).map((artist) => [artist.id, artist.name]));
    riderData = (data || []).map((file) => ({
      ...(file as ArtistRiderFile),
      festival_artists: {
        id: file.artist_id,
        name: nameMap.get(file.artist_id) || "Unknown",
      },
    }));
  }

  return {
    artistRiderFiles: riderData,
    jobDocuments: (jobDocs || []) as JobDocumentEntry[],
  };
};

export const fetchFestivalDocuments = async (jobId: string): Promise<FestivalDocumentsData> => {
  const result = await fetchWithOfflineFallback({
    online: () => fetchFestivalDocumentsOnline(jobId),
    offline: () => buildOfflineDocuments(jobId),
  });
  return result.data;
};

const fetchTargetJobRiderFilePaths = async (jobId: string) => {
  const { data: targetArtists, error: artistError } = await supabase
    .from("festival_artists")
    .select("id")
    .eq("job_id", jobId);

  if (artistError) throw artistError;

  const targetArtistIds = (targetArtists || []).map((artist) => artist.id);
  if (targetArtistIds.length === 0) return [];

  const { data: targetFiles, error: filesError } = await supabase
    .from("festival_artist_files")
    .select("file_path")
    .in("artist_id", targetArtistIds);

  if (filesError) throw filesError;

  return (targetFiles || []).map((file) => file.file_path).filter((value): value is string => Boolean(value));
};

export const fetchRiderLibrary = async (targetJobId: string): Promise<RiderLibraryEntry[]> => {
  const [{ data: filesData, error: filesError }, targetFilePaths] = await Promise.all([
    supabase
      .from("festival_artist_files")
      .select("id, artist_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at")
      .not("artist_id", "is", null)
      .order("uploaded_at", { ascending: false })
      .limit(RIDER_LIBRARY_FILE_LIMIT),
    fetchTargetJobRiderFilePaths(targetJobId),
  ]);

  if (filesError) throw filesError;

  const files: RiderLibraryFile[] = (filesData || [])
    .filter((file) => Boolean(file.artist_id))
    .map((file) => ({
      artist_id: file.artist_id as string,
      file_name: file.file_name,
      file_path: file.file_path,
      file_size: file.file_size,
      file_type: file.file_type,
      id: file.id,
      uploaded_at: file.uploaded_at,
      uploaded_by: file.uploaded_by,
    }));

  if (files.length === 0) return [];

  const artistIds = Array.from(new Set(files.map((file) => file.artist_id)));
  const { data: artistsData, error: artistsError } = await supabase
    .from("festival_artists")
    .select("id, name, job_id, date, stage")
    .in("id", artistIds);

  if (artistsError) throw artistsError;

  const artists: RiderLibrarySourceArtist[] = (artistsData || []).map((artist) => ({
    date: artist.date,
    id: artist.id,
    job_id: artist.job_id,
    name: artist.name,
    stage: artist.stage,
  }));

  const jobIds = Array.from(
    new Set(artists.map((artist) => artist.job_id).filter((value): value is string => Boolean(value))),
  );
  const jobs: RiderLibrarySourceJob[] = [];

  if (jobIds.length > 0) {
    const { data: jobsData, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title, job_type, start_time, end_time")
      .in("id", jobIds);

    if (jobsError) throw jobsError;
    jobs.push(...(jobsData || []));
  }

  return buildRiderLibraryEntries({
    artistsById: new Map(artists.map((artist) => [artist.id, artist])),
    files,
    jobsById: new Map(jobs.map((job) => [job.id, job])),
    targetFilePaths,
  });
};
