
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase"; // Updated import path
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { trackError } from "@/lib/errorTracking";

export const useJobs = () => {
  // Set up multi-table subscriptions using our enhanced hooks
  useMultiTableSubscription([
    { table: 'jobs', queryKey: ['jobs'], priority: 'high' },
    { table: 'job_assignments', queryKey: ['jobs'], priority: 'medium' },
    { table: 'job_departments', queryKey: ['jobs'], priority: 'medium' },
    // Documents and tour dates change less frequently; keep lower priority
    { table: 'job_documents', queryKey: ['jobs'], priority: 'low' },
    { table: 'tour_dates', queryKey: ['jobs'], priority: 'low' },
    { table: 'tours', queryKey: ['jobs'], priority: 'low' },
  ]);

  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      console.log("Fetching jobs...");
      
      // Add retry logic
      const fetchWithRetry = async (retries = 3) => {
        try {
          const { data: jobs, error } = await supabase
            .from("jobs")
            .select(`
              *,
              location:locations(name),
              job_departments!inner(department),
              job_assignments(
                id,
                technician_id,
                sound_role,
                lights_role,
                video_role,
                assignment_source,
                status,
                single_day,
                assignment_date,
                profiles!job_assignments_technician_id_fkey(
                  id,
                  first_name,
                  last_name,
                  nickname,
                  department
                )
              ),
              job_documents(
                id,
                file_name,
                file_path,
                uploaded_at,
                visible_to_tech,
                read_only,
                template_type
              ),
              tour_date:tour_dates(
                id,
                date,
                start_date,
                end_date,
                is_tour_pack_only,
                tour: tours(
                  id,
                  name,
                  status,
                  deleted
                ),
                location:locations(name)
              )
            `)
            .order("start_time", { ascending: true });

          if (error) {
            console.error("Error fetching jobs:", error);
            throw error;
          }

          console.log("Jobs fetched successfully:", jobs);

          const allJobs = jobs || [];

          // Filter out jobs from cancelled/deleted tours and explicitly cancelled jobs
          const filteredJobs = allJobs.filter((job: any) => {
            if (job.status === 'Cancelado') return false;

            const tourMeta = job?.tour_date?.tour;
            if (tourMeta && (tourMeta.status === 'cancelled' || tourMeta.deleted === true)) {
              return false;
            }

            return true;
          });

          return filteredJobs;
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return fetchWithRetry(retries - 1);
          }
          void trackError(error, {
            system: 'assignments',
            operation: 'useJobs.fetch',
            retriesAttempted: 3
          });
          throw error;
        }
      };

      return fetchWithRetry();
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
};
