import { useCallback, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

import { evaluateDropValidity, type DropValidity } from '@/components/matrix/dnd/dropValidity';

const MADRID_TIMEZONE = 'Europe/Madrid';

export interface DragSource {
  technicianId: string;
  technicianName: string;
  /** Madrid calendar date ('yyyy-MM-dd') of the cell being dragged. */
  dateKey: string;
  jobId: string;
  jobTitle: string;
  roleField: 'sound_role' | 'lights_role' | 'video_role';
  roleValue: string;
  status: string;
  department: string;
}

interface DragTechnician {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
}

interface UseMatrixDragArgs {
  enabled: boolean;
  fridgeSet?: Set<string>;
  declinedJobsByTech: Map<string, Set<string>>;
  getAssignmentForCell: (technicianId: string, date: Date) => any;
  getAvailabilityForCell: (technicianId: string, date: Date) => any;
  onDrop: (source: DragSource, targetTechnicianId: string, targetTechnicianName: string) => void;
}

const roleFieldFor = (assignment: any): DragSource['roleField'] | null => {
  if (assignment?.sound_role && assignment.sound_role !== 'none') return 'sound_role';
  if (assignment?.lights_role && assignment.lights_role !== 'none') return 'lights_role';
  if (assignment?.video_role && assignment.video_role !== 'none') return 'video_role';
  return null;
};

/**
 * Drag state for same-date assignment moves (matrix idea #7, v1 scope). Drag
 * source and drop-target validity both live here so OptimizedMatrixCell can
 * stay a thin, memoized presentational component — this hook is the only
 * thing that decides what's draggable and what's a valid drop target.
 */
export const useMatrixDrag = ({
  enabled,
  fridgeSet,
  declinedJobsByTech,
  getAssignmentForCell,
  getAvailabilityForCell,
  onDrop,
}: UseMatrixDragArgs) => {
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; validity: DropValidity } | null>(null);

  const beginDrag = useCallback((technician: DragTechnician, date: Date, assignment: any) => {
    if (!enabled || !assignment?.job_id) return;
    const roleField = roleFieldFor(assignment);
    if (!roleField) return;

    setDragSource({
      technicianId: technician.id,
      technicianName: `${technician.first_name} ${technician.last_name}`.trim(),
      dateKey: formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd'),
      jobId: assignment.job_id,
      jobTitle: assignment.job?.title || 'Trabajo',
      roleField,
      roleValue: assignment[roleField],
      status: assignment.status || 'invited',
      department: technician.department,
    });
  }, [enabled]);

  const evaluateTarget = useCallback((technicianId: string, date: Date): DropValidity => {
    if (!dragSource) return 'invalid-no-source';
    const dateKey = formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd');
    const existingAssignment = getAssignmentForCell(technicianId, date);
    const availability = getAvailabilityForCell(technicianId, date);
    return evaluateDropValidity({
      sourceTechnicianId: dragSource.technicianId,
      sourceDateKey: dragSource.dateKey,
      targetTechnicianId: technicianId,
      targetDateKey: dateKey,
      targetHasAssignment: !!existingAssignment,
      targetIsFridge: !!fridgeSet?.has(technicianId),
      targetIsUnavailable: availability?.status === 'unavailable',
      targetHasDeclinedJob: !!declinedJobsByTech.get(technicianId)?.has(dragSource.jobId),
    });
  }, [dragSource, getAssignmentForCell, getAvailabilityForCell, fridgeSet, declinedJobsByTech]);

  const dragOverCell = useCallback((technicianId: string, date: Date) => {
    if (!dragSource) return;
    const dateKey = formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd');
    const key = `${technicianId}-${dateKey}`;
    const validity = evaluateTarget(technicianId, date);
    setDropTarget((prev) => (prev?.key === key && prev.validity === validity ? prev : { key, validity }));
  }, [dragSource, evaluateTarget]);

  const clearDragOver = useCallback(() => setDropTarget(null), []);

  const endDrag = useCallback(() => {
    setDragSource(null);
    setDropTarget(null);
  }, []);

  const dropOnCell = useCallback((technician: DragTechnician, date: Date) => {
    if (!dragSource) return;
    const validity = evaluateTarget(technician.id, date);
    if (validity === 'valid') {
      onDrop(dragSource, technician.id, `${technician.first_name} ${technician.last_name}`.trim());
    }
    endDrag();
  }, [dragSource, evaluateTarget, onDrop, endDrag]);

  return { dragSource, dropTarget, beginDrag, dragOverCell, clearDragOver, dropOnCell, endDrag };
};
