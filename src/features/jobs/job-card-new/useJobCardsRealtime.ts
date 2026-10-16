import type { QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query";
import { createQueryKey } from "@/lib/optimized-react-query";
import { useJobScopedRealtime, type JobScopedRealtimeSource } from "@/hooks/realtime/useJobScopedRealtime";

/** `[scope, id]` for one card, or the `[scope]` prefix (every card) when the id is unknown. */
const scoped = (scope: string, id: string | null): QueryKey => queryKeys.scope(scope, ...(id ? [id] : []));

// What a job card loads on its own, beyond the list query (`optimized-jobs`),
// which useOptimizedJobs already keeps live. Without these, folder state, role
// coverage, tasks, artists, documents, transport, WhatsApp groups and the
// calculator defaults only refreshed on reload.
const JOB_CARD_SOURCES: JobScopedRealtimeSource[] = [
  { table: "flex_folders", keys: (jobId) => [scoped("folder-existence", jobId)] },
  { table: "job_required_roles", keys: (jobId) => [scoped("job-required-summary", jobId)] },
  { table: "sound_job_tasks", keys: (jobId) => [jobId ? createQueryKey.tasks.byJob(jobId) : createQueryKey.tasks.all] },
  { table: "festival_artists", keys: (jobId) => [scoped("jobcard-artists", jobId)] },
  // Rider files hang off an artist, not a job.
  { table: "festival_artist_files", scopeColumn: null, keys: () => [scoped("jobcard-rider-files", null)] },
  // Tour documents hang off a tour; the card key leads with the job id.
  { table: "tour_documents", scopeColumn: null, keys: () => [scoped("jobcard-tour-documents", null)] },
  {
    table: "transport_requests",
    keys: (jobId) => [scoped("transport-request", jobId), scoped("transport-requests-all", jobId)],
  },
  // Items hang off a request.
  {
    table: "transport_request_items",
    scopeColumn: null,
    keys: () => [scoped("transport-request", null), scoped("transport-requests-all", null)],
  },
  { table: "logistics_events", keys: (jobId) => [scoped("logistics-events-for-job", jobId)] },
  { table: "job_whatsapp_groups", keys: (jobId) => [scoped("job-whatsapp-group", jobId)] },
  { table: "job_whatsapp_group_requests", keys: (jobId) => [scoped("job-whatsapp-group-request", jobId)] },
  // Calculator defaults: `["tour-default-exists", tourId, department]`.
  { table: "tour_default_sets", scopeColumn: "tour_id", keys: (tourId) => [scoped("tour-default-exists", tourId)] },
  { table: "tour_default_tables", scopeColumn: null, keys: () => [scoped("tour-default-exists", null)] },
];

/** Keeps every job card on the page live; mount once per page that lists cards. */
export function useJobCardsRealtime(enabled = true) {
  useJobScopedRealtime("job-cards", JOB_CARD_SOURCES, enabled);
}
