import { toast } from 'sonner';
import type { MatrixRunOutcome } from '@/features/matrix-v2/types';
import { showUndoToast } from '@/features/matrix-v2/undoToast';

const effectsNote = (outcome: Extract<MatrixRunOutcome, { ok: true }>) =>
  outcome.result.side_effects.length > 0 ? 'Se avisará en unos segundos: puedes deshacerlo.' : undefined;

/** Tells the manager how a finished command went, with Deshacer when it can be taken back. */
export function reportDone(title: string, outcome: Extract<MatrixRunOutcome, { ok: true }>, description: string | undefined) {
  if (outcome.noop) {
    toast.info('Ya estaba así: no había nada que cambiar');
    return;
  }
  if (outcome.result.warnings.length > 0) {
    toast.error('Se guardó, pero no se pudo recalcular el importe de algún parte');
  }
  if (outcome.undo) {
    showUndoToast({ title, description: [description, effectsNote(outcome)].filter(Boolean).join(' · ') || undefined, undo: outcome.undo });
  } else {
    toast.success(title, { description });
  }
}
