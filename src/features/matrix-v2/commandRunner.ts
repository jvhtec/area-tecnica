import type { QueryClient } from '@tanstack/react-query';
import {
  ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE,
  AssignmentCommandError,
  applyDirectAssignment,
  assignmentCommandMessage,
  assignmentCommandStateKey,
  changeAssignmentRole,
  conflictDetailsSchema,
  createAssignmentCommandId,
  getAssignmentCommandState,
  isRejectionCode,
  reconcileAssignmentViews,
  removeAssignmentDate,
  removeDirectAssignment,
  runAssignmentSideEffects,
  setAssignmentStatus,
  undoAssignmentCommand,
  getAssignmentCommandUndoWindow,
  releaseAssignmentCommandEffects,
  type AssignmentCommandCode,
  type AssignmentCommandResult,
  type AssignmentCommandState,
  type SideEffectContext,
  type SideEffectSummary,
} from '@/features/assignments/commands';
import { getAssignableJobDateKeys } from '@/components/matrix/assignJobDialogTypes';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';
import { formatUserName } from '@/utils/userName';
import {
  patchMatrixCaches,
  pairViewFromResult,
  restoreMatrixCaches,
  snapshotMatrixCaches,
  type PairView,
} from '@/features/matrix-v2/pairPatch';
import {
  scheduleDeferredEffects,
  flushDeferredEffects,
  type DeferredEffects,
} from '@/features/matrix-v2/deferredEffects';
import {
  roleDepartmentForCode,
  type MatrixIntent,
  type MatrixRunOutcome,
  type MatrixTechnicianRef,
  type MatrixUndo,
  type MatrixUndoOutcome,
  type RoleDiscipline,
} from '@/features/matrix-v2/types';

/** How long a change can be taken back, and how long its Flex/notification effects wait. */
export const UNDO_WINDOW_MS = 8_000;

/** A pair's state is trusted this long between actions; the token guards the rest. */
const STATE_STALE_MS = 10_000;

export interface RunnerCommands {
  applyDirectAssignment: typeof applyDirectAssignment;
  setAssignmentStatus: typeof setAssignmentStatus;
  changeAssignmentRole: typeof changeAssignmentRole;
  removeDirectAssignment: typeof removeDirectAssignment;
  removeAssignmentDate: typeof removeAssignmentDate;
  undoAssignmentCommand: typeof undoAssignmentCommand;
  getAssignmentCommandUndoWindow: typeof getAssignmentCommandUndoWindow;
  releaseAssignmentCommandEffects: typeof releaseAssignmentCommandEffects;
  getAssignmentCommandState: typeof getAssignmentCommandState;
}

export interface RunnerEffects {
  run: (commandId: string, result: AssignmentCommandResult, context: SideEffectContext) => Promise<SideEffectSummary>;
}

export interface MatrixCommandRunnerDeps {
  queryClient: QueryClient;
  getJob: (jobId: string) => MatrixJob | undefined;
  getTechnician: (technicianId: string) => MatrixTechnicianRef | undefined;
  /** Replaced in tests. */
  commands?: Partial<RunnerCommands>;
  effects?: Partial<RunnerEffects>;
  now?: () => number;
  /** Told when a command's post-commit effects ran, so the UI can report failures. */
  onEffectsSettled?: (commandId: string, summary: SideEffectSummary) => void;
}

export interface MatrixCommandRunner {
  run: (intent: MatrixIntent) => Promise<MatrixRunOutcome>;
  /** Releases every held effect now (route change). */
  /** A pair's current state, from the cache the runner itself uses (read for at most 10 s before it is read again). */
  loadState: (jobId: string, technicianId: string) => Promise<AssignmentCommandState>;
  releaseAll: () => void;
}

type Failure = Extract<MatrixRunOutcome, { ok: false }>;

const ROLE_COLUMN: Record<RoleDiscipline, 'sound_role' | 'lights_role' | 'video_role' | 'production_role'> = {
  sound: 'sound_role',
  lights: 'lights_role',
  video: 'video_role',
  production: 'production_role',
};

