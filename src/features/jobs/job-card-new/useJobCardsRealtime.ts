import { queryKeys } from "@/lib/react-query";
import { createQueryKey } from "@/lib/optimized-react-query";
import { useJobScopedRealtime, type JobScopedRealtimeSource } from "@/hooks/realtime/useJobScopedRealtime";

// What a job card loads on its own, beyond the list query (`optimized-jobs`),
// which useOptimizedJobs already keeps live. Without these, folder state, role
// coverage, tasks, artists and transport only refreshed on reload.
const JOB_CARD_SOURCES: JobScopedRealtimeSource[] = [
  { table: "flex_folders", keys: (jobId) => [queryKeys.scope("folder-existence", ...(jobId ? [jobId] : []))] },
  { table: "job_required_roles", keys: (jobId) => [queryKeys.scope("job-required-summary", ...(jobId ? [jobId] : []))] },
  { table: "sound_job_tasks", keys: (jobId) => [jobId ? createQueryKey.tasks.byJob(jobId) : createQueryKey.tasks.all] },
  { table: "festival_artists", keys: (jobId) => [queryKeys.scope("jobcard-artists", ...(jobId ? [jobId] : []))] },
  // Rider files hang off an artist, not a job.
  { table: "festival_artist_files", jobIdColumn: null, keys: () => [queryKeys.scope("jobcard-rider-files")] },
  // Tour documents hang off a tour; the card key leads with the job id.
  { table: "tour_documents", jobIdColumn: null, keys: () => [queryKeys.scope("jobcard-tour-documents")] },
  {
    table: "transport_requests",
    keys: (jobId) => [
      queryKeys.scope("transport-request", ...(jobId ? [jobId] : [])),
      queryKeys.scope("transport-requests-all", ...(jobId ? [jobId] : [])),
    ],
  },
  { table: "logistics_events", keys: (jobId) => [queryKeys.scope("logistics-events-for-job", ...(jobId ? [jobId] : []))] },
];

/** Keeps every job card on the page live; mount once per page that lists cards. */
export function useJobCardsRealtime(enabled = true) {
  useJobScopedRealtime("job-cards", JOB_CARD_SOURCES, enabled);
}
