
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { Department } from "@/types/department";
import { sanitizeLogData } from "@/lib/enhanced-security-config";
import { OPS_JOB_TYPES_NO_DRYHIRE, OPS_JOB_TYPES_WITH_DRYHIRE } from "@/utils/jobType";
import { shouldHideJobForTourState } from "@/utils/cancelledTourJobs";
import { fetchJobProducerClaims } from "@/features/jobs/producer-claims/producerClaims";
import { buildJobSearchTokens, matchesJobSearch } from "@/utils/jobSearch";

/** Keeps `id=in.(...)` well under URL length limits. */
const SEARCH_ID_CHUNK_SIZE = 150;


import { queryKeys } from "@/lib/react-query";
/**
 * Optimized jobs hook that consolidates multiple queries and subscriptions
 * Replaces multiple individual hooks with a single, efficient query
 * Enhanced with security logging and performance monitoring
 */
export const useOptimizedJobs = (
  department?: Department,
  startDate?: Date,
  endDate?: Date,
  includeDryhire: boolean = true,
  options?: {
    refetchOnMount?: boolean | "always";
    /**
     * When false, the underlying query is disabled and the hook no-ops (no fetch).
     * Callers that fetch all departments leave this undefined (defaults to enabled).
     */
    enabled?: boolean;
    /**
     * Free-text search (title, location name or address; accent-insensitive).
     * Matches on a light projection and loads full data only for the hits.
     */
    search?: string;
  }
) => {
  // Subscribe only to tables that affect this hook's query results
  useMultiTableSubscription([
    { table: 'jobs', queryKey: queryKeys.scope('optimized-jobs'), priority: 'high' },
    { table: 'job_assignments', queryKey: queryKeys.scope('optimized-jobs'), priority: 'high' },
    { table: 'job_producer_claims', queryKey: queryKeys.scope('optimized-jobs'), priority: 'high' },
    { table: 'job_departments', queryKey: queryKeys.scope('optimized-jobs'), priority: 'medium' },
    { table: 'job_date_types', queryKey: queryKeys.scope('optimized-jobs'), priority: 'medium' },
    { table: 'festival_artists', queryKey: queryKeys.scope('optimized-jobs'), priority: 'medium' },
    { table: 'job_documents', queryKey: queryKeys.scope('optimized-jobs'), priority: 'low' },
    { table: 'flex_folders', queryKey: queryKeys.scope('optimized-jobs'), priority: 'low' },
    { table: 'locations', queryKey: queryKeys.scope('optimized-jobs'), priority: 'low' },
    { table: 'tour_dates', queryKey: queryKeys.scope('optimized-jobs'), priority: 'low' },
    { table: 'tour_default_sets', queryKey: queryKeys.scope('optimized-jobs'), priority: 'low' },
    { table: 'tours', queryKey: queryKeys.scope('optimized-jobs'), priority: 'low' },
  ]);

  const jobTypes = includeDryhire ? [...OPS_JOB_TYPES_WITH_DRYHIRE] : [...OPS_JOB_TYPES_NO_DRYHIRE];
  const searchTokens = buildJobSearchTokens(options?.search ?? "");
  const searchKey = searchTokens.join(" ");

  /**
   * Search runs over every job of the department, so match on a light
   * projection first and only load the full nested job data for the hits.
   * Returns null when not searching.
   */
  const findSearchMatchIds = async (): Promise<string[] | null> => {
    if (searchTokens.length === 0) return null;

    let searchQuery = supabase
      .from('jobs')
      .select('id, title, location:locations(name, formatted_address), job_departments!inner(department)')
      .in('job_type', jobTypes);
    if (department) {
      searchQuery = searchQuery.eq('job_departments.department', department);
    }
    if (startDate) {
      searchQuery = searchQuery.gte('end_time', startDate.toISOString());
    }
    if (endDate) {
      searchQuery = searchQuery.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await searchQuery;
    if (error) {
      console.error("useOptimizedJobs: Error searching jobs:", sanitizeLogData(error));
      throw error;
    }
    return (data ?? [])
      .filter((job) => matchesJobSearch(job, searchTokens))
      .map((job) => job.id);
  };

  const fetchOptimizedJobs = async () => {
    const startTime = Date.now();
    const debug = import.meta.env.DEV;
    if (debug) {
      console.log("useOptimizedJobs: Fetching optimized jobs data", sanitizeLogData({
        department,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        searching: searchTokens.length > 0,
      }));
    }

    const searchMatchIds = await findSearchMatchIds();
    if (searchMatchIds && searchMatchIds.length === 0) return [];
    if (searchMatchIds && searchMatchIds.length > SEARCH_ID_CHUNK_SIZE) {
      const chunks: string[][] = [];
      for (let i = 0; i < searchMatchIds.length; i += SEARCH_ID_CHUNK_SIZE) {
        chunks.push(searchMatchIds.slice(i, i + SEARCH_ID_CHUNK_SIZE));
      }
      const results = await Promise.all(chunks.map((ids) => fetchJobsData(ids)));
      return finalizeJobs(
        results.flat().sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))),
        startTime,
        debug
      );
    }
    return finalizeJobs(await fetchJobsData(searchMatchIds), startTime, debug);
  };

  const fetchJobsData = async (ids: string[] | null) => {
    let query = supabase
      .from('jobs')
      .select(`
        *,
        location:locations(
          id,
          name,
          formatted_address,
          latitude,
          longitude
        ),
        job_departments!inner(
          department
        ),
        job_assignments(
          technician_id,
          sound_role,
          lights_role,
          video_role,
          assignment_source,
          single_day,
          assignment_date,
          status,
          assigned_at,
          profiles!job_assignments_technician_id_fkey!inner(
            id,
            first_name,
            nickname,
            last_name,
            department
          )
        ),
        job_documents(
          id,
          file_name,
          file_path,
          file_type,
          file_size,
          visible_to_tech,
          uploaded_at,
          read_only,
          template_type
        ),
        job_date_types(
          date,
          type
        ),
        festival_artists(
          id,
          name,
          date,
          show_start,
          stage,
          isaftermidnight
        ),
        tour_date:tour_dates(
          date,
          start_date,
          end_date,
          tour_date_type,
          is_tour_pack_only,
          tour_id,
          sound_package_size,
          lights_package_size,
          video_package_size,
          sound_default_set_id,
          lights_default_set_id,
          video_default_set_id
        ),
        flex_folders(
          id,
          element_id,
          department,
          folder_type
        )
      `)
      // Include relevant job types; optionally include dryhire
      .in('job_type', jobTypes)
      .order('start_time', { ascending: true });

    // Apply filters efficiently using indexes
    if (department) {
      query = query.eq('job_departments.department', department);
    }

    if (ids) {
      // Search hits were already matched against the same department and dates.
      query = query.in('id', ids);
    } else {
      // Date-range filtering should include jobs that overlap the window (multi-day jobs).
      if (startDate) {
        query = query.gte('end_time', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('start_time', endDate.toISOString());
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("useOptimizedJobs: Error fetching jobs:", sanitizeLogData(error));
      throw error;
    }

    return data || [];
  };

  const finalizeJobs = async (
    jobs: Awaited<ReturnType<typeof fetchJobsData>>,
    startTime: number,
    debug: boolean
  ) => {
    // Process the data to match expected format with optimized processing
    // Claims are decoration on top of the job list: a failure here must not
    // blank the calendar, so fall back to an unclaimed view.
    const producerClaims = await fetchJobProducerClaims(jobs.map((job) => job.id)).catch(() => []);
    const processedJobs = jobs.map(job => ({
      ...job,
      job_documents: job.job_documents || [],
      job_producer_claims: producerClaims.filter((claim) => claim.job_id === job.id),
      festival_artists: job.festival_artists || [],
      flex_folders_exist: (job.flex_folders?.length || 0) > 0,
    }));

    // Load tour metadata so cancelled tours can be hidden from calendars and lists
    const tourIds = Array.from(
      new Set(
        processedJobs
          .map(job => job.tour_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const tourMetaMap: Record<string, { id: string; status: string | null; deleted: boolean | null }> = {};

    if (tourIds.length > 0) {
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select('id, status, deleted')
        .in('id', tourIds);

      if (toursError) {
        console.warn('useOptimizedJobs: Failed to load tour metadata', sanitizeLogData(toursError));
      } else {
        (toursData || []).forEach(tour => {
          if (tour?.id) {
            tourMetaMap[tour.id] = {
              id: tour.id,
              status: tour.status ?? null,
              deleted: tour.deleted ?? null,
            };
          }
        });
      }
    }

    const filteredJobs = processedJobs
      .map(job => ({
        ...job,
        tour_meta: job.tour_id ? tourMetaMap[job.tour_id] ?? null : null,
      }))
      .filter(job => !shouldHideJobForTourState(job, job.tour_meta));

    const duration = Date.now() - startTime;
    if (debug) {
      console.log(`useOptimizedJobs: Successfully fetched ${filteredJobs.length} jobs in ${duration}ms`);
    }

    // Log performance warning if query is slow
    if (duration > 2000) {
      console.warn(`useOptimizedJobs: Slow query detected - ${duration}ms for ${filteredJobs.length} jobs`);
    }

    return filteredJobs;
  };

  return useQuery({
    queryKey: queryKeys.scope('optimized-jobs', department, startDate?.toISOString(), endDate?.toISOString(), includeDryhire, searchKey),
    queryFn: fetchOptimizedJobs,
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5, // 5 minutes - increased for better caching
    gcTime: 1000 * 60 * 10, // 10 minutes - cache jobs longer
    refetchOnMount: options?.refetchOnMount,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    placeholderData: (previousData) => previousData
  });
};
