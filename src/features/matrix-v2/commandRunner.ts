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
  supersedeAssignmentSideEffects,
  unconfirmAssignment,
  type AssignmentCommandCode,
  type AssignmentCommandResult,
  type AssignmentCommandState,
  type SideEffectContext,
  type SideEffectSummary,
  type SupersedeResult,
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
  unconfirmAssignment: typeof unconfirmAssignment;
  getAssignmentCommandState: typeof getAssignmentCommandState;
}

export interface RunnerEffects {
  run: (commandId: string, result: AssignmentCommandResult, context: SideEffectContext) => Promise<SideEffectSummary>;
  supersede: (commandIds: string[]) => Promise<SupersedeResult>;
}

export interface MatrixCommandRunnerDeps {
  queryClient: QueryClient;
  getJob: (jobId: string) => MatrixJob | undefined;
  getTechnician: (technicianId: string) => MatrixTechnicianRef | undefined;
  /** Replaced in tests. */
  commands?: Partial<RunnerCommands>;
  effects?: Partial<RunnerEffects>;
  undoWindowMs?: number;
  now?: () => number;
  /** Told when a command's post-commit effects ran, so the UI can report failures. */
  onEffectsSettled?: (commandId: string, summary: SideEffectSummary) => void;
}

export interface MatrixCommandRunner {
  run: (intent: MatrixIntent) => Promise<MatrixRunOutcome>;
  /** Releases every held effect now (route change). */
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

type InverseSpec = {
  /** Runs the inverse command; `expectedStateToken` is the state right after the change. */
  run: (commandId: string, expectedStateToken: string) => Promise<AssignmentCommandResult>;
};

export function createMatrixCommandRunner(deps: MatrixCommandRunnerDeps): MatrixCommandRunner {
  const { queryClient, getJob, getTechnician } = deps;
  const commands: RunnerCommands = {
    applyDirectAssignment,
    setAssignmentStatus,
    changeAssignmentRole,
    removeDirectAssignment,
    removeAssignmentDate,
    unconfirmAssignment,
    getAssignmentCommandState,
    ...deps.commands,
  };
  const effects: RunnerEffects = {
    run: runAssignmentSideEffects,
    supersede: supersedeAssignmentSideEffects,
    ...deps.effects,
  };
  const undoWindowMs = deps.undoWindowMs ?? UNDO_WINDOW_MS;
  const now = deps.now ?? Date.now;
  const held = new Set<DeferredEffects>();
  // A retry of the same decision after a transport failure reuses its id, so a
  // command that did commit is replayed by the database instead of repeated.
  const pendingIds = new Map<string, string>();

  const contextFor = (technicianId: string): SideEffectContext => {
    const technician = getTechnician(technicianId);
    return {
      technicianDepartment: technician?.department ?? null,
      recipientName: technician ? formatUserName(technician.first_name ?? '', technician.nickname ?? null, technician.last_name ?? '') || null : null,
    };
  };

  const runEffects = (result: AssignmentCommandResult) => {
    if (result.side_effects.length === 0) return Promise.resolve(null);
    return effects.run(result.command_id, result, contextFor(result.technician_id)).then(
      (summary) => {
        deps.onEffectsSettled?.(result.command_id, summary);
        return summary;
      },
      (error: unknown) => {
        console.error('Assignment side effects could not run', error);
        return null;
      },
    );
  };

  const holdEffects = (result: AssignmentCommandResult): DeferredEffects | null => {
    if (result.side_effects.length === 0) return null;
    const deferred = scheduleDeferredEffects(result.command_id, () => {
      held.delete(deferred);
      return runEffects(result);
    }, undoWindowMs, now);
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

  /** The command that takes the change back, or null when it cannot be done in one atomic step. */
  const inverseOf = (
    intent: MatrixIntent,
    state: AssignmentCommandState,
    result: AssignmentCommandResult,
  ): InverseSpec | null => {
    const { jobId, technicianId } = intent;
    const source = intent.source;
    switch (intent.kind) {
      case 'assign': {
        if (intent.fromJobId) return null; // a move is confirmed inline instead
        if (!state.exists || !state.assignment) {
          return { run: (commandId, token) => commands.removeDirectAssignment({ commandId, jobId, technicianId, expectedStateToken: token, source }) };
        }
        const previous = state.assignment;
        const after = result.assignment;
        if (!after) return null;
        const department = roleDepartmentForCode(intent.role);
        if (!department) return null;
        const previousRole = roleOf(state, department);
        const roleChanged = previousRole !== intent.role;
        const datesChanged = !sameDates(state.dates, result.dates);
        const upgraded = previous.status !== 'confirmed' && after.status === 'confirmed';
        if (upgraded && !roleChanged && !datesChanged) {
          return { run: (commandId, token) => commands.unconfirmAssignment({ commandId, jobId, technicianId, expectedStateToken: token, source }) };
        }
        // Two writes (reopen + restore) would not be atomic: confirm inline instead.
        if (upgraded) return null;
        if (!previousRole || state.dates.length === 0) return null;
        return {
          run: (commandId, token) => commands.applyDirectAssignment({
            commandId,
            jobId,
            technicianId,
            role: previousRole,
            status: previous.status === 'confirmed' ? 'confirmed' : 'invited',
            coverage: 'multi',
            dates: state.dates,
            mode: 'replace',
            expectedStateToken: token,
            conflictPolicy: 'reject',
            source,
          }),
        };
      }
      case 'confirm': {
        if (state.assignment?.status === 'confirmed') return null;
        return { run: (commandId, token) => commands.unconfirmAssignment({ commandId, jobId, technicianId, expectedStateToken: token, source }) };
      }
      case 'role': {
        const previousRole = roleOf(state, intent.department);
        return {
          run: (commandId, token) => commands.changeAssignmentRole({
            commandId, jobId, technicianId, department: intent.department, role: previousRole, syncCategory: true, expectedStateToken: token, source,
          }),
        };
      }
      default:
        return null;
    }
  };

  const buildUndo = (
    deferred: DeferredEffects | null,
    original: AssignmentCommandResult,
    inverse: InverseSpec,
    intent: MatrixIntent,
  ): MatrixUndo => {
    // Without effects to hold the window is only the toast; the undo itself
    // stays valid for the same time so the behaviour does not depend on them.
    const expiresAt = deferred?.expiresAt ?? now() + undoWindowMs;
    let used = false;
    const isOpen = () => !used && now() < expiresAt && (deferred ? deferred.isPending() : true);

    const undo = async (): Promise<MatrixUndoOutcome> => {
      if (!isOpen()) {
        return { ok: false, reason: 'expired', message: 'Ya no se puede deshacer: el cambio ya se ha comunicado.' };
      }
      used = true;
      if (deferred && !deferred.cancel()) {
        return { ok: false, reason: 'expired', message: 'Ya no se puede deshacer: el cambio ya se ha comunicado.' };
      }
      const token = original.state_token;
      if (!token) {
        deferred?.releaseSoon();
        return { ok: false, reason: 'failed', message: ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE };
      }
      let inverseResult: AssignmentCommandResult;
      try {
        inverseResult = await inverse.run(createAssignmentCommandId(), token);
      } catch (error) {
        deferred?.releaseSoon();
        const failed = failureFromError(error);
        return { ok: false, reason: 'failed', message: failed.message };
      }
      if (!inverseResult.ok) {
        deferred?.releaseSoon();
        const failed = failureFromRejection(inverseResult);
        reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId] });
        return {
          ok: false,
          reason: failed.stale ? 'stale' : 'rejected',
          message: failed.stale
            ? 'No se pudo deshacer: otra persona ha modificado la asignación.'
            : failed.message,
        };
      }

      patchMatrixCaches(queryClient, { jobId: intent.jobId, technicianId: intent.technicianId }, pairViewFromResult(inverseResult), getJob);
      rememberState(inverseResult);
      reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId] });

      // Cancel what never ran. Anything that already ran means the technician
      // or Flex heard about the change, so the inverse is announced too.
      let announceInverse = true;
      if (deferred) {
        try {
          const first = await effects.supersede([original.command_id]);
          if (first.not_superseded === 0) {
            const second = await effects.supersede([inverseResult.command_id]);
            announceInverse = second.not_superseded > 0;
          }
        } catch {
          // Could not cancel: keep both sides consistent by letting both run.
          // The timer was cancelled above, so it has to be re-armed (release
          // alone would be a no-op).
          deferred.releaseSoon(0);
        }
      }
      if (announceInverse) void runEffects(inverseResult);
      return { ok: true };
    };

    return { commandId: original.command_id, expiresAt, isOpen, undo, release: () => deferred?.release() };
  };

  const run = async (intent: MatrixIntent): Promise<MatrixRunOutcome> => {
    const ids = { jobId: intent.jobId, technicianId: intent.technicianId };
    const fromJobId = intent.kind === 'assign' ? intent.fromJobId ?? null : null;

    let state: AssignmentCommandState;
    let fromState: AssignmentCommandState | null = null;
    try {
      // Fail closed: a command sent without the state it was decided on could
      // overwrite a colleague's change.
      state = await loadState(intent.jobId, intent.technicianId);
      if (fromJobId) fromState = await loadState(fromJobId, intent.technicianId);
    } catch (error) {
      const failed = failureFromError(error);
      return { ...failed, message: failed.code === 'unknown' ? ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE : failed.message };
    }

    const fingerprint = JSON.stringify([intent, state.state_token, fromState?.state_token ?? null]);
    const commandId = pendingIds.get(fingerprint) ?? createAssignmentCommandId();
    pendingIds.set(fingerprint, commandId);

    const snapshot = snapshotMatrixCaches(queryClient);
    const predicted = predictView(intent, state, getJob(intent.jobId));
    if (predicted !== undefined) patchMatrixCaches(queryClient, ids, predicted, getJob);

    let result: AssignmentCommandResult;
    try {
      result = await execute(intent, state, fromState, commandId);
    } catch (error) {
      restoreMatrixCaches(queryClient, snapshot);
      const failed = failureFromError(error);
      // Network and unknown failures may have committed: keep the id for a retry.
      if (!failed.retryable && failed.code !== 'unknown') pendingIds.delete(fingerprint);
      if (failed.stale) reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId, fromJobId] });
      return failed;
    }
    pendingIds.delete(fingerprint);

    if (!result.ok) {
      restoreMatrixCaches(queryClient, snapshot);
      const failed = failureFromRejection(result);
      if (failed.stale) reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId, fromJobId] });
      return failed;
    }

    patchMatrixCaches(queryClient, ids, pairViewFromResult(result), getJob);
    if (fromJobId) patchMatrixCaches(queryClient, { jobId: fromJobId, technicianId: intent.technicianId }, null, getJob);
    rememberState(result);
    reconcileAssignmentViews(queryClient, { technicianId: intent.technicianId, jobIds: [intent.jobId, fromJobId] });

    if (result.outcome === 'noop') return { ok: true, noop: true, result, undo: null };

    const deferred = holdEffects(result);
    const inverse = inverseOf(intent, state, result);
    if (!inverse) {
      // Not undoable (decline, removal, move): its effects run right away.
      if (deferred) deferred.release();
      return { ok: true, noop: false, result, undo: null };
    }
    return { ok: true, noop: false, result, undo: buildUndo(deferred, result, inverse, intent) };
  };

  return {
    run,
    releaseAll: () => {
      for (const deferred of [...held]) deferred.release();
      held.clear();
      flushDeferredEffects();
    },
  };
}
