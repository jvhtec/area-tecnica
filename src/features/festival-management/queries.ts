import { supabase } from "@/integrations/supabase/client";
import {
  buildFallbackStageOptions,
  buildFestivalStageOptions,
  buildJobDates,
} from "@/features/festival-management/selectors";
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

export const fetchFestivalJobDetails = async (jobId: string): Promise<FestivalJobDetailsData> => {
  console.log("Fetching job details for jobId:", jobId);

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

export const fetchFestivalDocuments = async (jobId: string): Promise<FestivalDocumentsData> => {
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
