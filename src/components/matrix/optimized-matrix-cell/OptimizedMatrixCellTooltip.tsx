import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

import { labelForCode } from '@/utils/roles';
import type { MatrixStaffingStatus } from '@/components/matrix/optimized-matrix-cell/types';
import {
  assignmentStatusLabel,
  availabilityStatusLabel,
  formatDateTimeEs,
  offerStatusLabel,
} from '@/components/matrix/optimized-matrix-cell/helpers';

type OptimizedMatrixCellTooltipProps = {
  displayName: string;
  technician: {
    department: string;
  };
  hasAssignment: boolean;
  assignment: any;
  isUnavailable: boolean;
  availability: any;
  staffingStatusByDate: MatrixStaffingStatus | null;
  profileNamesMap: Map<string, string>;
};

const uniqueLabels = (values?: Array<string | null | undefined>): string[] => {
  if (!values?.length) return [];
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
};

const formatJobLabel = (labels: string[]): string | null => {
  if (labels.length === 0) return null;
  return `${labels.length > 1 ? 'Trabajos' : 'Trabajo'}: ${labels.join(', ')}`;
};

export const OptimizedMatrixCellTooltip = ({
  displayName,
  technician,
  hasAssignment,
  assignment,
  isUnavailable,
  availability,
  staffingStatusByDate,
  profileNamesMap,
}: OptimizedMatrixCellTooltipProps) => {
  const availabilityJobLabel = formatJobLabel(
    uniqueLabels(
      staffingStatusByDate?.pending_availability_job_titles?.length
        ? staffingStatusByDate.pending_availability_job_titles
        : [staffingStatusByDate?.availability_job_title],
    ),
  );
  const offerJobLabel = formatJobLabel(
    uniqueLabels(
      staffingStatusByDate?.pending_offer_job_titles?.length
        ? staffingStatusByDate.pending_offer_job_titles
        : [staffingStatusByDate?.offer_job_title],
    ),
  );
  const availabilityActorLabel =
    staffingStatusByDate?.availability_actor_label ||
    (staffingStatusByDate?.availability_requested_by && profileNamesMap.has(staffingStatusByDate.availability_requested_by)
      ? profileNamesMap.get(staffingStatusByDate.availability_requested_by)
      : null);
  const offerActorLabel =
    staffingStatusByDate?.offer_actor_label ||
    (staffingStatusByDate?.offer_requested_by && profileNamesMap.has(staffingStatusByDate.offer_requested_by)
      ? profileNamesMap.get(staffingStatusByDate.offer_requested_by)
      : null);

  return (
    <div className="space-y-1 text-sm">
      <div className="font-semibold">
        {displayName}
      </div>
      <div className="text-muted-foreground">
        {technician.department}
      </div>
      {hasAssignment && (
        <div className="text-xs">
          <div>{assignment.job?.title}</div>
          <div className="text-muted-foreground">
            {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
          </div>
          {assignment.single_day && assignment.assignment_date && (
            <div className="text-muted-foreground">
              Día único: {formatInTimeZone(new Date(`${assignment.assignment_date}T00:00:00`), 'Europe/Madrid', 'MMM d', { locale: es })}
            </div>
          )}
          <div className={`capitalize ${assignment.status === 'confirmed' ? 'text-green-600' : assignment.status === 'declined' ? 'text-red-600' : 'text-yellow-600'}`}>
            Estado: {assignmentStatusLabel(assignment.status)}
          </div>
          {assignment.assigned_by && profileNamesMap.has(assignment.assigned_by) && (
            <div className="text-muted-foreground">
              Asignado por: {profileNamesMap.get(assignment.assigned_by)}
            </div>
          )}
          {assignment.assigned_at && formatDateTimeEs(assignment.assigned_at) && (
            <div className="text-muted-foreground">
              Fecha: {formatDateTimeEs(assignment.assigned_at)}
            </div>
          )}
        </div>
      )}
      {!hasAssignment && !isUnavailable && staffingStatusByDate && (
        <div className="text-xs space-y-2 pt-1">
          {availabilityStatusLabel(staffingStatusByDate.availability_status) && (
            <div>
              <div className="text-yellow-700">
                Disponibilidad: {availabilityStatusLabel(staffingStatusByDate.availability_status)}
              </div>
              {availabilityJobLabel && (
                <div className="text-muted-foreground">
                  {availabilityJobLabel}
                </div>
              )}
              {availabilityActorLabel && (
                <div className="text-muted-foreground">
                  Enviado por: {availabilityActorLabel}
                </div>
              )}
              {staffingStatusByDate.availability_created_at && formatDateTimeEs(staffingStatusByDate.availability_created_at) && (
                <div className="text-muted-foreground">
                  Fecha: {formatDateTimeEs(staffingStatusByDate.availability_created_at)}
                </div>
              )}
            </div>
          )}
          {offerStatusLabel(staffingStatusByDate.offer_status) && (
            <div>
              <div className="text-blue-700">
                Oferta: {offerStatusLabel(staffingStatusByDate.offer_status)}
              </div>
              {offerJobLabel && (
                <div className="text-muted-foreground">
                  {offerJobLabel}
                </div>
              )}
              {offerActorLabel && (
                <div className="text-muted-foreground">
                  Enviado por: {offerActorLabel}
                </div>
              )}
              {staffingStatusByDate.offer_created_at && formatDateTimeEs(staffingStatusByDate.offer_created_at) && (
                <div className="text-muted-foreground">
                  Fecha: {formatDateTimeEs(staffingStatusByDate.offer_created_at)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {isUnavailable && !hasAssignment && (
        <div className="text-xs text-muted-foreground">
          No disponible{availability.notes ? `: ${availability.notes}` : ''}
        </div>
      )}
    </div>
  );
};
