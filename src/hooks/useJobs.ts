
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client"; // Updated import path
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { trackError } from "@/lib/errorTracking";
import { aggregateJobTimesheets, TimesheetRowWithTechnician, AggregatedTimesheetAssignment } from "@/utils/timesheetAssignments";

export const useJobs = () => {
  const queryClient = useQueryClient();

  // Set up multi-table subscriptions using our enhanced hooks
  useMultiTableSubscription([
    { table: 'jobs', queryKey: 'jobs' },
    { table: 'job_date_types', queryKey: 'jobs' },
    { table: 'job_assignments', queryKey: 'jobs' },
    { table: 'job_departments', queryKey: 'jobs' },
    { table: 'job_documents', queryKey: 'jobs' },
    { table: 'timesheets', queryKey: 'jobs' },
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

          const jobIds = allJobs.map(j => j.id).filter(Boolean);
          const assignmentLookup = allJobs.reduce<Record<string, any[]>>((acc, job) => {
            acc[job.id] = job.job_assignments || [];
            return acc;
          }, {});

          let timesheetAssignments: Record<string, AggregatedTimesheetAssignment[]> = {};
          if (jobIds.length > 0) {
            // Batch job IDs to avoid URL length limits (max ~100 UUIDs per request)
            const BATCH_SIZE = 100;
            const batches: string[][] = [];

            for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
              batches.push(jobIds.slice(i, i + BATCH_SIZE));
            }

            // Execute all batches in parallel for better performance
            const batchPromises = batches.map(batchIds =>
              supabase
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
                .eq('is_active', true)
                .in('job_id', batchIds)
            );

            const batchResults = await Promise.all(batchPromises);

            // Check for errors and collect all rows
            const allTimesheetRows: TimesheetRowWithTechnician[] = [];
            for (const { data: timesheetRows, error: timesheetError } of batchResults) {
              if (timesheetError) {
                console.error('useJobs: Error fetching timesheets', timesheetError);
                throw timesheetError;
              }
              if (timesheetRows) {
                allTimesheetRows.push(...(timesheetRows as TimesheetRowWithTechnician[]));
              }
            }

            timesheetAssignments = aggregateJobTimesheets(
              allTimesheetRows,
              assignmentLookup
            );
          }

          const jobsWithTimesheets = allJobs.map(job => ({
            ...job,
            timesheet_assignments: timesheetAssignments[job.id] || [],
          }));

          // Load tour metadata to hide cancelled/deleted tours
          const tourIds = Array.from(new Set(jobsWithTimesheets.map(j => j.tour_id).filter(Boolean)));
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
          const filteredJobs = jobsWithTimesheets.filter(j => {
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
