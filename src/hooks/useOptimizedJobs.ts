
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUnifiedSubscriptions } from "@/hooks/useUnifiedSubscriptions";
import { Department } from "@/types/department";

/**
 * Optimized jobs hook that consolidates multiple queries and subscriptions
 * Replaces multiple individual hooks with a single, efficient query
 */
export const useOptimizedJobs = (
  department?: Department,
  startDate?: Date,
  endDate?: Date
) => {
  const queryClient = useQueryClient();

  // Consolidated subscription for all job-related tables
  useUnifiedSubscriptions([
    'jobs',
    'job_assignments', 
    'job_departments',
    'job_documents',
    'job_date_types',
    'sound_job_tasks',
    'lights_job_tasks', 
    'video_job_tasks',
    'sound_job_personnel',
    'lights_job_personnel',
    'video_job_personnel',
    'flex_folders',
    'locations'
  ], ['jobs']);

  const fetchOptimizedJobs = async () => {
    console.log("useOptimizedJobs: Fetching optimized jobs data");
    
    let query = supabase
      .from('jobs')
      .select(`
        *,
        location:locations!inner(
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
          status,
          assigned_at,
          profiles!inner(
            id,
            first_name,
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
          uploaded_at
        ),
        job_date_types(
          type,
          date
        ),
        sound_job_tasks(
          id,
          task_type,
          status,
          progress,
          assigned_to,
          created_at,
          updated_at,
          task_documents(*)
        ),
        lights_job_tasks(
          id, 
          task_type,
          status,
          progress,
          assigned_to,
          created_at,
          updated_at
        ),
        video_job_tasks(
          id,
          task_type, 
          status,
          progress,
          assigned_to,
          created_at,
          updated_at
        ),
        sound_job_personnel(*),
        lights_job_personnel(*),
        video_job_personnel(*),
        flex_folders(
          id,
          element_id,
          department,
          folder_type
        ),
        tour_date:tour_dates(*)
      `)
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
      console.error("useOptimizedJobs: Error fetching jobs:", error);
      throw error;
    }

    // Process the data to match expected format
    const processedJobs = data?.map(job => ({
      ...job,
      // Filter documents by department if specified
      job_documents: department 
        ? job.job_documents?.filter(doc => 
            doc.file_path?.startsWith(`${department}/`)
          ) || []
        : job.job_documents || [],
      // Add computed properties
      flex_folders_exist: (job.flex_folders?.length || 0) > 0,
      // Flatten assignments for easier access
      assignments: job.job_assignments || [],
      // Consolidate tasks by department
      tasks: {
        sound: job.sound_job_tasks || [],
        lights: job.lights_job_tasks || [],
        video: job.video_job_tasks || []
      },
      personnel: {
        sound: job.sound_job_personnel?.[0] || null,
        lights: job.lights_job_personnel?.[0] || null, 
        video: job.video_job_personnel?.[0] || null
      }
    })) || [];

    console.log(`useOptimizedJobs: Successfully fetched ${processedJobs.length} jobs`);
    return processedJobs;
  };

  return useQuery({
    queryKey: ['optimized-jobs', department, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: fetchOptimizedJobs,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
};
