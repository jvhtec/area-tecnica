import { supabase } from "@/lib/supabase";
import { trackError } from "@/lib/errorTracking";
import { normalizeVenueCoordinates, resolveHojaVenue } from "@/utils/hoja-de-ruta/venue-resolution";
import { generateWeatherPDF } from "@/utils/pdf/weatherPdfGenerator";
import { isNonEmptyBlob } from "@/utils/pdf/festivalPdfSupport";
import { attemptSection, type FestivalSectionContext } from "./context";

interface CatalogLocation {
  name?: string | null;
  formatted_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Every day from the job's start to its end, inclusive. */
const eachJobDay = (start: string, end: string): Date[] => {
  const days: Date[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

/** The venue's forecast for the festival days. Left out when the job or its venue cannot be loaded. */
export const generateWeatherSection = (context: FestivalSectionContext): Promise<Blob | null> =>
  attemptSection(context, "bundle-weather", async () => {
    const { options, jobId, jobTitle, logoUrl } = context;
    if (!options.includeWeatherPrediction) return null;

    const [{ data: job, error: jobError }, { data: hojaVenue, error: hojaVenueError }] = await Promise.all([
      supabase.from("jobs").select("start_time, end_time, location_id, description").eq("id", jobId).single(),
      supabase
        .from("hoja_de_ruta")
        .select("venue_name, venue_address, venue_latitude, venue_longitude")
        .eq("job_id", jobId)
        .maybeSingle(),
    ]);
    if (jobError) throw jobError;
    // The saved Hoja venue is a refinement: without it the catalogue location still resolves.
    if (hojaVenueError) void trackError(hojaVenueError, { system: "festivals", operation: "bundle-weather-hoja-venue", jobId });

    let catalogLocation: CatalogLocation | null = null;
    if (job.location_id) {
      const { data, error } = await supabase
        .from("locations")
        .select("name, formatted_address, latitude, longitude")
        .eq("id", job.location_id)
        .maybeSingle();
      if (error) void trackError(error, { system: "festivals", operation: "bundle-weather-location", jobId });
      else catalogLocation = data;
    }

    const venue = resolveHojaVenue(
      {
        name: hojaVenue?.venue_name,
        address: hojaVenue?.venue_address,
        coordinates: { lat: hojaVenue?.venue_latitude, lng: hojaVenue?.venue_longitude },
      },
      {
        name: catalogLocation?.name,
        address: catalogLocation?.formatted_address || catalogLocation?.name,
        coordinates: normalizeVenueCoordinates({
          lat: catalogLocation?.latitude,
          lng: catalogLocation?.longitude,
        }),
      },
    );

    const pdf = await generateWeatherPDF({
      jobTitle: jobTitle || "Festival",
      logoUrl,
      venue: {
        address: venue.address || (!venue.coordinates ? job.description || undefined : undefined),
        coordinates: venue.coordinates,
      },
      jobDates: eachJobDay(job.start_time, job.end_time),
      paginate: false,
    });
    return isNonEmptyBlob(pdf) ? pdf : null;
  });
