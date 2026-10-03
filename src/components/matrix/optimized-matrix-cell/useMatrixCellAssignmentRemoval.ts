import { useCallback, useRef, useState } from 'react';
import { formatMadridDateKey } from '@/utils/timezoneUtils';
import { toast } from 'sonner';

import {
  AssignmentCommandError,
  assignmentCommandMessage,
  createAssignmentCommandId,
  getAssignmentCommandState,
  reconcileAssignmentViews,
  removeAssignmentDate,
  removeDirectAssignment,
  requireCommitted,
  runAssignmentSideEffects,
  type AssignmentCommandResult,
} from '@/features/assignments/commands';
import { getErrorMessage } from '@/utils/errorMessage';
import type { MultiDateRemovalState } from '@/components/matrix/optimized-matrix-cell/types';

type UseMatrixCellAssignmentRemovalArgs = {
  assignment: { job_id?: string | null } | null | undefined;
  technician: {
    id: string;
    department: string;
  };
  date: Date;
};

const INITIAL_MULTI_DATE_REMOVAL: MultiDateRemovalState = {
  isOpen: false,
  isLoading: false,
  otherDates: [],
  otherDatesCount: 0,
  currentDate: null,
  removeOption: 'single',
  stateToken: null,
};

export const useMatrixCellAssignmentRemoval = ({
  assignment,
  technician,
  date,
}: UseMatrixCellAssignmentRemovalArgs) => {
  const [multiDateRemoval, setMultiDateRemoval] = useState<MultiDateRemovalState>(INITIAL_MULTI_DATE_REMOVAL);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);
  // Reused only while the outcome of the same decision is unknown (network).
  const pendingCommandRef = useRef<{ fingerprint: string; id: string } | null>(null);

  const commandIdFor = (fingerprint: string) => {
    if (pendingCommandRef.current?.fingerprint !== fingerprint) {
      pendingCommandRef.current = { fingerprint, id: createAssignmentCommandId() };
    }
    return pendingCommandRef.current.id;
  };

  const checkMultiDateAssignment = useCallback(async () => {
    if (!assignment?.job_id) return;

    const currentDateStr = formatMadridDateKey(date);
    setMultiDateRemoval((prev) => ({ ...prev, isOpen: true, isLoading: true, currentDate: currentDateStr }));

    try {
      const state = await getAssignmentCommandState(assignment.job_id, technician.id);
      const otherDates = state.dates.filter((activeDate) => activeDate !== currentDateStr);

      setMultiDateRemoval({
        isOpen: true,
        isLoading: false,
        otherDates,
        otherDatesCount: otherDates.length,
        currentDate: currentDateStr,
        removeOption: 'single',
        stateToken: state.state_token,
      });
    } catch (error) {
      console.error('Error checking multi-date assignment:', error);
      // Without a known state the removal stays day-scoped: the database
      // refuses to treat the last day as a date removal (see below).
      setMultiDateRemoval({
        isOpen: true,
        isLoading: false,
        otherDates: [],
        otherDatesCount: 0,
        currentDate: currentDateStr,
        removeOption: 'single',
        stateToken: null,
      });
    }
  }, [assignment?.job_id, technician.id, date]);

  const runSideEffects = useCallback((result: AssignmentCommandResult) => {
    if (result.side_effects.length === 0) return;
    void runAssignmentSideEffects(result.command_id, result, { technicianDepartment: technician.department })
      .then((summary) => {
        if (summary.failed > 0) {
          toast.error('La asignación se eliminó, pero falló la sincronización con Flex o la notificación. Queda registrado para reintentar.');
        }
      }, (error: unknown) => {
        console.error('Assignment removal side effects could not run', error);
      });
  }, [technician.department]);

  const handleRemoveAssignment = useCallback(async (removeAll: boolean) => {
    if (!assignment?.job_id) return;
    const jobId = assignment.job_id;
    const { currentDate, stateToken, otherDatesCount } = multiDateRemoval;

    setIsRemovingAssignment(true);
    try {
      let wholeRemovalToken = stateToken;
      if (!removeAll && currentDate) {
        // Day-scoped first. The database removes only this day, or answers
        // `last_date` when it is the last one — decided under the pair lock,
        // not from the possibly stale count shown in the dialog.
        const dayInput = { jobId, technicianId: technician.id, date: currentDate, expectedStateToken: stateToken, source: 'matrix' };
        const dayResult = await removeAssignmentDate({ ...dayInput, commandId: commandIdFor(JSON.stringify(dayInput)) });
        pendingCommandRef.current = null;
        if (dayResult.ok) {
          toast.success(dayResult.outcome === 'noop' ? 'Ese día ya no estaba asignado' : 'Día eliminado de la asignación');
          setMultiDateRemoval((prev) => ({ ...prev, isOpen: false }));
          reconcileAssignmentViews(null, { technicianId: technician.id, jobIds: [jobId] });
          return;
        }
        if (dayResult.code !== 'last_date') requireCommitted(dayResult);
        // The last day: the whole membership goes, guarded by the state the
        // database just reported.
        wholeRemovalToken = dayResult.state_token;
      }

      const removeInput = { jobId, technicianId: technician.id, expectedStateToken: wholeRemovalToken, source: 'matrix' };
      const result = requireCommitted(await removeDirectAssignment({
        ...removeInput,
        commandId: commandIdFor(JSON.stringify({ remove: removeInput })),
      }));
      pendingCommandRef.current = null;
      runSideEffects(result);

      const removedDays = result.removed?.deleted_timesheets ?? otherDatesCount + 1;
      toast.success(removedDays > 1 ? `${removedDays} días eliminados de la asignación` : 'Asignación eliminada');
      setMultiDateRemoval((prev) => ({ ...prev, isOpen: false }));
      reconcileAssignmentViews(null, { technicianId: technician.id, jobIds: [jobId] });
    } catch (error: unknown) {
      if (error instanceof AssignmentCommandError) {
        if (!error.retryable && error.code !== 'unknown') pendingCommandRef.current = null;
        if (error.code === 'stale_state') {
          reconcileAssignmentViews(null, { technicianId: technician.id, jobIds: [jobId] });
          setMultiDateRemoval((prev) => ({ ...prev, isOpen: false }));
        }
        toast.error(error.message || assignmentCommandMessage(error.code));
      } else {
        pendingCommandRef.current = null;
        toast.error(getErrorMessage(error, 'No se pudo eliminar la asignación'));
      }
    } finally {
      setIsRemovingAssignment(false);
    }
  }, [assignment?.job_id, technician.id, multiDateRemoval, runSideEffects]);

  return {
    multiDateRemoval,
    setMultiDateRemoval,
    isRemovingAssignment,
    checkMultiDateAssignment,
    handleRemoveAssignment,
  };
};
