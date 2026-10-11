import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';

/** Dry-hire jobs have no crew, and a cancelled job takes no assignments. */
export const isFocusableJob = (job: Pick<MatrixJob, 'job_type' | 'status'>): boolean =>
  job.job_type !== 'dryhire' && job.status !== 'cancelado';

export const NOT_FOCUSABLE_MESSAGE = 'Este trabajo no admite equipo (alquiler sin personal o cancelado).';
