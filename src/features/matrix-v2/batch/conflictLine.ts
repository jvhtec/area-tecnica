import type { BatchFailure } from '@/features/matrix-v2/batch/types';

/** "Ya tiene confirmado X, Y" for a clash, from what the server reported. */
export function conflictLine(failure: BatchFailure | null | undefined): string | null {
  const details = failure?.conflict?.conflicts;
  if (!details) return null;
  const titles = [...details.hardConflicts, ...details.softConflicts].map((job) => job.title).filter(Boolean);
  const off = details.unavailabilityConflicts.length;
  const parts = [
    titles.length > 0 ? `Ya tiene ${titles.join(', ')}` : null,
    off > 0 ? `${off === 1 ? '1 día no disponible' : `${off} días no disponibles`}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
