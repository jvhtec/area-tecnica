
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUnifiedSubscriptions } from "@/hooks/useUnifiedSubscriptions";
import { Department } from "@/types/department";
import { sanitizeLogData } from "@/lib/enhanced-security-config";
import { aggregateJobTimesheets, TimesheetRowWithTechnician, AggregatedTimesheetAssignment } from "@/utils/timesheetAssignments";

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
  const queryClient = useQueryClient();

  // Consolidated subscription for all job-related tables
  useUnifiedSubscriptions([
    'jobs',
    'job_assignments', 
    'job_departments',
    'job_documents',
    'timesheets',
    'job_date_types',
    'sound_job_tasks',
    'lights_job_tasks', 
    'video_job_tasks',
    'sound_job_personnel',
    'lights_job_personnel',
    'video_job_personnel',
    'flex_folders',
    'locations'
  ], ['optimized-jobs']);

  const fetchOptimizedJobs = async () => {
    const startTime = Date.now();
    console.log("useOptimizedJobs: Fetching optimized jobs data", sanitizeLogData({
      department,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    }));
    
    let query = supabase
      .from('jobs')
      .select(`
        *,
        location:locations(
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
      .in('job_type', includeDryhire ? ['single', 'festival', 'tourdate', 'dryhire'] : ['single', 'festival', 'tourdate'])
      .order('start_time', { ascending: true });

    // Apply filters efficiently using indexes
    if (department) {
      query = query.eq('job_departments.department', department);
    }

    if (startDate) {
      query = query.gte('start_time', startDate.toISOString());
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
    const jobIds = jobs.map(job => job.id).filter(Boolean);
    const assignmentLookup = jobs.reduce<Record<string, any[]>>((acc, job) => {
      acc[job.id] = job.job_assignments || [];
      return acc;
    }, {});

    let timesheetAssignments: Record<string, AggregatedTimesheetAssignment[]> = {};
    if (jobIds.length > 0) {
      const { data: timesheetRows, error: timesheetError } = await supabase
        .from('timesheets')
        .select(`
          job_id,
          technician_id,
          date,
          is_schedule_only,
          technician:profiles!fk_timesheets_technician_id(
            id,
            first_name,
            last_name,
            nickname,
            department
          )
        `)
        .eq('is_schedule_only', false)
        .in('job_id', jobIds);

      if (timesheetError) {
        console.error('useOptimizedJobs: Error fetching timesheet rows', sanitizeLogData(timesheetError));
        throw timesheetError;
      }

      timesheetAssignments = aggregateJobTimesheets(
        (timesheetRows || []) as TimesheetRowWithTechnician[],
        assignmentLookup
      );
    }

    // Process the data to match expected format with optimized processing
    const processedJobs = jobs.map(job => ({
      ...job,
      job_documents: job.job_documents || [],
      flex_folders_exist: (job.flex_folders?.length || 0) > 0,
      assignments: timesheetAssignments[job.id] || [],
      timesheet_assignments: timesheetAssignments[job.id] || []
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
    console.log(`useOptimizedJobs: Successfully fetched ${filteredJobs.length} jobs in ${duration}ms`);

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
