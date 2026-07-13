import { useCallback, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';

import { MATRIX_ASSIGNMENT_DRAG_MIME } from '@/components/matrix/dnd/constants';
import { evaluateDropValidity, DROP_VALIDITY_MESSAGES, type DropValidity } from '@/components/matrix/dnd/dropValidity';

const MADRID_TIMEZONE = 'Europe/Madrid';

export interface AssignmentRoleColumns {
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
}

export interface DragSource {
  technicianId: string;
  technicianName: string;
  /** Madrid calendar date ('yyyy-MM-dd') of the cell being dragged. */
  dateKey: string;
  jobId: string;
  jobTitle: string;
  roles: AssignmentRoleColumns;
  status: string;
  department: string;
}

export interface DragTechnician {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
}

export interface MatrixDragAssignment extends Partial<AssignmentRoleColumns> {
  job_id: string;
  status?: string | null;
  job?: { title?: string | null } | null;
}

interface MatrixDragAvailability {
  status?: string | null;
}

interface UseMatrixDragArgs {
  enabled: boolean;
  /** Switches from native-drag semantics to tap-to-pick-up/tap-to-drop, since HTML5 drag doesn't work on touch. */
  mobile?: boolean;
  fridgeSet?: Set<string>;
  declinedJobsByTech: Map<string, Set<string>>;
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixDragAssignment | null | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => MatrixDragAvailability | null | undefined;
  onDrop: (source: DragSource, targetTechnicianId: string, targetTechnicianName: string) => void;
}

const normalizedRole = (value: string | null | undefined): string | null => {
  if (!value || value.trim().toLowerCase() === 'none') return null;
  return value;
};

const rolesFor = (assignment: MatrixDragAssignment): AssignmentRoleColumns => ({
  sound_role: normalizedRole(assignment.sound_role),
  lights_role: normalizedRole(assignment.lights_role),
  video_role: normalizedRole(assignment.video_role),
  production_role: normalizedRole(assignment.production_role),
});

const hasAssignedRole = (roles: AssignmentRoleColumns): boolean => Object.values(roles).some(Boolean);

export const parseDragSource = (value: string): DragSource | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DragSource>;
    if (
      typeof parsed.technicianId !== 'string'
      || typeof parsed.technicianName !== 'string'
      || typeof parsed.dateKey !== 'string'
      || typeof parsed.jobId !== 'string'
      || typeof parsed.jobTitle !== 'string'
      || typeof parsed.status !== 'string'
      || typeof parsed.department !== 'string'
      || !parsed.roles
    ) {
      return null;
    }
    return parsed as DragSource;
  } catch {
    return null;
  }
};

/** State and validity for assignment relocation in the matrix. */
export const useMatrixDrag = ({
  enabled,
  mobile = false,
  fridgeSet,
  declinedJobsByTech,
  getAssignmentForCell,
  getAvailabilityForCell,
  onDrop,
}: UseMatrixDragArgs) => {
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; validity: DropValidity } | null>(null);

  const beginDrag = useCallback((
    technician: DragTechnician,
    date: Date,
    assignment: MatrixDragAssignment,
    dataTransfer?: DataTransfer,
  ) => {
    if (!enabled || !assignment?.job_id) return;
    const roles = rolesFor(assignment);
    if (!hasAssignedRole(roles)) return;

    const source: DragSource = {
      technicianId: technician.id,
      technicianName: `${technician.first_name} ${technician.last_name}`.trim(),
      dateKey: formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd'),
      jobId: assignment.job_id,
      jobTitle: assignment.job?.title || 'Trabajo',
      roles,
      status: assignment.status || 'invited',
      department: technician.department,
    };

    setDragSource(source);
    if (dataTransfer) {
      dataTransfer.effectAllowed = 'move';
      dataTransfer.setData(MATRIX_ASSIGNMENT_DRAG_MIME, JSON.stringify(source));
      dataTransfer.setData('text/plain', source.jobTitle);
    }

    if (mobile) {
      toast.message('Asignación seleccionada', {
        description: 'Toca una celda vacía en la misma fecha para moverla, o toca de nuevo esta celda para cancelar.',
      });
    }
  }, [enabled, mobile]);

  const evaluateTarget = useCallback((
    technicianId: string,
    date: Date,
    source: DragSource | null = dragSource,
  ): DropValidity => {
    if (!source) return 'invalid-no-source';
    const dateKey = formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd');
    const existingAssignment = getAssignmentForCell(technicianId, date);
    const availability = getAvailabilityForCell(technicianId, date);
    return evaluateDropValidity({
      sourceTechnicianId: source.technicianId,
      sourceDateKey: source.dateKey,
      targetTechnicianId: technicianId,
      targetDateKey: dateKey,
      targetHasAssignment: !!existingAssignment,
      targetIsFridge: !!fridgeSet?.has(technicianId),
      targetIsUnavailable: availability?.status === 'unavailable',
      targetHasDeclinedJob: !!declinedJobsByTech.get(technicianId)?.has(source.jobId),
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

  const dropOnCell = useCallback((technician: DragTechnician, date: Date, serializedSource?: string) => {
    const source = parseDragSource(serializedSource || '') ?? dragSource;
    if (!source) return;
    const validity = evaluateTarget(technician.id, date, source);
    const isSourceCellTappedAgain = technician.id === source.technicianId;

    if (validity === 'valid') {
      onDrop(source, technician.id, `${technician.first_name} ${technician.last_name}`.trim());
    } else if (mobile && !isSourceCellTappedAgain) {
      toast.error(DROP_VALIDITY_MESSAGES[validity] || 'No se puede mover aquí');
    }
    endDrag();
  }, [dragSource, evaluateTarget, onDrop, endDrag, mobile]);

  return { dragSource, dropTarget, beginDrag, dragOverCell, evaluateTarget, clearDragOver, dropOnCell, endDrag };
};
