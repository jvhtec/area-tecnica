import React from 'react';
import { toast } from 'sonner';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { computeFocusFit, sortIdsByFit, type FocusFit } from '@/features/matrix-v2/focus/fit';
import { planFocusAssign, runFocusAssign } from '@/features/matrix-v2/focus/focusAssign';
import type { FocusStatus } from '@/features/matrix-v2/focus/useJobFocusSelection';
import { jobDayKeys } from '@/features/matrix-v2/jobDays';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import type { MatrixTechnicianRef } from '@/features/matrix-v2/types';
import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import { formatUserName } from '@/utils/userName';
import { formatMadridDateKey } from '@/utils/timezoneUtils';

/** What the grid needs to draw and drive job focus. */
export interface MatrixJobFocus {
  job: MatrixJob;
  /** The job's days that are on the grid. */
  visibleJobDayKeys: string[];
  status: FocusStatus;
  fits: Map<string, FocusFit>;
  /** A click on a cell: assigns that day, or opens the inspector when it cannot. Returns whether it handled the click. */
  onCellClick: (technicianId: string, date: Date, anchor: HTMLElement | null) => boolean;
  /** A click on a technician's name: assigns every free day of the job. */
  onNameClick: (technicianId: string) => void;
}

interface Options {
  focusJobId: string | null;
  status: FocusStatus;
  /** False while the grid has no data to judge fit from. */
  ready: boolean;
  jobs: MatrixJob[];
  technicians: MatrixTechnicianRef[];
  dates: Date[];
  runner: MatrixCommandRunner;
  getAssignmentForCell: (technicianId: string, date: Date) => MatrixTimesheetAssignment | undefined;
  getAvailabilityForCell: (technicianId: string, date: Date) => { status?: string | null } | undefined;
  declinedJobsByTech: Map<string, Set<string>>;
  fridgeSet?: Set<string>;
  roleSlotsByJob: Map<string, RoleSlot[]>;
  lastRoleByTechnician: Map<string, string>;
  openInspector: (technicianId: string, date: Date, anchor: HTMLElement | null) => void;
}

const nameOf = (technician: MatrixTechnicianRef | undefined) =>
  (technician ? formatUserName(technician.first_name ?? '', technician.nickname ?? null, technician.last_name ?? '') : '') || 'Técnico';

const roleHeld = (assignment: MatrixTimesheetAssignment | undefined): string | null =>
  assignment?.sound_role || assignment?.lights_role || assignment?.video_role || null;

/**
 * Job focus: the grid is judged against one job. Fit is recomputed as the grid's
 * data changes, but the order of the rows is fixed when the job is entered, so a
 * row never moves under the cursor while a crew is being built.
 */
