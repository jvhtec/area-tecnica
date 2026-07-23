import { format } from "date-fns";
import {
  checkTimeConflictEnhanced,
  type ConflictCheckResult,
} from "@/utils/technicianAvailability";
import type { CoverageMode } from "@/components/matrix/assignJobDialogTypes";

export interface AssignmentConflictWarning {
  result: ConflictCheckResult;
  targetDate?: string;
  mode: CoverageMode;
}

interface CheckAssignmentConflictsInput {
  technicianId: string;
  selectedJobId: string;
  coverageMode: CoverageMode;
  multiDates: Date[];
  assignmentDate: string;
}

export const checkAssignmentConflicts = async ({
  technicianId,
  selectedJobId,
  coverageMode,
  multiDates,
  assignmentDate,
}: CheckAssignmentConflictsInput): Promise<AssignmentConflictWarning | null> => {
  if (!selectedJobId) return null;

  if (coverageMode === "multi") {
    const uniqueKeys = Array.from(new Set(multiDates.map((date) => format(date, "yyyy-MM-dd"))));
    for (const key of uniqueKeys) {
      const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
        targetDateIso: key,
        singleDayOnly: true,
        includePending: true,
      });
      if (result.hasHardConflict || result.hasSoftConflict) {
        return { result, targetDate: key, mode: "multi" };
      }
    }
    return null;
  }

  if (coverageMode === "single") {
    const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
      targetDateIso: assignmentDate,
      singleDayOnly: true,
      includePending: true,
    });
    return result.hasHardConflict || result.hasSoftConflict
      ? { result, targetDate: assignmentDate, mode: "single" }
      : null;
  }

  const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
    includePending: true,
  });
  return result.hasHardConflict || result.hasSoftConflict
    ? { result, mode: "full" }
    : null;
};
