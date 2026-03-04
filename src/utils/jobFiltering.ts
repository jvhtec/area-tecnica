/**
 * Job filtering utilities
 */

interface Job {
  status?: string;
  tour_date?: {
    tour?: {
      status?: string;
      deleted?: boolean;
    } | null;
  } | null;
}

/**
 * Filters out cancelled jobs and jobs from cancelled/deleted tours.
 * Used by useJobs hook and tests.
 */
export function filterVisibleJobs<T extends Job>(jobs: T[]): T[] {
  return jobs.filter((job) => {
    // Explicitly cancelled jobs are always hidden
    if (job.status === 'Cancelado') return false;

    // Jobs from cancelled or deleted tours are hidden
    const tourMeta = job?.tour_date?.tour;
    if (tourMeta && (tourMeta.status === 'cancelled' || tourMeta.deleted === true)) {
      return false;
    }

    return true;
  });
}