const unique = (values: string[]) => [...new Set(values)].sort();

const roleOf = (state: AssignmentCommandState, department: RoleDiscipline): string | null =>
  state.assignment?.[ROLE_COLUMN[department]] ?? null;

function viewFromState(jobId: string, technicianId: string, state: AssignmentCommandState): PairView | null {
  const { assignment } = state;
  if (!assignment) return null;
  return {
    jobId,
    technicianId,
    dates: [...state.dates],
    status: assignment.status,
    roles: {
      sound: assignment.sound_role,
      lights: assignment.lights_role,
      video: assignment.video_role,
      production: assignment.production_role,
    },
    singleDay: assignment.single_day,
    assignmentDate: assignment.assignment_date,
  };
}

/** What the grid shows while the command is in flight. */
function predictView(
  intent: MatrixIntent,
  state: AssignmentCommandState,
  job: MatrixJob | undefined,
): PairView | null | undefined {
  const base = viewFromState(intent.jobId, intent.technicianId, state);
  switch (intent.kind) {
    case 'assign': {
      let dates: string[];
      if (intent.coverage === 'full') {
        dates = job ? getAssignableJobDateKeys(job) : [];
      } else {
        dates = intent.dates ?? [];
      }
      if (dates.length === 0) return undefined; // nothing reliable to paint
      if (intent.mode === 'add') dates = unique([...state.dates, ...dates]);
      const department = roleDepartmentForCode(intent.role);
      const roles = { ...(base?.roles ?? { sound: null, lights: null, video: null, production: null }) };
      if (department) roles[department] = intent.role;
      const sortedDates = unique(dates);
      return {
        jobId: intent.jobId,
        technicianId: intent.technicianId,
        dates: sortedDates,
        status: base?.status === 'confirmed' ? 'confirmed' : intent.status,
        roles,
        singleDay: intent.coverage === 'single' && sortedDates.length === 1,
        assignmentDate: intent.coverage === 'single' && sortedDates.length === 1 ? sortedDates[0] : null,
      };
    }
    case 'confirm':
      return base ? { ...base, status: 'confirmed' } : undefined;
    case 'role':
      return base ? { ...base, roles: { ...base.roles, [intent.department]: intent.role } } : undefined;
    case 'remove-date':
      return base ? { ...base, dates: base.dates.filter((date) => date !== intent.date) } : undefined;
    case 'decline':
    case 'remove':
      // A decline voids the schedule and a removal deletes it: the cells go.
      return null;
    default:
      return undefined;
  }
}

const sameDates = (a: string[], b: string[]) => unique(a).join('|') === unique(b).join('|');

