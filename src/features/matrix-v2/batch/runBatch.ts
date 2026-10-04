import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import type { BatchFailure, BatchRow, BatchTally } from '@/features/matrix-v2/batch/types';
import type { MatrixIntent, MatrixUndo, MatrixUndoOutcome } from '@/features/matrix-v2/types';

/** How many commands are in flight at once. The database serialises per technician; this keeps the browser polite. */
export const BATCH_CONCURRENCY = 3;

const unknownFailure = (message: string): BatchFailure => ({
  ok: false, code: 'unknown', message, stale: false, conflict: null, result: null, retryable: false,
});

/**
 * Runs a row's commands in order and stops at the first that fails, leaving
 * `next` on it: a retry resumes there, and what already committed stays done.
 */
export async function runRow(runner: MatrixCommandRunner, row: BatchRow, onChange?: (row: BatchRow) => void): Promise<BatchRow> {
  let current: BatchRow = { ...row, status: 'running', failure: null, message: undefined };
  onChange?.(current);
  while (current.next < current.intents.length) {
    const intent = current.intents[current.next];
    let outcome;
    try {
      outcome = await runner.run(intent);
    } catch {
      outcome = unknownFailure('No se pudo completar la acción');
    }
    if (!outcome.ok) {
      current = { ...current, status: 'failed', failure: outcome, message: outcome.message };
      onChange?.(current);
      return current;
    }
    current = {
      ...current,
      next: current.next + 1,
      changed: current.changed || !outcome.noop,
      reversible: current.reversible && (outcome.noop || outcome.undo !== null),
      undos: outcome.undo ? [...current.undos, outcome.undo] : current.undos,
    };
  }
  current = { ...current, status: current.changed ? 'done' : 'noop' };
  onChange?.(current);
  return current;
}

/** Runs every pending row, a few at a time, reporting each row as it moves. */
export async function runBatch(
  runner: MatrixCommandRunner,
  rows: BatchRow[],
  { concurrency = BATCH_CONCURRENCY, onRow }: { concurrency?: number; onRow?: (row: BatchRow) => void } = {},
): Promise<BatchRow[]> {
  const results = new Map<string, BatchRow>(rows.map((row) => [row.id, row]));
  const queue = rows.filter((row) => row.status === 'pending');
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const finished = await runRow(runner, row, (update) => {
        results.set(update.id, update);
        onRow?.(update);
      });
      results.set(finished.id, finished);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker));
  return rows.map((row) => results.get(row.id) ?? row);
}

/** The intent again with the clash accepted: Forzar. Only assignments clash. */
export const forceIntent = (intent: MatrixIntent): MatrixIntent =>
  (intent.kind === 'assign' ? { ...intent, conflictPolicy: 'allow' } : intent);

/** A failed row, ready to run again from the command that stopped it. */
export const retryRow = (row: BatchRow, { force = false }: { force?: boolean } = {}): BatchRow => ({
  ...row,
  status: 'pending',
  failure: null,
  message: undefined,
  intents: force ? row.intents.map((intent, index) => (index === row.next ? forceIntent(intent) : intent)) : row.intents,
});

export function tally(rows: BatchRow[]): BatchTally {
  const count = (status: BatchRow['status']) => rows.filter((row) => row.status === status).length;
  return { total: rows.length, done: count('done'), noop: count('noop'), failed: count('failed'), skipped: count('skipped'), needsRole: count('needs-role') };
}

/** Rows that need the manager: something failed, was skipped or needs a role. */
export const problemRows = (rows: BatchRow[]) => rows.filter((row) => row.status === 'failed' || row.status === 'skipped' || row.status === 'needs-role');

/** True when every change the batch made can still be taken back. */
export const batchReversible = (rows: BatchRow[]) => {
  const changed = rows.filter((row) => row.changed);
  return changed.length > 0 && changed.every((row) => row.reversible && row.undos.length > 0);
};

/**
 * One Deshacer for the whole batch. It closes when the earliest change's window
 * does, and takes back what it still can, saying how many it could not.
 */
export function combineUndos(undos: MatrixUndo[], concurrency = BATCH_CONCURRENCY): MatrixUndo | null {
  if (undos.length === 0) return null;
  return {
    commandId: `batch:${undos.length}`,
    get expiresAt() { return Math.min(...undos.map((undo) => undo.expiresAt)); },
    isOpen: () => undos.some((undo) => undo.isOpen()),
    release: () => undos.forEach((undo) => undo.release()),
    undo: async (): Promise<MatrixUndoOutcome> => {
      const outcomes: MatrixUndoOutcome[] = [];
      const queue = [...undos];
      const worker = async () => {
        for (let undo = queue.shift(); undo; undo = queue.shift()) outcomes.push(await undo.undo());
      };
      await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, undos.length)) }, worker));
      const failed = outcomes.filter((outcome): outcome is Extract<MatrixUndoOutcome, { ok: false }> => !outcome.ok);
      if (failed.length === 0) return { ok: true };
      if (failed.length === outcomes.length) return failed[0];
      return { ok: false, reason: 'failed', message: `Se deshicieron ${outcomes.length - failed.length} de ${outcomes.length} cambios; el resto ya no se podía deshacer` };
    },
  };
}
