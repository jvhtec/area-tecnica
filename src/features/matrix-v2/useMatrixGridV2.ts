import React from 'react';
import { toast } from 'sonner';
import { assignmentStatusLabel } from '@/components/matrix/optimized-matrix-cell/helpers';
import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import { formatUserName } from '@/utils/userName';
import { formatMadridDateKey } from '@/utils/timezoneUtils';
import { longDayLabel } from '@/features/matrix-v2/jobDays';
import type { InspectorAvailability, InspectorEnvironment, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';
import { useMatrixKeyboard, type ActiveCell } from '@/features/matrix-v2/keyboard/useMatrixKeyboard';
import type { GridMetrics } from '@/features/matrix-v2/keyboard/navigation';
import { useMatrixShortcutRegistration } from '@/features/matrix-v2/keyboard/useMatrixShortcutRegistration';
import type { MatrixV2ViewConfig } from '@/features/matrix-v2/viewConfig';
import type { MatrixStaffingStatus } from '@/components/matrix/optimized-matrix-cell/types';

interface Options {
  v2: MatrixV2ViewConfig | undefined;
  mobile: boolean;
  technicians: InspectorTechnician[];
  orderedTechnicians: Array<{ id: string }>;
  dates: Date[];
  jobs: MatrixJob[];
  getJobsForDate: (date: Date) => MatrixJob[];
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => InspectorAvailability | undefined;
  declinedJobsByTech: Map<string, Set<string>>;
  fridgeSet?: Set<string>;
  staffingMaps: { byDate: Map<string, MatrixStaffingStatus> } | null | undefined;
  profileNamesMap: Map<string, string>;
  isManagementUser: boolean;
  handleCellClick: (technicianId: string, date: Date, action: 'select-job-for-staffing') => void;
  grid: GridMetrics;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Everything the grid needs to host the Matrix v2 surfaces, built from props it
 * already has: the inspector's environment, the keyboard model (with the keys'
 * actions and their Stream Deck registration) and the click handler that also
 * makes a cell the active one.
 */
export function useMatrixGridV2({
  v2, mobile, technicians, orderedTechnicians, dates, jobs, getJobsForDate, getAssignmentForCell, getAvailabilityForCell,
  declinedJobsByTech, fridgeSet, staffingMaps, profileNamesMap, isManagementUser, handleCellClick, grid, scrollRef,
}: Options) {
  const techniciansById = React.useMemo(() => new Map(technicians.map((t) => [t.id, t])), [technicians]);
  const datesByKey = React.useMemo(() => new Map(dates.map((date) => [formatMadridDateKey(date), date])), [dates]);
  const jobsById = React.useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const inspectorEnv = React.useMemo<InspectorEnvironment | null>(() => {
    if (!v2) return null;
    return {
      runner: v2.runner,
      getTechnician: (technicianId) => techniciansById.get(technicianId),
      getJob: (jobId) => jobsById.get(jobId),
      getJobsForDate,
      getAssignmentForCell,
      getAvailabilityForCell,
      roleSlotsByJob: v2.roleSlotsByJob,
      lastRoleByTechnician: v2.lastRoleByTechnician,
      declinedJobIds: (technicianId) => declinedJobsByTech.get(technicianId),
      isFridge: (technicianId) => fridgeSet?.has(technicianId) ?? false,
      staffingByDate: (technicianId, dateKey) => staffingMaps?.byDate.get(`${technicianId}-${dateKey}`) ?? null,
      profileNames: profileNamesMap,
      canAssign: isManagementUser,
      canMarkUnavailable: isManagementUser,
      openStaffing: (technicianId, date) => handleCellClick(technicianId, date, 'select-job-for-staffing'),
    };
  }, [
    v2, techniciansById, jobsById, getJobsForDate, getAssignmentForCell, getAvailabilityForCell,
    declinedJobsByTech, fridgeSet, staffingMaps, profileNamesMap, isManagementUser, handleCellClick,
  ]);

  const orderedTechnicianIds = React.useMemo(() => orderedTechnicians.map((t) => t.id), [orderedTechnicians]);

  const describeCell = React.useCallback((technicianId: string, dateKey: string) => {
    const technician = techniciansById.get(technicianId);
    const date = datesByKey.get(dateKey);
    const name = technician ? formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico' : 'Técnico';
    const assignment = date ? getAssignmentForCell(technicianId, date) : undefined;
    const unavailable = date ? getAvailabilityForCell(technicianId, date)?.status === 'unavailable' : false;
    const state = assignment
      ? `${assignment.job?.title ?? 'asignación'}, ${assignmentStatusLabel(assignment.status).toLowerCase()}`
      : unavailable ? 'no disponible' : 'libre';
    return `${name}, ${longDayLabel(dateKey)}: ${state}`;
  }, [techniciansById, datesByKey, getAssignmentForCell, getAvailabilityForCell]);

  const keyboardActions = React.useMemo(() => {
    const withDate = (cell: ActiveCell, run: (date: Date) => void) => {
      const date = datesByKey.get(cell.dateKey);
      if (date) run(date);
    };
    const withAssignment = (cell: ActiveCell, run: (date: Date) => void, missing: string) => withDate(cell, (date) => {
      if (getAssignmentForCell(cell.technicianId, date)) run(date);
      else toast.info(missing);
    });
    return {
      open: (cell: ActiveCell) => withDate(cell, (date) => v2?.openInspector(cell.technicianId, date, null)),
      confirm: (cell: ActiveCell) => withAssignment(cell, (date) => v2?.quickConfirm(cell.technicianId, date, 'matrix-keyboard'), 'Esta celda no tiene ninguna asignación que confirmar.'),
      decline: (cell: ActiveCell) => withAssignment(cell, (date) => v2?.openInspector(cell.technicianId, date, null, 'decline'), 'Esta celda no tiene ninguna asignación que rechazar.'),
      remove: (cell: ActiveCell) => withAssignment(cell, (date) => v2?.openInspector(cell.technicianId, date, null, 'remove'), 'Esta celda no tiene ninguna asignación que quitar.'),
      toggleUnavailable: (cell: ActiveCell) => v2?.toggleUnavailable(cell.technicianId, cell.dateKey),
    };
  }, [v2, datesByKey, getAssignmentForCell]);

  const keyboard = useMatrixKeyboard({
    enabled: !!v2 && !mobile,
    technicianIds: orderedTechnicianIds,
    dates,
    grid,
    scrollRef,
    describeCell,
    blocked: !!v2?.inspectorTarget,
    actions: keyboardActions,
  });
  useMatrixShortcutRegistration(!!v2, keyboardActions, keyboard.active);

  const { activate } = keyboard;
  /** A click on a cell opens its inspector and makes it the active cell, so the keys carry on from there. */
  const onInspect = React.useCallback((technicianId: string, date: Date, anchor: HTMLElement) => {
    activate(technicianId, formatMadridDateKey(date));
    v2?.toggleInspector(technicianId, date, anchor);
  }, [activate, v2]);

  return { inspectorEnv, keyboard, onInspect };
}
