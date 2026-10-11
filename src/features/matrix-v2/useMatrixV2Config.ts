import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import { formatMadridDateKey, madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';
import { formatUserName } from '@/utils/userName';
import { isFocusableJob, NOT_FOCUSABLE_MESSAGE } from '@/features/matrix-v2/focus/focusableJob';
import { useMatrixJobFocus } from '@/features/matrix-v2/focus/useMatrixJobFocus';
import type { FocusStatus } from '@/features/matrix-v2/focus/useJobFocusSelection';
import { findMatrixCellElement } from '@/features/matrix-v2/inspector/anchor';
import type { InspectorTarget } from '@/features/matrix-v2/inspector/environment';
import { runQuickConfirm, runToggleUnavailable } from '@/features/matrix-v2/quickActions';
import type { RoleSlot, RoleSlotAssignmentRow } from '@/features/matrix-v2/roleSlots';
import type { MatrixCommandSource, MatrixTechnicianRef } from '@/features/matrix-v2/types';
import { useMatrixCommandRunner } from '@/features/matrix-v2/useMatrixCommandRunner';
import type { MatrixV2ViewConfig } from '@/features/matrix-v2/viewConfig';

type Technician = MatrixTechnicianRef & { id: string };

interface Options {
  /** False while the grid has no data to judge fit from. */
  ready: boolean;
  jobs: MatrixJob[];
  technicians: Technician[];
  dates: Date[];
  baseOrderedTechnicians: Technician[];
  allAssignments: MatrixTimesheetAssignment[] | undefined;
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => { status?: string | null } | undefined;
  isManagementUser: boolean;
  roleSlotsByJob: Map<string, RoleSlot[]>;
  /** Membership from the same authoritative summary that supplies roleSlotsByJob. */
  staffingAssignments?: readonly RoleSlotAssignmentRow[];
  declinedJobsByTech: Map<string, Set<string>>;
  fridgeSet?: Set<string>;
  focusJobId: string | null;
  focusStatus: FocusStatus;
  onFocusJobChange?: (jobId: string | null) => void;
}

/**
 * Everything Matrix v2 adds to the grid container: the command runner, the
 * inspector and quick actions, and job focus (with the row order it freezes).
 * Returns the view config the grid renders from.
 */
export function useMatrixV2Config<T extends Technician>({
  ready, jobs, technicians, dates, baseOrderedTechnicians, allAssignments, getAssignmentForCell,
  getAvailabilityForCell, isManagementUser, roleSlotsByJob, staffingAssignments, declinedJobsByTech, fridgeSet, focusJobId, focusStatus, onFocusJobChange,
}: Options & { baseOrderedTechnicians: T[] }) {
  // The one entry point for changing an assignment, and the role each
  // technician held last (so a quick assignment can start from it).
  const runner = useMatrixCommandRunner({ jobs, technicians });
  const lastRoleByTechnician = useMemo(() => {
    const latest = new Map<string, { date: string; role: string }>();
    for (const row of allAssignments ?? []) {
      if (!row?.technician_id || row.status === 'declined') continue;
      const role = row.sound_role || row.lights_role || row.video_role;
      if (!role) continue;
      const seen = latest.get(row.technician_id);
      if (!seen || row.date > seen.date) latest.set(row.technician_id, { date: row.date, role });
    }
    return new Map([...latest].map(([technicianId, { role }]) => [technicianId, role]));
  }, [allAssignments]);

  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null);
  // Each open creates a new object, including reopening the same cell. Async
  // completion owns that exact generation; it must not close a later inspector.
  const closeInspector = useCallback(() => {
    setInspectorTarget((current) => (current === inspectorTarget ? null : current));
  }, [inspectorTarget]);
  const openInspector = useCallback((technicianId: string, date: Date, anchor: HTMLElement | null, intent?: InspectorTarget['intent'], staffingDraft?: InspectorTarget['staffingDraft']) => {
    const dateKey = formatMadridDateKey(date);
    setInspectorTarget({ technicianId, date, dateKey, anchor: anchor ?? findMatrixCellElement(technicianId, dateKey), intent, staffingDraft });
  }, []);
  const toggleInspector = useCallback((technicianId: string, date: Date, anchor: HTMLElement | null) => {
    const dateKey = formatMadridDateKey(date);
    // A second click on the same cell closes its inspector.
    setInspectorTarget((current) => (
      current && current.technicianId === technicianId && current.dateKey === dateKey
        ? null
        : { technicianId, date, dateKey, anchor: anchor ?? findMatrixCellElement(technicianId, dateKey) }
    ));
  }, []);
  const quickConfirm = useCallback((technicianId: string, date: Date, source: MatrixCommandSource = 'matrix-inspector') => {
    const assignment = getAssignmentForCell(technicianId, date);
    if (!assignment) return;
    const technician = technicians.find((candidate) => candidate.id === technicianId);
    const name = technician ? formatUserName(technician.first_name ?? '', technician.nickname ?? null, technician.last_name ?? '') || 'Técnico' : 'Técnico';
    void runQuickConfirm(runner, { technicianId, jobId: assignment.job_id, name, jobTitle: assignment.job?.title, source });
  }, [getAssignmentForCell, technicians, runner]);
  const toggleUnavailable = useCallback((technicianId: string, dateKey: string) => {
    const date = madridDateKeyToCalendarDate(dateKey);
    const unavailable = date ? getAvailabilityForCell(technicianId, date)?.status === 'unavailable' : false;
    void runToggleUnavailable({ technicianId, dateKey, unavailable, canEdit: isManagementUser });
  }, [getAvailabilityForCell, isManagementUser]);

  const staffingMembership = useMemo(() => {
    const membership = new Set<string>();
    for (const row of staffingAssignments ?? []) {
      if (!row.job_id || !row.technician_id || row.status?.toLowerCase() === 'declined') continue;
      for (const role of [row.sound_role, row.lights_role, row.video_role, row.production_role]) {
        if (role?.trim() && role.trim().toLowerCase() !== 'none') {
          membership.add(JSON.stringify([row.job_id, row.technician_id, role.trim()]));
        }
      }
    }
    return membership;
  }, [staffingAssignments]);
  const hasStaffingAssignment = useCallback((jobId: string, technicianId: string, role: string) =>
    staffingMembership.has(JSON.stringify([jobId, technicianId, role])), [staffingMembership]);

  const { focus, applyOrder } = useMatrixJobFocus({
    focusJobId,
    status: focusStatus,
    ready,
    jobs,
    technicians,
    dates,
    runner,
    getAssignmentForCell,
    getAvailabilityForCell,
    declinedJobsByTech,
    fridgeSet,
    roleSlotsByJob,
    hasStaffingAssignment,
    lastRoleByTechnician,
    openInspector,
  });
  const orderedTechnicians = useMemo(() => applyOrder(baseOrderedTechnicians), [applyOrder, baseOrderedTechnicians]);

  const setFocusJob = useCallback((jobId: string | null) => {
    if (jobId) {
      const job = jobs.find((candidate) => candidate.id === jobId);
      if (!job || !isFocusableJob(job)) {
        toast.info(NOT_FOCUSABLE_MESSAGE);
        return;
      }
    }
    onFocusJobChange?.(jobId);
  }, [jobs, onFocusJobChange]);
  const toggleFocusJob = useCallback((jobId: string) => setFocusJob(focusJobId === jobId ? null : jobId), [setFocusJob, focusJobId]);

  const v2Config = useMemo<MatrixV2ViewConfig>(
    () => ({
      runner, roleSlotsByJob, lastRoleByTechnician, inspectorTarget, toggleInspector, openInspector, closeInspector,
      quickConfirm, toggleUnavailable, focus, setFocusJob, toggleFocusJob,
    }),
    [runner, roleSlotsByJob, lastRoleByTechnician, inspectorTarget, toggleInspector, openInspector, closeInspector,
      quickConfirm, toggleUnavailable, focus, setFocusJob, toggleFocusJob],
  );

  return { v2Config, orderedTechnicians };
}
