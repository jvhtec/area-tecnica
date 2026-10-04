import React from 'react';
import { toast } from 'sonner';
import type { AssignmentCommandState } from '@/features/assignments/commands';
import {
  buildRemoveRows,
  groupAssignedPairs,
  pairKey,
  planAssignRows,
  planConfirmRows,
  type BatchLookups,
} from '@/features/matrix-v2/batch/plan';
import { batchReversible, combineUndos, problemRows, retryRow, runBatch, runRow, tally } from '@/features/matrix-v2/batch/runBatch';
import { daysByTechnician, parseCellKey } from '@/features/matrix-v2/batch/selection';
import type { BatchRow } from '@/features/matrix-v2/batch/types';
import { isFocusableJob } from '@/features/matrix-v2/focus/focusableJob';
import { jobDayKeys, jobRangeLabel } from '@/features/matrix-v2/jobDays';
import { showUndoToast } from '@/features/matrix-v2/undoToast';
import { markUnavailableManyWithUndo } from '@/features/matrix-v2/unavailability';
import type { MatrixV2ViewConfig } from '@/features/matrix-v2/viewConfig';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';
import { madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';

type Kind = 'assign' | 'confirm' | 'remove';

const STATE_READS_IN_FLIGHT = 4;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const titleFor = (kind: Kind, n: number) => {
  switch (kind) {
    case 'assign': return plural(n, 'persona asignada', 'personas asignadas');
    case 'confirm': return plural(n, 'asignación confirmada', 'asignaciones confirmadas');
    case 'remove': return plural(n, 'asignación quitada', 'asignaciones quitadas');
  }
};

interface Options {
  v2: MatrixV2ViewConfig | undefined;
  canEdit: boolean;
  selectedCells: Set<string>;
  clearSelection: () => void;
  lookups: BatchLookups;
  jobs: MatrixJob[];
}

/**
 * Acts on the selected cells as a batch: one row per job/technician pair, one
 * command per row step, a few in flight, each row's outcome kept. Nothing rolls
 * back another row; a change that did not go through is shown with how to fix it.
 */
export function useMatrixBatch({ v2, canEdit, selectedCells, clearSelection, lookups, jobs }: Options) {
  const runner = v2?.runner;
  const [rows, setRowsState] = React.useState<BatchRow[]>([]);
  const rowsRef = React.useRef<BatchRow[]>([]);
  const [running, setRunning] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const setRows = React.useCallback((next: BatchRow[] | ((previous: BatchRow[]) => BatchRow[])) => {
    rowsRef.current = typeof next === 'function' ? next(rowsRef.current) : next;
    setRowsState(rowsRef.current);
  }, []);
  const replaceRow = React.useCallback((row: BatchRow) => setRows((previous) => previous.map((candidate) => (candidate.id === row.id ? row : candidate))), [setRows]);

  const eligibleJobs = React.useMemo(() => {
    if (selectedCells.size === 0) return [];
    const days = new Set<string>();
    selectedCells.forEach((key) => days.add(parseCellKey(key).dateKey));
    return jobs
      .filter((job) => isFocusableJob(job) && jobDayKeys(job).some((day) => days.has(day)))
      .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.title.localeCompare(b.title))
      .map((job) => ({ id: job.id, title: job.title, range: jobRangeLabel(job) }));
  }, [selectedCells, jobs]);

  const removal = React.useMemo(() => {
    const { pairs } = groupAssignedPairs(selectedCells, lookups);
    return {
      pairs: pairs.length,
      people: new Set(pairs.map((pair) => pair.technicianId)).size,
      days: pairs.reduce((sum, pair) => sum + pair.days.length, 0),
    };
  }, [selectedCells, lookups]);

  const report = React.useCallback((final: BatchRow[], kind: Kind) => {
    const counts = tally(final);
    const problems = problemRows(final).length;
    if (counts.done === 0) {
      if (problems === 0) toast.info('Ya estaba así: no había nada que cambiar');
      else toast.error(plural(problems, 'fila necesita', 'filas necesitan') + ' tu atención: no se aplicó ningún cambio');
      return;
    }
    const title = titleFor(kind, counts.done);
    const description = problems > 0 ? `${plural(problems, 'fila necesita', 'filas necesitan')} tu atención` : undefined;
    const undo = batchReversible(final) ? combineUndos(final.flatMap((row) => row.undos)) : null;
    if (undo) showUndoToast({ title, description, undo });
    else toast.success(title, { description });
  }, []);

  const execute = React.useCallback(async (planned: BatchRow[], kind: Kind) => {
    if (!runner) return;
    if (planned.length === 0) {
      toast.info('No hay nada que hacer con esta selección.');
      return;
    }
    setDismissed(false);
    setRows(planned);
    setRunning(true);
    try {
      const final = await runBatch(runner, planned, { onRow: replaceRow });
      setRows(final);
      report(final, kind);
    } finally {
      setRunning(false);
      clearSelection();
    }
  }, [runner, setRows, replaceRow, report, clearSelection]);

  const assignTo = React.useCallback((jobId: string, status: 'invited' | 'confirmed') => {
    void execute(planAssignRows(selectedCells, jobId, status, lookups), 'assign');
  }, [execute, selectedCells, lookups]);

  const confirm = React.useCallback(() => {
    const plan = planConfirmRows(selectedCells, lookups);
    if (plan.rows.length === 0) {
      const reasons = [
        plan.alreadyConfirmed > 0 ? plan.alreadyConfirmed + ' ya confirmadas' : null,
        plan.notInvited > 0 ? plan.notInvited + ' sin invitación pendiente' : null,
        plan.empty > 0 ? plan.empty + ' celdas sin asignación' : null,
      ].filter(Boolean).join(', ');
      toast.info(`No hay invitaciones que confirmar${reasons ? ` (${reasons})` : ''}.`);
      clearSelection();
      return;
    }
    void execute(plan.rows, 'confirm');
  }, [selectedCells, lookups, execute, clearSelection]);

  /** Reads each pair's real days first: removing a pair's last day is a removal of the assignment. */
  const remove = React.useCallback(async () => {
    const { pairs } = groupAssignedPairs(selectedCells, lookups);
    if (pairs.length === 0 || !runner) {
      toast.info('No hay asignaciones que quitar en esta selección.');
      clearSelection();
      return;
    }
    setRunning(true);
    const states = new Map<string, AssignmentCommandState>();
    const queue = [...pairs];
    const worker = async () => {
      for (let pair = queue.shift(); pair; pair = queue.shift()) {
        try {
          // The runner's own cache: the removal commands that follow reuse this read.
          states.set(pairKey(pair.technicianId, pair.jobId), await runner.loadState(pair.jobId, pair.technicianId));
        } catch {
          // The row is skipped with a reason rather than guessed at.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(STATE_READS_IN_FLIGHT, pairs.length) }, worker));
    setRunning(false);
    await execute(buildRemoveRows(pairs, states, lookups), 'remove');
  }, [selectedCells, lookups, runner, execute, clearSelection]);

  const markUnavailable = React.useCallback(async () => {
    if (!canEdit) {
      toast.error('Solo managers y administradores pueden marcar disponibilidad.');
      return;
    }
    const free = [...selectedCells].filter((key) => {
      const { technicianId, dateKey } = parseCellKey(key);
      return !lookups.assignmentOn(technicianId, dateKey) && !lookups.isUnavailable(technicianId, dateKey);
    });
    const withAssignment = selectedCells.size - free.length;
    const groups = [...daysByTechnician(free)].map(([technicianId, dateKeys]) => ({ technicianId, dateKeys }));
    if (groups.length === 0) {
      toast.info('No hay días libres que marcar: las celdas elegidas ya tienen asignación o no disponibilidad.');
      clearSelection();
      return;
    }
    setRunning(true);
    const result = await markUnavailableManyWithUndo(groups);
    setRunning(false);
    if (!result.ok) toast.error(result.message);
    else if (withAssignment > 0) toast.info(`${plural(withAssignment, 'celda con asignación se dejó', 'celdas con asignación se dejaron')} como estaban.`);
    clearSelection();
  }, [canEdit, selectedCells, lookups, clearSelection]);

  /** Runs one row again; Forzar accepts the clash it stopped on. */
  const rerun = React.useCallback(async (rowId: string, force: boolean) => {
    const row = rowsRef.current.find((candidate) => candidate.id === rowId);
    if (!row || !runner || row.status !== 'failed') return;
    const finished = await runRow(runner, retryRow(row, { force }), replaceRow);
    if (finished.status === 'done') {
      const undo = batchReversible([finished]) ? combineUndos(finished.undos) : null;
      const title = `${finished.name}: cambio aplicado`;
      if (undo) showUndoToast({ title, description: finished.summary, undo });
      else toast.success(title, { description: finished.summary });
    }
  }, [runner, replaceRow]);

  const openRow = React.useCallback((row: BatchRow) => {
    const date = row.openAt ? madridDateKeyToCalendarDate(row.openAt.dateKey) : null;
    if (row.openAt && date) v2?.openInspector(row.openAt.technicianId, date, null);
  }, [v2]);

  const problems = React.useMemo(() => (dismissed ? [] : problemRows(rows)), [rows, dismissed]);
  const finished = rows.filter((row) => row.status !== 'pending' && row.status !== 'running').length;

  return {
    eligibleJobs,
    removal,
    problems,
    running,
    progress: running && rows.length > 0 ? { done: finished, total: rows.length } : null,
    assignTo,
    confirm,
    remove,
    markUnavailable,
    retry: React.useCallback((rowId: string) => { void rerun(rowId, false); }, [rerun]),
    force: React.useCallback((rowId: string) => { void rerun(rowId, true); }, [rerun]),
    openRow,
    dismiss: React.useCallback(() => setDismissed(true), []),
  };
}
