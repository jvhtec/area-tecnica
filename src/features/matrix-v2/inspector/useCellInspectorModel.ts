import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE,
  assignmentCommandStateKey,
  getAssignmentCommandState,
  type AssignmentConflictDetails,
} from '@/features/assignments/commands';
import { roleOptionsForDiscipline, type RoleOption } from '@/types/roles';
import { labelForCode } from '@/utils/roles';
import { formatUserName } from '@/utils/userName';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';
import { coverageForDays, dayRangeLabel, jobDayKeys, longDayLabel } from '@/features/matrix-v2/jobDays';
import { slotsForDepartment, type RoleSlot } from '@/features/matrix-v2/roleSlots';
import { suggestRole, type RoleSuggestion } from '@/features/matrix-v2/roleSuggestion';
import {
  roleDepartmentForCode,
  roleDisciplineForDepartment,
  type MatrixIntent,
  type MatrixRunOutcome,
} from '@/features/matrix-v2/types';
import { clearUnavailable, markUnavailable } from '@/features/matrix-v2/unavailability';
import { showUndoToast } from '@/features/matrix-v2/undoToast';
import type { InspectorEnvironment, InspectorTarget, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';

const STATE_STALE_MS = 10_000;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export type InspectorView = 'empty' | 'assignment' | 'unavailable';

export interface JobOption {
  job: MatrixJob;
  declined: boolean;
  /** Roles the job still needs in this technician's discipline, e.g. "MON·E". */
  open: RoleSlot[];
}

export interface InspectorConflict {
  details: AssignmentConflictDetails;
  /** What was being attempted, so an override keeps it (confirmed stays confirmed). */
  status: 'invited' | 'confirmed';
  /** Days of the attempt that clash. */
  conflictDays: string[];
  freeDays: string[];
}

const useTechnicianName = (technician: InspectorTechnician | undefined) =>
  technician ? formatUserName(technician.first_name, technician.nickname, technician.last_name) || 'Técnico' : 'Técnico';

const effectsNote = (outcome: Extract<MatrixRunOutcome, { ok: true }>) =>
  outcome.result.side_effects.length > 0 ? 'Se avisará en unos segundos: puedes deshacerlo.' : undefined;

/** The command's pair state, shared with the runner through the same query key. */
function usePairState(jobId: string, technicianId: string, enabled: boolean) {
  return useQuery({
    queryKey: assignmentCommandStateKey(jobId, technicianId),
    enabled: enabled && !!jobId && !!technicianId,
    queryFn: () => getAssignmentCommandState(jobId, technicianId),
    staleTime: STATE_STALE_MS,
  });
}

/** Tells the manager how a finished command went, with Deshacer when it can be taken back. */
function reportDone(title: string, outcome: Extract<MatrixRunOutcome, { ok: true }>, description: string | undefined) {
  if (outcome.noop) {
    toast.info('Ya estaba así: no había nada que cambiar');
    return;
  }
  if (outcome.result.warnings.length > 0) {
    toast.error('Se guardó, pero no se pudo recalcular el importe de algún parte');
  }
  if (outcome.undo) {
    showUndoToast({ title, description: [description, effectsNote(outcome)].filter(Boolean).join(' · ') || undefined, undo: outcome.undo });
  } else {
    toast.success(title, { description });
  }
}

/* ------------------------------------------------------------------------- */
/* Assign / move form                                                         */
/* ------------------------------------------------------------------------- */

interface AssignFormOptions {
  env: InspectorEnvironment;
  technician: InspectorTechnician | undefined;
  target: InspectorTarget;
  /** Moving: the job the technician leaves, and the role to keep. */
  move?: { fromJobId: string; role: string | null; status: 'invited' | 'confirmed' } | null;
  onDone: () => void;
}

export function useAssignForm({ env, technician, target, move = null, onDone }: AssignFormOptions) {
  const { technicianId, date, dateKey } = target;
  const discipline = roleDisciplineForDepartment(technician?.department);
  const declined = env.declinedJobIds(technicianId);
  const fridge = env.isFridge(technicianId);

  const jobOptions = useMemo<JobOption[]>(
    () => env.getJobsForDate(date)
      .filter((job) => job.id !== move?.fromJobId)
      .map((job) => ({
        job,
        declined: declined?.has(job.id) ?? false,
        open: slotsForDepartment(env.roleSlotsByJob.get(job.id), discipline).filter((slot) => slot.open > 0),
      })),
    [env, date, move?.fromJobId, declined, discipline],
  );
  const selectable = jobOptions.filter((option) => !option.declined);

  const [pickedJobId, setPickedJobId] = useState<string | null>(null);
  const defaultJobId = useMemo(() => {
    if (env.focusJobId && selectable.some((option) => option.job.id === env.focusJobId)) return env.focusJobId;
    return selectable.length === 1 ? selectable[0].job.id : '';
  }, [env.focusJobId, selectable]);
  const jobId = pickedJobId ?? defaultJobId;
  const job = jobOptions.find((option) => option.job.id === jobId)?.job;
  const jobDays = useMemo(() => jobDayKeys(job), [job]);

  const pair = usePairState(jobId, technicianId, env.canAssign && !fridge);
  const pairDates = pair.data?.dates;
  const alreadyOnJob = (pair.data?.exists ?? false) && (pairDates?.length ?? 0) > 0;

  // Days: what the manager picked for this job, or the default for it.
  const [pickedDays, setPickedDays] = useState<{ jobId: string; days: string[] } | null>(null);
  const defaultDays = useMemo(() => {
    if (alreadyOnJob && pairDates) {
      const union = new Set(pairDates);
      if (jobDays.includes(dateKey)) union.add(dateKey);
      return [...union].sort();
    }
    return jobDays;
  }, [alreadyOnJob, pairDates, jobDays, dateKey]);
  const days = pickedDays && pickedDays.jobId === jobId ? pickedDays.days : defaultDays;
  const stripDays = useMemo(() => [...new Set([...jobDays, ...(pairDates ?? [])])].sort(), [jobDays, pairDates]);

  const toggleDay = useCallback((key: string) => {
    const next = new Set(days);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPickedDays({ jobId, days: [...next].sort() });
  }, [days, jobId]);
  const selectAllDays = useCallback(() => setPickedDays({ jobId, days: stripDays }), [jobId, stripDays]);
  const selectThisDayOnly = useCallback(() => setPickedDays({ jobId, days: [dateKey] }), [jobId, dateKey]);

  // Role: the manager's pick, else what a move keeps or the job's open slot suggests.
  const [pickedRole, setPickedRole] = useState<string | null>(null);
  const suggestion = useMemo<RoleSuggestion>(() => suggestRole({
    technician: technician ?? { department: null, skills: null },
    slots: slotsForDepartment(env.roleSlotsByJob.get(jobId), discipline),
    lastRoleCode: move?.role ?? env.lastRoleByTechnician.get(technicianId) ?? null,
  }), [technician, env.roleSlotsByJob, env.lastRoleByTechnician, jobId, discipline, move?.role, technicianId]);
  // Adding a day to a job the technician is already on keeps the role they hold there.
  const existingRole = useMemo(() => {
    const row = pair.data?.assignment;
    if (!row || !alreadyOnJob) return null;
    const held = discipline === 'lights' ? row.lights_role
      : discipline === 'video' ? row.video_role
      : discipline === 'production' ? row.production_role
      : row.sound_role;
    return held && suggestion.options.some((option) => option.code === held) ? held : null;
  }, [pair.data?.assignment, alreadyOnJob, discipline, suggestion.options]);
  const role = pickedRole ?? (move?.role ?? null) ?? existingRole ?? suggestion.code;

  const [conflict, setConflict] = useState<InspectorConflict | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stateReady = pair.isSuccess;
  const stateFailed = pair.isError;
  const canSubmit = env.canAssign && !fridge && !busy && !!jobId && !!role && days.length > 0 && stateReady;

  const submit = useCallback(async (status: 'invited' | 'confirmed', options: { force?: boolean; days?: string[] } = {}) => {
    if (!canSubmit && !(options.force && !busy)) return;
    const chosenDays = options.days ?? days;
    if (!jobId || !role || chosenDays.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const intent: MatrixIntent = {
        kind: 'assign',
        technicianId,
        jobId,
        role,
        status: move?.status === 'confirmed' ? 'confirmed' : status,
        ...coverageForDays(chosenDays, jobDays),
        mode: 'replace',
        conflictPolicy: options.force ? 'allow' : 'reject',
        fromJobId: move?.fromJobId ?? null,
        source: 'matrix-inspector',
      };
      const outcome = await env.runner.run(intent);
      if (!outcome.ok) {
        if (outcome.code === 'conflict' && outcome.conflict) {
          const conflictDays = outcome.conflict.conflict_dates ?? [];
          setConflict({
            details: outcome.conflict,
            status: intent.status,
            conflictDays,
            freeDays: chosenDays.filter((day) => !conflictDays.includes(day)),
          });
        } else {
          setConflict(null);
          setNotice(outcome.message);
        }
        return;
      }
      setConflict(null);
      const name = technician ? formatUserName(technician.first_name, technician.nickname, technician.last_name) : 'Técnico';
      const verb = move ? 'movido' : 'asignado';
      reportDone(
        `${name} ${verb} a ${job?.title ?? 'el trabajo'}`,
        outcome,
        `${plural(chosenDays.length, 'día', 'días')} · ${labelForCode(role)}`,
      );
      onDone();
    } finally {
      setBusy(false);
    }
  }, [canSubmit, busy, days, jobId, role, technicianId, move, jobDays, env.runner, technician, job?.title, onDone]);

  const force = useCallback(
    () => submit(conflict?.status ?? move?.status ?? 'invited', { force: true }),
    [submit, conflict?.status, move?.status],
  );

  return {
    fridge,
    jobOptions,
    jobId,
    job,
    pickJob: (id: string) => { setPickedJobId(id); setConflict(null); setNotice(null); },
    jobDays,
    stripDays,
    days,
    toggleDay,
    selectAllDays,
    selectThisDayOnly,
    alreadyOnJob,
    existingDays: pairDates ?? [],
    suggestion,
    role,
    pickRole: setPickedRole,
    canSubmit,
    stateReady,
    stateFailed,
    stateLoading: pair.isLoading,
    retryState: () => { void pair.refetch(); },
    stateMessage: ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE,
    conflict,
    clearConflict: () => setConflict(null),
    notice,
    busy,
    submit,
    force,
    submitFreeDays: () => submit(conflict?.status ?? 'invited', { days: conflict?.freeDays ?? [] }),
  };
}

export type AssignForm = ReturnType<typeof useAssignForm>;

/* ------------------------------------------------------------------------- */
/* An assigned cell                                                           */
/* ------------------------------------------------------------------------- */

type PendingAction = 'decline' | 'remove-day' | 'remove-all' | null;

interface AssignedOptions {
  env: InspectorEnvironment;
  technician: InspectorTechnician | undefined;
  target: InspectorTarget;
  jobId: string;
  onDone: () => void;
}

export function useAssignedPair({ env, technician, target, jobId, onDone }: AssignedOptions) {
  const { technicianId, dateKey } = target;
  const discipline = roleDisciplineForDepartment(technician?.department);
  const job = env.getJob(jobId);
  const pair = usePairState(jobId, technicianId, env.canAssign);
  const state = pair.data;
  const assignment = state?.assignment ?? null;
  const status = assignment?.status ?? null;

  const roleOptions: RoleOption[] = useMemo(() => (discipline ? roleOptionsForDiscipline(discipline) : []), [discipline]);
  const roleColumn = discipline === 'lights' ? assignment?.lights_role
    : discipline === 'video' ? assignment?.video_role
    : discipline === 'production' ? assignment?.production_role
    : assignment?.sound_role;
  const role = roleColumn ?? null;

  const jobDays = useMemo(() => jobDayKeys(job), [job]);
  const pairDates = useMemo(() => state?.dates ?? [], [state?.dates]);
  const stripDays = useMemo(() => [...new Set([...jobDays, ...pairDates])].sort(), [jobDays, pairDates]);

  const [picked, setPicked] = useState<string[] | null>(null);
  const days = picked ?? pairDates;
  const dirty = picked !== null && picked.join('|') !== [...pairDates].sort().join('|');

  const [pending, setPending] = useState<PendingAction>(null);
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = useTechnicianName(technician);

  const run = useCallback(async (
    intent: MatrixIntent,
    describe: (outcome: Extract<MatrixRunOutcome, { ok: true }>) => { title: string; description?: string },
    close = true,
  ) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await env.runner.run(intent);
      if (!outcome.ok) {
        setNotice(outcome.message);
        setPending(null);
        return;
      }
      const { title, description } = describe(outcome);
      reportDone(title, outcome, description);
      setPicked(null);
      setPending(null);
      if (close) onDone();
    } finally {
      setBusy(false);
    }
  }, [busy, env.runner, onDone]);

  const base = useMemo(() => ({ technicianId, jobId, source: 'matrix-inspector' }) as const, [technicianId, jobId]);

  const changeRole = useCallback((code: string) => {
    const department = roleDepartmentForCode(code);
    if (!department || code === role || !state) return Promise.resolve();
    return run(
      { kind: 'role', ...base, role: code, department },
      () => ({ title: `${name}: ${labelForCode(code)}`, description: job?.title }),
      false,
    );
  }, [role, state, run, base, name, job?.title]);

  const saveDays = useCallback(() => {
    if (!role || days.length === 0) return Promise.resolve();
    return run(
      {
        kind: 'assign', ...base, role,
        status: status === 'confirmed' ? 'confirmed' : 'invited',
        ...coverageForDays(days, jobDays),
        mode: 'replace',
        conflictPolicy: 'reject',
      },
      () => ({ title: `${name}: días actualizados`, description: `${plural(days.length, 'día', 'días')} · ${dayRangeLabel(days)}` }),
      false,
    );
  }, [role, days, run, base, status, jobDays, name]);

  const confirm = useCallback(() => run(
    { kind: 'confirm', ...base },
    () => ({ title: `${name} confirmado`, description: job?.title }),
  ), [run, base, name, job?.title]);

  const decline = useCallback(() => run(
    { kind: 'decline', ...base },
    () => ({ title: `${name} ha rechazado ${job?.title ?? 'el trabajo'}`, description: 'Se ha retirado del equipo. Esto no se puede deshacer.' }),
  ), [run, base, name, job?.title]);

  const remove = useCallback(() => (pending === 'remove-day'
    ? run(
      { kind: 'remove-date', ...base, date: dateKey },
      () => ({ title: `${name}: día quitado`, description: `${longDayLabel(dateKey)} · los demás días se mantienen` }),
    )
    : run(
      { kind: 'remove', ...base },
      () => ({ title: `${name} quitado de ${job?.title ?? 'el trabajo'}`, description: 'Esto no se puede deshacer.' }),
    )), [pending, run, base, dateKey, name, job?.title]);

  return {
    job,
    status,
    role,
    roleOptions,
    stripDays,
    days,
    pairDates,
    dirty,
    toggleDay: (key: string) => {
      const next = new Set(days);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setPicked([...next].sort());
    },
    resetDays: () => setPicked(null),
    stateReady: pair.isSuccess,
    stateFailed: pair.isError,
    stateLoading: pair.isLoading,
    retryState: () => { void pair.refetch(); },
    stateMessage: ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE,
    canRemoveDay: pairDates.length > 1 && pairDates.includes(dateKey),
    pending,
    ask: (action: Exclude<PendingAction, null>) => { setPending(action); setNotice(null); },
    cancelPending: () => setPending(null),
    moving,
    startMove: () => { setMoving(true); setNotice(null); },
    cancelMove: () => setMoving(false),
    notice,
    busy,
    changeRole,
    saveDays,
    confirm,
    decline,
    remove,
  };
}

