import type {
  AssignmentCommandCode,
  AssignmentCommandResult,
  AssignmentConflictDetails,
  AssignmentConflictPolicy,
  AssignmentCoverage,
  AssignmentCoverageMode,
} from '@/features/assignments/commands';

/**
 * Where a Matrix command came from. Stored on the command ledger (`source`) so
 * get_assignment_command_metrics can tell the new surfaces apart. The database
 * accepts `^[a-z0-9][a-z0-9_-]{0,63}$`, hence the hyphens.
 */
export type MatrixCommandSource =
  | 'matrix-inspector'
  | 'matrix-focus'
  | 'matrix-batch'
  | 'matrix-keyboard';

export type RoleDiscipline = 'sound' | 'lights' | 'video' | 'production';

export interface MatrixTechnicianRef {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  department?: string | null;
  skills?: Array<{ name?: string | null; is_primary?: boolean | null; proficiency?: number | null }> | null;
}

/** One thing a manager decided to do to a job/technician pair. */
export type MatrixIntent =
  | {
      kind: 'assign';
      technicianId: string;
      jobId: string;
      role: string;
      status: 'invited' | 'confirmed';
      coverage: AssignmentCoverage;
      /** Required for single/multi coverage. */
      dates?: string[];
      mode?: AssignmentCoverageMode;
      conflictPolicy?: AssignmentConflictPolicy;
      /** Moves the technician off this job in the same command (no undo). */
      fromJobId?: string | null;
      source: MatrixCommandSource;
    }
  | { kind: 'confirm'; technicianId: string; jobId: string; source: MatrixCommandSource }
  | { kind: 'decline'; technicianId: string; jobId: string; notes?: string | null; source: MatrixCommandSource }
  | { kind: 'role'; technicianId: string; jobId: string; role: string | null; department: RoleDiscipline; source: MatrixCommandSource }
  | { kind: 'remove'; technicianId: string; jobId: string; source: MatrixCommandSource }
  | { kind: 'remove-date'; technicianId: string; jobId: string; date: string; source: MatrixCommandSource };

export type MatrixIntentKind = MatrixIntent['kind'];

export type MatrixUndoFailure = 'expired' | 'stale' | 'rejected' | 'failed';

export type MatrixUndoOutcome =
  | { ok: true }
  | { ok: false; reason: MatrixUndoFailure; message: string };

/**
 * A short window in which a committed change can be taken back. Its post-commit
 * effects (Flex, notifications) are held until the window closes, so an undo
 * means nobody ever hears about the change.
 */
export interface MatrixUndo {
  /** Command that made the change. */
  commandId: string;
  /** Epoch ms at which the window closes and effects are released. */
  expiresAt: number;
  isOpen: () => boolean;
  undo: () => Promise<MatrixUndoOutcome>;
  /** Releases the held effects now (page hide, route change, toast dismissed). */
  release: () => void;
}

export type MatrixRunOutcome =
  | {
      ok: true;
      /** The pair was already in the requested state: nothing was written. */
      noop: boolean;
      result: AssignmentCommandResult;
      /** Null for changes that are confirmed inline instead (decline, remove, move). */
      undo: MatrixUndo | null;
    }
  | {
      ok: false;
      code: AssignmentCommandCode;
      message: string;
      /** The pair changed elsewhere; its state was reloaded and the grid refreshed. */
      stale: boolean;
      /** Present for a `conflict` rejection: what to show next to Forzar. */
      conflict: AssignmentConflictDetails | null;
      result: AssignmentCommandResult | null;
      /** A transport failure: retrying the same decision is safe. */
      retryable: boolean;
    };

export const roleDepartmentForCode = (code: string | null | undefined): RoleDiscipline | null => {
  if (!code) return null;
  if (code.startsWith('SND-')) return 'sound';
  if (code.startsWith('LGT-')) return 'lights';
  if (code.startsWith('VID-')) return 'video';
  if (code.startsWith('PROD-')) return 'production';
  return null;
};

/** Mirrors assignment_role_discipline() in the database: which role codes a department may hold. */
export const roleDisciplineForDepartment = (department: string | null | undefined): RoleDiscipline | null => {
  switch ((department ?? '').trim().toLowerCase()) {
    case 'sound':
      return 'sound';
    case 'lights':
      return 'lights';
    case 'video':
      return 'video';
    case 'production':
    case 'logistics':
      return 'production';
    default:
      return null;
  }
};