export function useMatrixJobFocus(options: Options) {
  const {
    focusJobId, status, ready, jobs, technicians, dates, runner, getAssignmentForCell, getAvailabilityForCell,
    declinedJobsByTech, fridgeSet, roleSlotsByJob, lastRoleByTechnician, openInspector,
  } = options;

  const job = React.useMemo(() => (focusJobId ? jobs.find((candidate) => candidate.id === focusJobId) ?? null : null), [jobs, focusJobId]);
  const allJobDays = React.useMemo(() => (job ? jobDayKeys(job) : []), [job]);
  const datesByKey = React.useMemo(() => new Map(dates.map((date) => [formatMadridDateKey(date), date])), [dates]);
  const visibleJobDayKeys = React.useMemo(() => allJobDays.filter((key) => datesByKey.has(key)), [allJobDays, datesByKey]);
  const techniciansById = React.useMemo(() => new Map(technicians.map((technician) => [technician.id, technician])), [technicians]);

  const fits = React.useMemo(() => {
    const result = new Map<string, FocusFit>();
    if (!job) return result;
    for (const technician of technicians) {
      result.set(technician.id, computeFocusFit({
        jobId: job.id,
        jobDayKeys: visibleJobDayKeys,
        assignmentOn: (dateKey) => {
          const date = datesByKey.get(dateKey);
          return date ? getAssignmentForCell(technician.id, date) : undefined;
        },
        isUnavailable: (dateKey) => {
          const date = datesByKey.get(dateKey);
          return date ? getAvailabilityForCell(technician.id, date)?.status === 'unavailable' : false;
        },
        declined: declinedJobsByTech.get(technician.id)?.has(job.id) ?? false,
        fridge: fridgeSet?.has(technician.id) ?? false,
      }));
    }
    return result;
  }, [job, technicians, visibleJobDayKeys, datesByKey, getAssignmentForCell, getAvailabilityForCell, declinedJobsByTech, fridgeSet]);

  // Sorted once per entry, as soon as the grid has the data to judge by.
  const [frozen, setFrozen] = React.useState<{ jobId: string; order: string[] } | null>(null);
  const fitsRef = React.useRef(fits);
  fitsRef.current = fits;
  const idsRef = React.useRef<string[]>([]);
  idsRef.current = technicians.map((technician) => technician.id);
  React.useEffect(() => {
    if (!job) {
      setFrozen(null);
      return;
    }
    if (ready && frozen?.jobId !== job.id) setFrozen({ jobId: job.id, order: sortIdsByFit(idsRef.current, fitsRef.current) });
  }, [job, ready, frozen?.jobId]);
  const order = job && frozen?.jobId === job.id ? frozen.order : null;

  const jobTitle = job?.title ?? '';
  const assignDays = React.useCallback((technicianId: string, days: string[], anchor: HTMLElement | null, anchorDate: Date | null) => {
    if (!job) return;
    const technician = techniciansById.get(technicianId);
    if (!technician) return;
    // Someone already on the job keeps the role they hold there.
    const existingDate = visibleJobDayKeys.map((key) => datesByKey.get(key)).find((date) => date && getAssignmentForCell(technicianId, date)?.job_id === job.id);
    const plan = planFocusAssign({
      technician,
      jobId: job.id,
      days,
      jobDays: allJobDays,
      status,
      slots: roleSlotsByJob.get(job.id),
      lastRoleCode: lastRoleByTechnician.get(technicianId) ?? null,
      existingRole: roleHeld(existingDate ? getAssignmentForCell(technicianId, existingDate) : undefined),
    });
    const target = anchorDate ?? datesByKey.get(days[0] ?? visibleJobDayKeys[0] ?? '') ?? null;
    const inspect = () => { if (target) openInspector(technicianId, target, anchor); };
    if (plan.kind === 'inspect') {
      if (plan.reason === 'role') toast.info('Elige el rol de esta persona: puede encajar en varios niveles.');
      inspect();
      return;
    }
    void runFocusAssign(runner, plan, { name: nameOf(technician), jobTitle, openInspector: inspect });
  }, [job, techniciansById, datesByKey, getAssignmentForCell, visibleJobDayKeys, allJobDays, status, roleSlotsByJob, lastRoleByTechnician, openInspector, runner, jobTitle]);

  const onCellClick = React.useCallback((technicianId: string, date: Date, anchor: HTMLElement | null) => {
    if (!job) return false;
    const dateKey = formatMadridDateKey(date);
    // Days outside the job, and cells that already hold something, are managed in the inspector.
    if (!visibleJobDayKeys.includes(dateKey)) return false;
    const fit = fits.get(technicianId);
    if (!fit || !fit.freeDays.includes(dateKey)) return false;
    if (fit.kind === 'fridge' || fit.kind === 'declined') return false;
    assignDays(technicianId, [dateKey], anchor, date);
    return true;
  }, [job, visibleJobDayKeys, fits, assignDays]);

  const onNameClick = React.useCallback((technicianId: string) => {
    const fit = fits.get(technicianId);
    if (!fit) return;
    if (!fit.assignable) {
      toast.info(`${nameOf(techniciansById.get(technicianId))}: ${fit.label.toLowerCase()}. Haz clic en una celda para ver los detalles.`);
      return;
    }
    assignDays(technicianId, fit.freeDays, null, null);
  }, [fits, assignDays, techniciansById]);

  const focus = React.useMemo<MatrixJobFocus | null>(
    () => (job ? { job, visibleJobDayKeys, status, fits, onCellClick, onNameClick } : null),
    [job, visibleJobDayKeys, status, fits, onCellClick, onNameClick],
  );

  /** The technicians in the order frozen at entry; anyone who appeared since goes last. */
  const applyOrder = React.useCallback(<T extends { id: string }>(base: T[]): T[] => {
    if (!order) return base;
    const position = new Map(order.map((id, index) => [id, index]));
    return [...base].sort((a, b) => (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [order]);

  return { focus, applyOrder };
}