export type AssignedPair = ReturnType<typeof useAssignedPair>;

/* ------------------------------------------------------------------------- */
/* Unavailability                                                             */
/* ------------------------------------------------------------------------- */

export function useUnavailability({ env, target, onDone }: { env: InspectorEnvironment; target: InspectorTarget; onDone: () => void }) {
  const { technicianId, dateKey } = target;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const availability = env.getAvailabilityForCell(technicianId, target.date);

  const mark = useCallback(async () => {
    if (busy || !env.canMarkUnavailable) return;
    setBusy(true);
    setNotice(null);
    try {
      await markUnavailable(technicianId, [dateKey]);
      toast('Marcado como no disponible', {
        description: longDayLabel(dateKey),
        action: { label: 'Deshacer', onClick: () => { void clearUnavailable(technicianId, [dateKey]); } },
      });
      onDone();
    } catch {
      setNotice('No se pudo marcar como no disponible. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }, [busy, env.canMarkUnavailable, technicianId, dateKey, onDone]);

  const clear = useCallback(async () => {
    if (busy || !env.canMarkUnavailable) return;
    setBusy(true);
    setNotice(null);
    try {
      const removed = await clearUnavailable(technicianId, [dateKey]);
      if (removed === 0) {
        setNotice('Esta no disponibilidad viene de unas vacaciones o del calendario de temporada: no se puede quitar desde aquí.');
        return;
      }
      toast('Disponible de nuevo', {
        description: longDayLabel(dateKey),
        action: { label: 'Deshacer', onClick: () => { void markUnavailable(technicianId, [dateKey]); } },
      });
      onDone();
    } catch {
      setNotice('No se pudo quitar la no disponibilidad. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }, [busy, env.canMarkUnavailable, technicianId, dateKey, onDone]);

  return { availability, busy, notice, mark, clear, canEdit: env.canMarkUnavailable };
}
