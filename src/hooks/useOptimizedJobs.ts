
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { Department } from "@/types/department";
import { sanitizeLogData } from "@/lib/enhanced-security-config";

/**
 * Optimized jobs hook that consolidates multiple queries and subscriptions
 * Replaces multiple individual hooks with a single, efficient query
 * Enhanced with security logging and performance monitoring
 */
export const useOptimizedJobs = (
  department?: Department,
  startDate?: Date,
  endDate?: Date,
  includeDryhire: boolean = false
) => {
  // Subscribe only to tables that affect this hook's query results
  useMultiTableSubscription([
    { table: 'jobs', queryKey: ['optimized-jobs'], priority: 'high' },
    { table: 'job_assignments', queryKey: ['optimized-jobs'], priority: 'high' },
    { table: 'job_departments', queryKey: ['optimized-jobs'], priority: 'medium' },
    { table: 'job_documents', queryKey: ['optimized-jobs'], priority: 'low' },
    { table: 'flex_folders', queryKey: ['optimized-jobs'], priority: 'low' },
    { table: 'locations', queryKey: ['optimized-jobs'], priority: 'low' },
    { table: 'tours', queryKey: ['optimized-jobs'], priority: 'low' },
  ]);

  const fetchOptimizedJobs = async () => {
    const startTime = Date.now();
    const debug = import.meta.env.DEV;
    if (debug) {
      console.log("useOptimizedJobs: Fetching optimized jobs data", sanitizeLogData({
        department,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      }));
    }
    
    let query = supabase
      .from('jobs')
      .select(`
        *,
        location_data:locations(
          id,
          name,
          formatted_address
        ),
        job_departments!inner(
          department
        ),
        job_assignments(
          technician_id,
          sound_role,
          lights_role,
          video_role,
          single_day,
          assignment_date,
          status,
          assigned_at,
          profiles!inner(
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
        flex_folders(
          id,
          element_id,
          department,
          folder_type
        )
      `)
      // Include relevant job types; optionally include dryhire
      .in('job_type', includeDryhire ? ['single', 'festival', 'tourdate', 'dryhire', 'evento'] : ['single', 'festival', 'tourdate', 'evento'])
      .order('start_time', { ascending: true });

    // Apply filters efficiently using indexes
    if (department) {
      query = query.eq('job_departments.department', department);
    }

    // Date-range filtering should include jobs that overlap the window (multi-day jobs).
    if (startDate) {
      query = query.gte('end_time', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("useOptimizedJobs: Error fetching jobs:", sanitizeLogData(error));
      throw error;
    }

    const jobs = data || [];
    // Process the data to match expected format with optimized processing
    const processedJobs = jobs.map(job => ({
      ...job,
      job_documents: job.job_documents || [],
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
      .filter(job => {
        const meta = job.tour_meta;
        // Hide anything tied to a cancelled/deleted tour
        if (meta && (meta.status === 'cancelled' || meta.deleted === true)) {
          return false;
        }
        // Also hide jobs explicitly cancelled
        return job.status !== 'Cancelado';
      });

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
    queryKey: ['optimized-jobs', department, startDate?.toISOString(), endDate?.toISOString(), includeDryhire],
    queryFn: fetchOptimizedJobs,
    staleTime: 1000 * 60 * 5, // 5 minutes - increased for better caching
    gcTime: 1000 * 60 * 10, // 10 minutes - cache jobs longer
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    placeholderData: (previousData) => previousData
  });
};