export function createMatrixCommandRunner(deps: MatrixCommandRunnerDeps): MatrixCommandRunner {
  const { queryClient, getJob, getTechnician } = deps;
  const commands: RunnerCommands = {
    applyDirectAssignment,
    setAssignmentStatus,
    changeAssignmentRole,
    removeDirectAssignment,
    removeAssignmentDate,
    undoAssignmentCommand,
    getAssignmentCommandUndoWindow,
    releaseAssignmentCommandEffects,
    getAssignmentCommandState,
    ...deps.commands,
  };
  const effects: RunnerEffects = {
    run: runAssignmentSideEffects,
    ...deps.effects,
  };
  const now = deps.now ?? Date.now;
  const held = new Set<DeferredEffects>();
  // A retry of the same decision after a transport failure reuses its id, so a
  // command that did commit is replayed by the database instead of repeated.
  const pendingDecisions = new Map<string, {
    commandId: string;
    state: AssignmentCommandState;
    fromState: AssignmentCommandState | null;
  }>();
  const activeRuns = new Map<string, Promise<MatrixRunOutcome>>();

  const contextFor = (technicianId: string): SideEffectContext => {
    const technician = getTechnician(technicianId);
    return {
      technicianDepartment: technician?.department ?? null,
      recipientName: technician ? formatUserName(technician.first_name ?? '', technician.nickname ?? null, technician.last_name ?? '') || null : null,
    };
  };

  const runEffects = async (result: AssignmentCommandResult) => {
    try {
      const released = await commands.releaseAssignmentCommandEffects(result.command_id);
      if (!released || result.side_effects.length === 0) return null;
      return await effects.run(result.command_id, result, contextFor(result.technician_id)).then(
      (summary) => {
        deps.onEffectsSettled?.(result.command_id, summary);
        return summary;
      },
      (error: unknown) => {
        console.error('Assignment side effects could not run', error);
        return null;
      },
      );
    } catch (error) {
      // The durable plan remains retryable; a failed release must not bypass it.
      console.error('Assignment effects could not be released', error);
      return null;
    }
  };

  const holdEffects = (result: AssignmentCommandResult, expiresAt: number): DeferredEffects => {
    const deferred = scheduleDeferredEffects(result.command_id, () => {
      held.delete(deferred);
      return runEffects(result);
    }, Math.max(0, expiresAt - now()), now);
    held.add(deferred);
    return deferred;
  };

  const loadState = (jobId: string, technicianId: string) =>
    queryClient.fetchQuery({
      queryKey: assignmentCommandStateKey(jobId, technicianId),
      queryFn: () => commands.getAssignmentCommandState(jobId, technicianId),
      staleTime: STATE_STALE_MS,
    });

  const rememberState = (result: AssignmentCommandResult) => {
    if (!result.state_token) return;
    queryClient.setQueryData<AssignmentCommandState>(assignmentCommandStateKey(result.job_id, result.technician_id), {
      exists: result.assignment !== null,
      assignment: result.assignment,
      dates: result.dates,
      state_token: result.state_token,
    });
  };

  const failure = (
    code: AssignmentCommandCode,
    extra: Partial<Pick<Failure, 'result' | 'conflict' | 'message' | 'retryable'>> = {},
  ): Failure => ({
    ok: false,
    code,
    message: extra.message ?? assignmentCommandMessage(code),
    stale: code === 'stale_state' || code === 'concurrent_write',
    conflict: extra.conflict ?? null,
    result: extra.result ?? null,
    retryable: extra.retryable ?? false,
  });

  const failureFromError = (error: unknown): Failure => {
    if (error instanceof AssignmentCommandError) {
      return failure(error.code, { message: error.message, retryable: error.retryable, result: error.result });
    }
    return failure('unknown');
  };

  const failureFromRejection = (result: AssignmentCommandResult): Failure => {
    const code = isRejectionCode(result.code) ? result.code : 'unknown';
    const parsed = code === 'conflict' ? conflictDetailsSchema.safeParse(result.details) : null;
    return failure(code, { result, conflict: parsed?.success ? parsed.data : null });
  };

  const execute = (intent: MatrixIntent, state: AssignmentCommandState, fromState: AssignmentCommandState | null, commandId: string) => {
    const base = { commandId, jobId: intent.jobId, technicianId: intent.technicianId, expectedStateToken: state.state_token, source: intent.source };
    switch (intent.kind) {
      case 'assign':
        return commands.applyDirectAssignment({
          ...base,
          role: intent.role,
          status: intent.status,
          coverage: intent.coverage,
          dates: intent.dates,
          mode: intent.mode,
          fromJobId: intent.fromJobId ?? null,
          expectedFromStateToken: fromState?.state_token ?? null,
          conflictPolicy: intent.conflictPolicy ?? 'reject',
        });
      case 'confirm':
        return commands.setAssignmentStatus({ ...base, action: 'confirm' });
      case 'decline':
        return commands.setAssignmentStatus({ ...base, action: 'decline', notes: intent.notes ?? null });
      case 'role':
        return commands.changeAssignmentRole({ ...base, department: intent.department, role: intent.role, syncCategory: true });
      case 'remove':
        return commands.removeDirectAssignment(base);
      case 'remove-date':
        return commands.removeAssignmentDate({ ...base, date: intent.date });
    }
  };

  /** Only changes whose prior decision can be restored by one guarded command. */
  const canUndo = (intent: MatrixIntent, state: AssignmentCommandState, result: AssignmentCommandResult): boolean => {
    switch (intent.kind) {
      case 'assign': {
        if (intent.fromJobId) return false;
        if (!state.exists || !state.assignment) return true;
        const after = result.assignment;
        const department = roleDepartmentForCode(intent.role);
        if (!after || !department) return false;
        if (state.assignment.status !== 'invited' && state.assignment.status !== 'confirmed') return false;
        const priorRole = roleOf(state, department);
        const upgraded = state.assignment.status === 'invited' && after.status === 'confirmed';
        if (upgraded) return priorRole === intent.role && sameDates(state.dates, result.dates)
          && state.assignment.single_day === after.single_day
          && state.assignment.assignment_date === after.assignment_date
          && state.assignment.sound_role === after.sound_role
          && state.assignment.lights_role === after.lights_role
          && state.assignment.video_role === after.video_role
          && state.assignment.production_role === after.production_role;
        return !!priorRole && state.dates.length > 0;
      }
      case 'confirm': return state.assignment?.status === 'invited';
      case 'role': return true;
      default: return false;
    }
  };

  const buildUndo = (
    deferred: DeferredEffects,
    expiresAt: number,
    original: AssignmentCommandResult,
    priorState: AssignmentCommandState,
    intent: MatrixIntent,
  ): MatrixUndo => {
    const commandId = createAssignmentCommandId();
    let finished = false;
    let attempted = false;
    let active: Promise<MatrixUndoOutcome> | null = null;
    // An uncertain response can be replayed with this same packet even after
    // expiry. The database admits only a stored replay after that deadline.
    const isOpen = () => !finished && (attempted || (now() < expiresAt && deferred.isPending()));
    const executeUndo = async (): Promise<MatrixUndoOutcome> => {
      if (!isOpen()) return { ok: false, reason: 'expired', message: 'Ya no se puede deshacer: el cambio ya se ha comunicado.' };
      if (!original.state_token) return { ok: false, reason: 'failed', message: ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE };
      if (!attempted && !deferred.cancel()) return { ok: false, reason: 'expired', message: 'Ya no se puede deshacer: el cambio ya se ha comunicado.' };
      attempted = true;
      let result: AssignmentCommandResult;
      try {
        result = await commands.undoAssignmentCommand({
          commandId, originalCommandId: original.command_id,
          expectedStateToken: original.state_token, priorState,
        });
      } catch (error) {
        const failed = failureFromError(error);
        if (!failed.retryable && failed.code !== 'unknown' && failed.code !== 'concurrent_write') finished = true;
        // Keep the original deadline after an uncertain outcome. If undo did
        // commit, release sees the durable cancelled relationship and refuses.
        deferred.releaseSoon(finished ? 0 : Math.max(0, expiresAt - now()));
        return { ok: false, reason: 'failed', message: failed.message };
      }
      finished = true;
      if (!result.ok) {
        deferred.releaseSoon(0);
        const failed = failureFromRejection(result);
        reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId] });
        return { ok: false, reason: failed.stale ? 'stale' : 'rejected', message: failed.stale
          ? 'No se pudo deshacer: otra persona ha modificado la asignación.' : failed.message };
      }
      deferred.cancel();
      held.delete(deferred);
      if (!result.replayed) {
        patchMatrixCaches(queryClient, { jobId: intent.jobId, technicianId: intent.technicianId }, pairViewFromResult(result), getJob);
        rememberState(result);
      }
      reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId] });
      // Restoration and both cancellations already committed in the RPC.
      return { ok: true };
    };
    const undo = (): Promise<MatrixUndoOutcome> => {
      if (active) return active;
      const request = executeUndo();
      active = request;
      void request.then(() => { active = null; }, () => { active = null; });
      return request;
    };
    return { commandId: original.command_id, expiresAt, isOpen, undo, release: () => {
      if (!attempted) finished = true;
      deferred.release();
    } };
  };

  const run = async (intent: MatrixIntent): Promise<MatrixRunOutcome> => {
    const ids = { jobId: intent.jobId, technicianId: intent.technicianId };
    const fromJobId = intent.kind === 'assign' ? intent.fromJobId ?? null : null;

    // Retry an uncertain outcome with its original tokens. Reading a newer
    // token would authorize overwriting a colleague's subsequent decision.
    const decisionKey = JSON.stringify(intent);
    const pending = pendingDecisions.get(decisionKey);
    let state: AssignmentCommandState;
    let fromState: AssignmentCommandState | null = null;
    try {
      // Fail closed: a command sent without the state it was decided on could
      // overwrite a colleague's change.
      if (pending) {
        state = pending.state;
        fromState = pending.fromState;
      } else {
        state = await loadState(intent.jobId, intent.technicianId);
        if (fromJobId) fromState = await loadState(fromJobId, intent.technicianId);
      }
    } catch (error) {
      const failed = failureFromError(error);
      return { ...failed, message: failed.code === 'unknown' ? ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE : failed.message };
    }

    const commandId = pending?.commandId ?? createAssignmentCommandId();
    pendingDecisions.set(decisionKey, { commandId, state, fromState });

    const snapshot = snapshotMatrixCaches(queryClient, ids);
    const predicted = predictView(intent, state, getJob(intent.jobId));
    if (predicted !== undefined) patchMatrixCaches(queryClient, ids, predicted, getJob, snapshot);

    let result: AssignmentCommandResult;
    try {
      result = await execute(intent, state, fromState, commandId);
    } catch (error) {
      restoreMatrixCaches(queryClient, snapshot);
      const failed = failureFromError(error);
      // Network and unknown failures may have committed: keep the id for a retry.
      if (!failed.retryable && failed.code !== 'unknown') pendingDecisions.delete(decisionKey);
      if (failed.stale) reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId, fromJobId] });
      return failed;
    }
    pendingDecisions.delete(decisionKey);

    if (!result.ok) {
      restoreMatrixCaches(queryClient, snapshot);
      const failed = failureFromRejection(result);
      if (failed.stale) reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId, fromJobId] });
      return failed;
    }

    if (!result.replayed) {
      patchMatrixCaches(queryClient, ids, pairViewFromResult(result), getJob);
      if (fromJobId) patchMatrixCaches(queryClient, { jobId: fromJobId, technicianId: intent.technicianId }, null, getJob);
      rememberState(result);
    }
    reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId, fromJobId] });
    if (result.outcome === 'noop') return { ok: true, noop: true, result, undo: null };

    if (canUndo(intent, state, result)) {
      try {
        const window = await commands.getAssignmentCommandUndoWindow(result.command_id);
        const expiresAt = window.undo_expires_at ? Date.parse(window.undo_expires_at) : NaN;
        if (window.eligible && Number.isFinite(expiresAt) && expiresAt > now()) {
          const deferred = holdEffects(result, expiresAt);
          return { ok: true, noop: false, result, undo: buildUndo(deferred, expiresAt, result, state, intent) };
        }
      } catch (error) {
        console.error('Assignment undo window could not be loaded', error);
      }
    }
    void runEffects(result);
    return { ok: true, noop: false, result, undo: null };
  };

  return {
    run: (intent) => {
      const key = JSON.stringify(intent);
      const active = activeRuns.get(key);
      if (active) return active;
      const request = run(intent);
      activeRuns.set(key, request);
      const clear = () => {
        if (activeRuns.get(key) === request) activeRuns.delete(key);
      };
      void request.then(clear, clear);
      return request;
    },
    loadState,
    releaseAll: () => {
      for (const deferred of [...held]) deferred.release();
      held.clear();
      flushDeferredEffects();
    },
  };
}
