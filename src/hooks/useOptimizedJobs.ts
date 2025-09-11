
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUnifiedSubscriptions } from "@/hooks/useUnifiedSubscriptions";
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
        flex_folders(
          id,
          element_id,
          department,
          folder_type
        ),
        tours(status)
      `)
      .in('job_type', ['single', 'festival', 'tourdate'])
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

    // Process the data to match expected format with optimized processing
    const processedJobs = data?.map(job => ({
      ...job,
      // Filter documents by department if specified with security validation
      job_documents: department 
        ? job.job_documents?.filter(doc => 
            doc.file_path?.startsWith(`${department}/`) && 
            doc.file_name && // Ensure file name exists
            doc.file_path.length < 500 // Prevent excessively long paths
          ) || []
        : job.job_documents || [],
      // Add computed properties
      flex_folders_exist: (job.flex_folders?.length || 0) > 0,
      // Flatten assignments for easier access
      assignments: job.job_assignments || []
    }))
      // Filter out cancelled jobs and jobs from cancelled tours
      ?.filter(job => {
        // Exclude cancelled jobs
        if (job.status === 'Cancelado') return false;
        // If job has no tour, include it (regular job)
        if (!job.tours) return true;
        // If job has tour, only include if tour is active
        return job.tours.status === 'active';
      }) || [];

    const duration = Date.now() - startTime;
    console.log(`useOptimizedJobs: Successfully fetched ${processedJobs.length} jobs in ${duration}ms`);
    
    // Log performance warning if query is slow
    if (duration > 2000) {
      console.warn(`useOptimizedJobs: Slow query detected - ${duration}ms for ${processedJobs.length} jobs`);
    }
    
    return processedJobs;
  };

  return useQuery({
    queryKey: ['optimized-jobs', department, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: fetchOptimizedJobs,
    staleTime: 1000 * 60 * 5, // 5 minutes - increased for better caching
    gcTime: 1000 * 60 * 10, // 10 minutes - cache jobs longer
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
};
