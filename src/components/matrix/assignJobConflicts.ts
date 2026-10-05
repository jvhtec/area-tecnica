import type { CoverageMode } from "@/components/matrix/assignJobDialogTypes";
import {
  conflictDetailsSchema,
  type AssignmentCommandResult,
} from "@/features/assignments/commands";
import type { ConflictCheckResult } from "@/utils/technicianAvailability";

export interface AssignmentConflictWarning {
  result: ConflictCheckResult;
  targetDate?: string;
  mode: CoverageMode;
}

/**
 * Builds the warning shown before an override from a `conflict` rejection.
 * The conflict is decided by apply_direct_assignment under the technician
 * lock, so this is authoritative rather than a stale browser pre-check.
 */
export const conflictWarningFromRejection = (
  result: AssignmentCommandResult,
  mode: CoverageMode,
): AssignmentConflictWarning | null => {
  if (result.ok || result.code !== "conflict") return null;
  const parsed = conflictDetailsSchema.safeParse(result.details);
  if (!parsed.success) return null;
  return {
    result: parsed.data.conflicts,
    targetDate: mode === "full" ? undefined : parsed.data.target_date ?? undefined,
    mode,
  };
};
