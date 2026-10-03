import { z } from 'zod';

/**
 * Wire vocabulary of the assignment command RPCs
 * (apply_direct_assignment / remove_direct_assignment / remove_assignment_date).
 * See docs/staffing/ASSIGNMENT_COMMANDS.md.
 */

/** Business rejections returned by the database (no write happened). */
export const REJECTION_CODES = [
  'stale_state',
  'conflict',
  'job_not_found',
  'technician_not_found',
  'role_department_mismatch',
  'invalid_job_span',
  'last_date',
  'assignment_not_found',
] as const;
export type AssignmentRejectionCode = (typeof REJECTION_CODES)[number];

/** Transport/authorization failures classified on the client. */
export type AssignmentFailureCode =
  | 'permission_denied'
  | 'invalid_request'
  | 'command_id_reused'
  | 'concurrent_write'
  | 'network'
  | 'unknown';

export type AssignmentCommandCode = AssignmentRejectionCode | AssignmentFailureCode;

export type AssignmentCoverage = 'full' | 'single' | 'multi';
export type AssignmentCoverageMode = 'add' | 'replace';
export type AssignmentConflictPolicy = 'reject' | 'allow';

const nullableString = z.string().nullable().optional().transform((value) => value ?? null);

export const assignmentRowSchema = z.object({
  id: z.string(),
  status: nullableString,
  sound_role: nullableString,
  lights_role: nullableString,
  video_role: nullableString,
  production_role: nullableString,
  single_day: z.boolean(),
  assignment_date: nullableString,
  assignment_source: nullableString,
});
export type AssignmentCommandRow = z.infer<typeof assignmentRowSchema>;

export const sideEffectSchema = z.object({
  kind: z.enum(['flex', 'notification']),
  action: z.string(),
  job_id: z.string(),
  department: z.enum(['sound', 'lights']).optional(),
  status: z.enum(['pending', 'succeeded', 'failed']),
  attempts: z.number().optional(),
  last_error: z.string().nullable().optional(),
});
export type AssignmentSideEffect = z.infer<typeof sideEffectSchema>;

const conflictJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  status: z.string(),
});

export const conflictDetailsSchema = z.object({
  target_date: z.string().nullable().optional(),
  conflict_dates: z.array(z.string()).optional(),
  conflicts: z.object({
    hasHardConflict: z.boolean(),
    hasSoftConflict: z.boolean(),
    hardConflicts: z.array(conflictJobSchema),
    softConflicts: z.array(conflictJobSchema),
    unavailabilityConflicts: z.array(z.object({
      date: z.string(),
      reason: z.string(),
      source: z.string(),
      notes: z.string().optional(),
    })),
  }),
});
export type AssignmentConflictDetails = z.infer<typeof conflictDetailsSchema>;

const removedSchema = z.object({
  job_id: z.string(),
  deleted_timesheets: z.number(),
  deleted_assignment: z.boolean(),
  assignment: assignmentRowSchema.nullable(),
});

const warningSchema = z.object({ kind: z.string() }).passthrough();

export const commandResultSchema = z.object({
  ok: z.boolean(),
  outcome: z.enum(['committed', 'noop', 'rejected']),
  code: z.string().optional(),
  message: z.string().optional(),
  command_id: z.string(),
  job_id: z.string(),
  technician_id: z.string(),
  state_token: z.string().nullable(),
  replayed: z.boolean().optional().default(false),
  assignment: assignmentRowSchema.nullable().optional().transform((value) => value ?? null),
  dates: z.array(z.string()).optional().default([]),
  added_dates: z.array(z.string()).nullable().optional(),
  removed_dates: z.array(z.string()).nullable().optional(),
  moved_from: removedSchema.nullable().optional(),
  removed: removedSchema.nullable().optional(),
  conflict_override: z.boolean().optional(),
  side_effects: z.array(sideEffectSchema).optional().default([]),
  warnings: z.array(warningSchema).optional().default([]),
  details: z.record(z.unknown()).optional(),
});
export type AssignmentCommandResult = z.infer<typeof commandResultSchema>;

export const commandStateSchema = z.object({
  exists: z.boolean(),
  assignment: assignmentRowSchema.nullable(),
  dates: z.array(z.string()),
  state_token: z.string(),
});
export type AssignmentCommandState = z.infer<typeof commandStateSchema>;

export interface ApplyDirectAssignmentInput {
  commandId: string;
  jobId: string;
  technicianId: string;
  role: string;
  status: 'invited' | 'confirmed';
  coverage: AssignmentCoverage;
  /** Required for single/multi coverage; full coverage is derived by the database. */
  dates?: string[];
  mode?: AssignmentCoverageMode;
  expectedStateToken?: string | null;
  /** Moves the technician off this job in the same transaction. */
  fromJobId?: string | null;
  expectedFromStateToken?: string | null;
  conflictPolicy?: AssignmentConflictPolicy;
  source?: string;
}

export interface RemoveDirectAssignmentInput {
  commandId: string;
  jobId: string;
  technicianId: string;
  expectedStateToken?: string | null;
  source?: string;
}

export interface RemoveAssignmentDateInput extends RemoveDirectAssignmentInput {
  date: string;
}

export type AssignmentRoleDepartment = 'sound' | 'lights' | 'video' | 'production';

export interface ChangeAssignmentRoleInput extends RemoveDirectAssignmentInput {
  department: AssignmentRoleDepartment;
  /** Role code, or null/'none' to clear the department role. */
  role: string | null;
  syncCategory?: boolean;
}

export interface SetAssignmentStatusInput extends RemoveDirectAssignmentInput {
  action: 'confirm' | 'decline';
  notes?: string | null;
}
