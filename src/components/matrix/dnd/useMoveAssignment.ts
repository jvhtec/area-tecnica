import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { checkTimeConflictEnhanced, type ConflictCheckResult } from '@/utils/technicianAvailability';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';
import { removeTimesheetAssignment } from '@/services/removeTimesheetAssignment';
import { syncTimesheetCategoriesForAssignment } from '@/services/syncTimesheetCategories';
import { determineFlexDepartmentsForAssignment } from '@/utils/flexCrewAssignments';
import type { DragSource } from '@/components/matrix/dnd/useMatrixDrag';

export interface PendingMove {
  source: DragSource;
  targetTechnicianId: string;
  targetTechnicianName: string;
  conflict: ConflictCheckResult | null;
}

const removeWholeAssignment = async (jobId: string, technicianId: string): Promise<void> => {
  const { deleted_assignment } = await removeTimesheetAssignment({ jobId, technicianId });
  if (deleted_assignment) return;

  const { error } = await supabase.from('job_assignments')
    .delete()
    .eq('job_id', jobId)
    .eq('technician_id', technicianId);
  if (error) throw error;
};

/**
 * Same-date assignment move. The target is attached before the source is
 * detached so a failed target write can never erase the original assignment.
 * If detaching the source fails, the target is intentionally retained and the
 * user is warned about the possible duplicate rather than losing both copies.
 */
export const useMoveAssignment = () => {
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const requestMove = useCallback(
    async (source: DragSource, targetTechnicianId: string, targetTechnicianName: string) => {
      const conflictResult = await checkTimeConflictEnhanced(targetTechnicianId, source.jobId, {
        targetDateIso: source.dateKey,
        singleDayOnly: true,
        includePending: true,
      });
      const conflict = conflictResult.hasHardConflict || conflictResult.hasSoftConflict ? conflictResult : null;
      setPendingMove({ source, targetTechnicianId, targetTechnicianName, conflict });
    },
    [],
  );

  const cancelMove = useCallback(() => setPendingMove(null), []);

  const commitMove = useCallback(async () => {
    if (!pendingMove) return;
    const { source, targetTechnicianId, targetTechnicianName } = pendingMove;
    const flexDepartments = determineFlexDepartmentsForAssignment(source.roles, source.department);
    let targetRowCreated = false;
    let targetDayAttached = false;
    let detachStarted = false;
    setIsMoving(true);

    try {
      const [{ data: otherDateRows, error: otherDatesError }, { data: existingTargetRow, error: existingTargetError }] = await Promise.all([
        supabase.from('timesheets')
          .select('date')
          .eq('job_id', source.jobId)
          .eq('technician_id', source.technicianId)
          .eq('is_active', true)
          .neq('date', source.dateKey),
        supabase.from('job_assignments')
          .select('job_id, technician_id')
          .eq('job_id', source.jobId)
          .eq('technician_id', targetTechnicianId)
          .maybeSingle(),
      ]);
      if (otherDatesError) throw otherDatesError;
      if (existingTargetError) throw existingTargetError;

      if (!existingTargetRow) {
        const currentUserId = (await supabase.auth.getUser()).data.user?.id;
        const nowIso = new Date().toISOString();
        const { error: insertError } = await supabase.from('job_assignments').insert({
          job_id: source.jobId,
          technician_id: targetTechnicianId,
          ...source.roles,
          assigned_by: currentUserId,
          assigned_at: nowIso,
          status: source.status || 'invited',
          response_time: source.status === 'confirmed' ? nowIso : null,
          single_day: true,
          assignment_date: source.dateKey,
          assignment_source: 'direct',
        });
        if (insertError && insertError.code !== '23505') throw insertError;
        targetRowCreated = !insertError;
      }

      await toggleTimesheetDay({
        jobId: source.jobId,
        technicianId: targetTechnicianId,
        dateIso: source.dateKey,
        present: true,
        source: 'matrix-drag',
      });
      targetDayAttached = true;

      try {
        await syncTimesheetCategoriesForAssignment({
          jobId: source.jobId,
          technicianId: targetTechnicianId,
          soundRole: source.roles.sound_role,
          lightsRole: source.roles.lights_role,
          videoRole: source.roles.video_role,
        });
      } catch (syncError) {
        console.error('Error syncing timesheet category after move:', syncError);
      }

      detachStarted = true;
      const isOnlyDate = (otherDateRows?.length ?? 0) === 0;
      if (isOnlyDate) {
        await removeWholeAssignment(source.jobId, source.technicianId);
      } else {
        await toggleTimesheetDay({
          jobId: source.jobId,
          technicianId: source.technicianId,
          dateIso: source.dateKey,
          present: false,
          source: 'matrix-drag',
        });
      }

      if (flexDepartments.length > 0) {
        await Promise.allSettled(flexDepartments.flatMap((department) => [
          supabase.functions.invoke('manage-flex-crew-assignments', {
            body: { job_id: source.jobId, technician_id: targetTechnicianId, department, action: 'add' },
          }),
          ...(isOnlyDate ? [supabase.functions.invoke('manage-flex-crew-assignments', {
            body: { job_id: source.jobId, technician_id: source.technicianId, department, action: 'remove' },
          })] : []),
        ]));
      }

      toast.success(`Asignación de "${source.jobTitle}" movida a ${targetTechnicianName}`);
      window.dispatchEvent(new CustomEvent('assignment-updated', {
        detail: { technicianId: targetTechnicianId, jobId: source.jobId },
      }));
      setPendingMove(null);
    } catch (error) {
      console.error('Error moving assignment:', error);

      if (!detachStarted) {
        try {
          if (targetRowCreated) {
            await removeWholeAssignment(source.jobId, targetTechnicianId);
          } else if (targetDayAttached) {
            await toggleTimesheetDay({
              jobId: source.jobId,
              technicianId: targetTechnicianId,
              dateIso: source.dateKey,
              present: false,
              source: 'matrix-drag-rollback',
            });
          }
        } catch (rollbackError) {
          console.error('Error rolling back target assignment after failed move:', rollbackError);
        }
      }

      const detail = error instanceof Error ? `: ${error.message}` : '';
      toast.error(
        detachStarted
          ? `No se pudo retirar la asignación original${detail}. Se mantuvo la copia de destino para evitar perderla; revisa ambas celdas.`
          : `No se pudo completar el movimiento${detail}. La asignación original se mantiene.`,
      );
      window.dispatchEvent(new CustomEvent('assignment-updated'));
    } finally {
      setIsMoving(false);
    }
  }, [pendingMove]);

  return { pendingMove, isMoving, requestMove, cancelMove, commitMove };
};
