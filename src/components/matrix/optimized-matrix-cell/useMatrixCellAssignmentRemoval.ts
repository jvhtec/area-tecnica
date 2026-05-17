import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { dataLayerClient } from '@/services/dataLayerClient';
import { determineFlexDepartmentsForAssignment } from '@/utils/flexCrewAssignments';
import { readAssignmentLifecycleResult } from '@/components/matrix/optimized-matrix-cell/helpers';
import type { MultiDateRemovalState, TimesheetDateRow } from '@/components/matrix/optimized-matrix-cell/types';

type UseMatrixCellAssignmentRemovalArgs = {
  assignment: any;
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
};

export const useMatrixCellAssignmentRemoval = ({
  assignment,
  technician,
  date,
}: UseMatrixCellAssignmentRemovalArgs) => {
  const [multiDateRemoval, setMultiDateRemoval] = useState<MultiDateRemovalState>(INITIAL_MULTI_DATE_REMOVAL);
  const [isRemovingAssignment, setIsRemovingAssignment] = useState(false);

  const checkMultiDateAssignment = useCallback(async () => {
    if (!assignment?.job_id) return;

    const currentDateStr = format(date, 'yyyy-MM-dd');
    setMultiDateRemoval((prev) => ({ ...prev, isOpen: true, isLoading: true, currentDate: currentDateStr }));

    try {
      const { data: timesheets, error: timesheetError } = await dataLayerClient.from('timesheets')
        .select('date')
        .eq('job_id', assignment.job_id)
        .eq('technician_id', technician.id)
        .eq('is_active', true)
        .neq('date', currentDateStr);

      if (timesheetError) throw timesheetError;

      const otherDates = ((timesheets || []) as TimesheetDateRow[]).map((t) => t.date);

      setMultiDateRemoval({
        isOpen: true,
        isLoading: false,
        otherDates,
        otherDatesCount: otherDates.length,
        currentDate: currentDateStr,
        removeOption: 'single',
      });
    } catch (error) {
      console.error('Error checking multi-date assignment:', error);
      setMultiDateRemoval({
        isOpen: true,
        isLoading: false,
        otherDates: [],
        otherDatesCount: 0,
        currentDate: currentDateStr,
        removeOption: 'single',
      });
    }
  }, [assignment?.job_id, technician.id, date]);

  const handleRemoveAssignment = useCallback(async (removeAll: boolean) => {
    if (!assignment?.job_id) return;

    setIsRemovingAssignment(true);

    try {
      if (removeAll || multiDateRemoval.otherDatesCount === 0) {
        const { data, error } = await dataLayerClient.rpc('manage_assignment_lifecycle', {
          p_job_id: assignment.job_id,
          p_technician_id: technician.id,
          p_action: 'cancel',
          p_delete_mode: 'hard',
        });

        if (error) throw error;
        const result = readAssignmentLifecycleResult(data);
        if (result.error) throw new Error(result.error);

        const flexDepartments = determineFlexDepartmentsForAssignment(assignment, technician.department);
        if (flexDepartments.length > 0) {
          const flexRemovalResults = await Promise.allSettled(
            flexDepartments.map(async (department) => {
              const { error: flexInvokeError } = await dataLayerClient.functions.invoke('manage-flex-crew-assignments', {
                body: {
                  job_id: assignment.job_id,
                  technician_id: technician.id,
                  department,
                  action: 'remove',
                },
              });
              if (flexInvokeError) throw flexInvokeError;
            }),
          );

          flexRemovalResults.forEach((result) => {
            if (result.status === 'rejected') {
              console.error('Failed to remove Flex crew assignment:', result.reason);
            }
          });
        }

        try {
          const { error: pushError } = await dataLayerClient.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'assignment.removed',
              job_id: assignment.job_id,
              recipient_id: technician.id,
              technician_id: technician.id,
            },
          });
          if (pushError) throw pushError;
        } catch (pushErr) {
          console.warn('Failed to send assignment removal notification:', pushErr);
        }

        const message = multiDateRemoval.otherDatesCount > 0
          ? `${multiDateRemoval.otherDatesCount + 1} días eliminados de la asignación`
          : 'Asignación eliminada';
        toast.success(message);
      } else {
        const { error } = await dataLayerClient.from('timesheets')
          .delete()
          .eq('job_id', assignment.job_id)
          .eq('technician_id', technician.id)
          .eq('date', multiDateRemoval.currentDate);

        if (error) throw error;

        toast.success('Día eliminado de la asignación');
      }

      setMultiDateRemoval((prev) => ({ ...prev, isOpen: false }));
      window.dispatchEvent(new CustomEvent('assignment-updated'));
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(String(error) || 'No se pudo eliminar la asignación');
      }
    } finally {
      setIsRemovingAssignment(false);
    }
  }, [assignment, technician.id, technician.department, multiDateRemoval.otherDatesCount, multiDateRemoval.currentDate]);

  return {
    multiDateRemoval,
    setMultiDateRemoval,
    isRemovingAssignment,
    checkMultiDateAssignment,
    handleRemoveAssignment,
  };
};
