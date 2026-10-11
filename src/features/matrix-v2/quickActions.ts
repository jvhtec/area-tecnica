import { toast } from 'sonner';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { reportDone } from '@/features/matrix-v2/outcomeToast';
import type { MatrixCommandSource } from '@/features/matrix-v2/types';
import { clearUnavailableWithUndo, markUnavailableWithUndo } from '@/features/matrix-v2/unavailability';

/**
 * Actions that need no form: the cell's ✓, the C key and Stream Deck all run
 * these, so a confirmation behaves the same wherever it starts.
 */

export async function runQuickConfirm(
  runner: MatrixCommandRunner,
  { technicianId, jobId, name, jobTitle, source }: {
    technicianId: string; jobId: string; name: string; jobTitle?: string | null; source: MatrixCommandSource;
  },
): Promise<void> {
  const outcome = await runner.run({ kind: 'confirm', technicianId, jobId, source });
  if (!outcome.ok) {
    toast.error(outcome.message);
    return;
  }
  reportDone(`${name} confirmado`, outcome, jobTitle ?? undefined);
}

export async function runToggleUnavailable({ technicianId, dateKey, unavailable, canEdit }: {
  technicianId: string; dateKey: string; unavailable: boolean; canEdit: boolean;
}): Promise<void> {
  if (!canEdit) {
    toast.error('Solo managers y administradores pueden marcar disponibilidad.');
    return;
  }
  const result = unavailable
    ? await clearUnavailableWithUndo(technicianId, dateKey)
    : await markUnavailableWithUndo(technicianId, dateKey);
  if (!result.ok) toast.error(result.message);
}
