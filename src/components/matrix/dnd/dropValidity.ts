export type DropValidity =
  | 'valid'
  | 'invalid-no-source'
  | 'invalid-same-technician'
  | 'invalid-different-date'
  | 'invalid-occupied'
  | 'invalid-fridge'
  | 'invalid-unavailable'
  | 'invalid-declined';

export interface DropValidityInput {
  sourceTechnicianId: string;
  sourceDateKey: string;
  targetTechnicianId: string;
  targetDateKey: string;
  targetHasAssignment: boolean;
  targetIsFridge: boolean;
  targetIsUnavailable: boolean;
  targetHasDeclinedJob: boolean;
}

/**
 * v1 scope is deliberately narrow: a drag-move is only valid onto an empty
 * cell on the *same date* as the source (cross-date drags are ambiguous for
 * multi-day jobs and are out of scope). See docs/plans/2026-07-assignment-matrix-lenses-and-dnd.md §6.1.
 */
export function evaluateDropValidity(input: DropValidityInput): DropValidity {
  if (input.targetTechnicianId === input.sourceTechnicianId) return 'invalid-same-technician';
  if (input.targetDateKey !== input.sourceDateKey) return 'invalid-different-date';
  if (input.targetIsFridge) return 'invalid-fridge';
  if (input.targetHasDeclinedJob) return 'invalid-declined';
  if (input.targetIsUnavailable) return 'invalid-unavailable';
  if (input.targetHasAssignment) return 'invalid-occupied';
  return 'valid';
}

export const isValidDrop = (validity: DropValidity): boolean => validity === 'valid';

export const DROP_VALIDITY_MESSAGES: Record<DropValidity, string> = {
  valid: 'Soltar aquí para mover la asignación',
  'invalid-no-source': '',
  'invalid-same-technician': 'Ya es este técnico',
  'invalid-different-date': 'Solo se puede mover dentro de la misma fecha',
  'invalid-occupied': 'Esta celda ya tiene una asignación',
  'invalid-fridge': 'Este técnico está en la nevera',
  'invalid-unavailable': 'Este técnico no está disponible ese día',
  'invalid-declined': 'Este técnico ya rechazó este trabajo',
};
