import { useQuery } from "@tanstack/react-query";

import { festivalAssetKeys } from "@/features/festival-assets/keys";
import { dataLayerClient } from "@/services/dataLayerClient";
import { resolveFestivalLogoUrl, resolveTourLogoPath, resolveTourLogoUrl } from "@/utils/pdf/logoUtils";

type LogoUrlsByJob = Record<string, string>;

const NO_LOGOS: LogoUrlsByJob = {};

/**
 * Logo URLs for many festivals at once: their own logo, else the logo of the tour they belong to.
 *
 * The database is read with three `in` queries whatever the number of festivals (the per-festival
 * lookup this replaces made up to two queries each). Turning a stored path into a display URL
 * goes through the shared, cached resolvers, so a logo is signed at most once.
 *
 * A tour without a `tour_logos` row falls back to a storage search, once per distinct tour, as the
 * single-job lookup does.
 */
export async function fetchFestivalListLogoUrls(jobIds: readonly string[]): Promise<LogoUrlsByJob> {
  const ids = [...new Set(jobIds)];
  if (ids.length === 0) return NO_LOGOS;

  const { data: festivalLogos, error } = await dataLayerClient
    .from("festival_logos")
    .select("job_id, file_path")
    .in("job_id", ids);
  if (error) throw error;

  const pathByJob = new Map<string, { path: string; tour: boolean }>();
  for (const logo of festivalLogos ?? []) {
    if (logo.job_id && logo.file_path) pathByJob.set(logo.job_id, { path: logo.file_path, tour: false });
  }

  const withoutOwnLogo = ids.filter((id) => !pathByJob.has(id));
  if (withoutOwnLogo.length > 0) {
    const { data: jobs, error: jobsError } = await dataLayerClient
      .from("jobs")
      .select("id, tour_id")
      .in("id", withoutOwnLogo)
      .not("tour_id", "is", null);
    if (jobsError) throw jobsError;

    const tourIds = [...new Set((jobs ?? []).flatMap((job) => (job.tour_id ? [job.tour_id] : [])))];
    if (tourIds.length > 0) {
      const { data: tourLogos, error: tourError } = await dataLayerClient
        .from("tour_logos")
        .select("tour_id, file_path")
        .in("tour_id", tourIds);
      if (tourError) throw tourError;

      const pathByTour = new Map<string, string>();
      for (const logo of tourLogos ?? []) {
        if (logo.tour_id && logo.file_path) pathByTour.set(logo.tour_id, logo.file_path);
      }
      // A tour with no `tour_logos` row may still have a file in storage: search once per such tour.
      const fallbacks = await Promise.all(
        tourIds
          .filter((tourId) => !pathByTour.has(tourId))
          .map(async (tourId) => [tourId, await resolveTourLogoPath(tourId)] as const),
      );
      for (const [tourId, storagePath] of fallbacks) {
        if (storagePath) pathByTour.set(tourId, storagePath);
      }
      for (const job of jobs ?? []) {
        const tourPath = job.tour_id ? pathByTour.get(job.tour_id) : undefined;
        if (tourPath) pathByJob.set(job.id, { path: tourPath, tour: true });
      }
    }
  }

  const resolved = await Promise.all(
    [...pathByJob].map(async ([jobId, { path, tour }]) => {
      const url = tour ? await resolveTourLogoUrl(path) : await resolveFestivalLogoUrl(path);
      return [jobId, url] as const;
    }),
  );

  const urls: LogoUrlsByJob = {};
  for (const [jobId, url] of resolved) {
    if (url) urls[jobId] = url;
  }
  return urls;
}

/** Logo URLs of the festivals shown on the list page, keyed by job id. */
export function useFestivalListLogos(jobIds: readonly string[]) {
  const ids = [...new Set(jobIds)].sort();
  const query = useQuery({
    queryKey: [...festivalAssetKeys.listLogos(), ids],
    queryFn: () => fetchFestivalListLogoUrls(ids),
    enabled: ids.length > 0,
    // Signed URLs live for an hour and are cached for 45 minutes by the resolvers.
    staleTime: 10 * 60 * 1000,
  });

  return { logos: query.data ?? NO_LOGOS, error: query.error };
}
