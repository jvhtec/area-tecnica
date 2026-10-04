import { normalizeStatus } from '@/components/matrix/optimized-matrix-cell/helpers';
import { formatUserName } from '@/utils/userName';
import { longDayLabel } from '@/features/matrix-v2/jobDays';
import type { InspectorEnvironment, InspectorTarget } from '@/features/matrix-v2/inspector/environment';
import type { InspectorView } from '@/features/matrix-v2/inspector/useCellInspectorModel';
import type { PillTone } from '@/features/matrix-v2/inspector/parts';

export interface InspectorSummary {
  view: InspectorView;
  name: string;
  dateLabel: string;
  pill: { tone: PillTone; label: string };
}

/** What the header of either host shows; cheap enough to compute in both places. */
export function useInspectorSummary(env: InspectorEnvironment, target: InspectorTarget): InspectorSummary {
  const technician = env.getTechnician(target.technicianId);
  const assignment = env.getAssignmentForCell(target.technicianId, target.date);
  const availability = env.getAvailabilityForCell(target.technicianId, target.date);
  const name = technician ? formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico' : 'Técnico';
  const dateLabel = longDayLabel(target.dateKey);
  if (assignment) {
    const status = normalizeStatus(assignment.status);
    if (status === 'confirmed') return { view: 'assignment', name, dateLabel, pill: { tone: 'confirmed', label: 'Confirmado' } };
    if (status === 'declined') return { view: 'assignment', name, dateLabel, pill: { tone: 'declined', label: 'Rechazado' } };
    return { view: 'assignment', name, dateLabel, pill: { tone: 'invited', label: 'Invitado · sin respuesta' } };
  }
  if (availability?.status === 'unavailable') {
    return { view: 'unavailable', name, dateLabel, pill: { tone: 'unavailable', label: 'No disponible' } };
  }
  if (env.isFridge(target.technicianId)) return { view: 'empty', name, dateLabel, pill: { tone: 'free', label: 'En la nevera' } };
  return { view: 'empty', name, dateLabel, pill: { tone: 'free', label: 'Libre' } };
}
