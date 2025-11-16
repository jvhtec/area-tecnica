
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client"; // Updated import path
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { trackError } from "@/lib/errorTracking";

export const useJobs = () => {
  const queryClient = useQueryClient();

  // Set up multi-table subscriptions using our enhanced hooks
  useMultiTableSubscription([
    { table: 'jobs', queryKey: 'jobs' },
    { table: 'job_date_types', queryKey: 'jobs' },
    { table: 'job_assignments', queryKey: 'jobs' },
    { table: 'job_departments', queryKey: 'jobs' },
    { table: 'job_documents', queryKey: 'jobs' },
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
                technician_id,
                sound_role,
                lights_role,
                video_role,
                profiles(
                  first_name,
                  last_name
                )
              ),
              job_documents(*),
              tour_date:tour_dates(*)
            `)
            .order("start_time", { ascending: true });

          if (error) {
            console.error("Error fetching jobs:", error);
            throw error;
          }

          console.log("Jobs fetched successfully:", jobs);

          const allJobs = jobs || [];

          // Load tour metadata to hide cancelled/deleted tours
          const tourIds = Array.from(new Set(allJobs.map(j => j.tour_id).filter(Boolean)));
          const tourMeta: Record<string, { status: string | null; deleted: boolean | null }> = {};
          if (tourIds.length > 0) {
            const { data: toursData, error: toursError } = await supabase
              .from('tours')
              .select('id, status, deleted')
              .in('id', tourIds as string[]);
            if (!toursError) {
              for (const t of (toursData || [])) {
                tourMeta[t.id] = { status: t.status ?? null, deleted: (t.deleted as any) ?? null };
              }
            } else {
              console.warn('useJobs: Failed to load tour metadata', toursError);
            }
          }

          // Filter out jobs from cancelled/deleted tours and explicitly cancelled jobs
          const filteredJobs = allJobs.filter(j => {
            if (j.status === 'Cancelado') return false;
            const meta = j.tour_id ? tourMeta[j.tour_id] : null;
            if (meta && (meta.status === 'cancelled' || meta.deleted === true)) return false;
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
