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

const roleColumns = (source: DragSource) => ({
  sound_role: source.roleField === 'sound_role' ? source.roleValue : null,
  lights_role: source.roleField === 'lights_role' ? source.roleValue : null,
  video_role: source.roleField === 'video_role' ? source.roleValue : null,
});

/**
 * Same-date assignment move (drag-and-drop v1). Never writes to `timesheets`
 * directly for creation — the assignment cascade (job_assignments ->
 * timesheets) is a documented invariant, so every write here goes through
 * the same RPCs/services AssignJobDialog and the cell removal flow already
 * use. Detach-then-attach is not atomic; a failure between the two steps
 * surfaces loudly rather than silently losing the assignment.
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
    setIsMoving(true);

    try {
      const { data: otherDateRows, error: otherDatesError } = await supabase.from('timesheets')
        .select('date')
        .eq('job_id', source.jobId)
        .eq('technician_id', source.technicianId)
        .eq('is_active', true)
        .neq('date', source.dateKey);
      if (otherDatesError) throw otherDatesError;

      const isOnlyDate = (otherDateRows?.length ?? 0) === 0;
      const flexDepartments = determineFlexDepartmentsForAssignment(roleColumns(source), source.department);

      if (isOnlyDate) {
        const { deleted_assignment } = await removeTimesheetAssignment({
          jobId: source.jobId,
          technicianId: source.technicianId,
        });
        if (!deleted_assignment) {
          const { error } = await supabase.from('job_assignments')
            .delete()
            .eq('job_id', source.jobId)
            .eq('technician_id', source.technicianId);
          if (error) throw error;
        }
        if (flexDepartments.length > 0) {
          await Promise.allSettled(flexDepartments.map((department) =>
            supabase.functions.invoke('manage-flex-crew-assignments', {
              body: { job_id: source.jobId, technician_id: source.technicianId, department, action: 'remove' },
            }),
          ));
        }
      } else {
        const { error } = await supabase.from('timesheets')
          .delete()
          .eq('job_id', source.jobId)
          .eq('technician_id', source.technicianId)
          .eq('date', source.dateKey);
        if (error) throw error;
      }

      const { data: existingTargetRow, error: existingTargetError } = await supabase.from('job_assignments')
        .select('job_id, technician_id')
        .eq('job_id', source.jobId)
        .eq('technician_id', targetTechnicianId)
        .maybeSingle();
      if (existingTargetError) throw existingTargetError;

      if (!existingTargetRow) {
        const currentUserId = (await supabase.auth.getUser()).data.user?.id;
        const nowIso = new Date().toISOString();
        const { error: insertError } = await supabase.from('job_assignments').insert({
          job_id: source.jobId,
          technician_id: targetTechnicianId,
          ...roleColumns(source),
          assigned_by: currentUserId,
          assigned_at: nowIso,
          status: source.status === 'confirmed' ? 'confirmed' : 'invited',
          response_time: source.status === 'confirmed' ? nowIso : null,
          single_day: true,
          assignment_date: source.dateKey,
          assignment_source: 'direct',
        });
        // A concurrent write may have created the row between our check and
        // insert; that's fine, toggleTimesheetDay below still adds the date.
        if (insertError && insertError.code !== '23505') throw insertError;
      }

      await toggleTimesheetDay({
        jobId: source.jobId,
        technicianId: targetTechnicianId,
        dateIso: source.dateKey,
        present: true,
        source: 'matrix-drag',
      });

      try {
        await syncTimesheetCategoriesForAssignment({
          jobId: source.jobId,
          technicianId: targetTechnicianId,
          ...(() => {
            const cols = roleColumns(source);
            return { soundRole: cols.sound_role, lightsRole: cols.lights_role, videoRole: cols.video_role };
          })(),
        });
      } catch (syncError) {
        console.error('Error syncing timesheet category after move:', syncError);
      }

      if (flexDepartments.length > 0) {
        await Promise.allSettled(flexDepartments.map((department) =>
          supabase.functions.invoke('manage-flex-crew-assignments', {
            body: { job_id: source.jobId, technician_id: targetTechnicianId, department, action: 'add' },
          }),
        ));
      }

      toast.success(`Asignación de "${source.jobTitle}" movida a ${targetTechnicianName}`);
      window.dispatchEvent(new CustomEvent('assignment-updated', {
        detail: { technicianId: targetTechnicianId, jobId: source.jobId },
      }));
      setPendingMove(null);
    } catch (error) {
      console.error('Error moving assignment:', error);
      toast.error(
        error instanceof Error
          ? `No se pudo completar el movimiento: ${error.message}`
          : 'No se pudo mover la asignación. Verifica el estado de ambos técnicos.',
      );
    } finally {
      setIsMoving(false);
    }
  }, [pendingMove]);

  return { pendingMove, isMoving, requestMove, cancelMove, commitMove };
};
