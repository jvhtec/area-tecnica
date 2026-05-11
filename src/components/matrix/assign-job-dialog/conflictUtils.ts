import { format } from 'date-fns';
import { checkTimeConflictEnhanced, type ConflictCheckResult } from '@/utils/technicianAvailability';

export type ConflictWarningPayload = {
  result: ConflictCheckResult;
  perDateConflicts?: Array<{
    targetDate: string;
    result: ConflictCheckResult;
  }>;
  targetDate?: string;
  mode: 'full' | 'single' | 'multi';
};

interface GetConflictWarningOptions {
  selectedJobId: string;
  coverageMode: 'full' | 'single' | 'multi';
  technicianId: string;
  assignmentDate: string;
  multiDates: Date[];
}

export const getConflictWarning = async ({
  selectedJobId,
  coverageMode,
  technicianId,
  assignmentDate,
  multiDates,
}: GetConflictWarningOptions): Promise<ConflictWarningPayload | null> => {
  if (!selectedJobId) return null;

  if (coverageMode === 'multi') {
    const uniqueKeys = Array.from(new Set((multiDates || []).map((d) => format(d, 'yyyy-MM-dd'))));
    const results = await Promise.all(uniqueKeys.map((key) => checkTimeConflictEnhanced(technicianId, selectedJobId, {
      targetDateIso: key,
      singleDayOnly: true,
      includePending: true,
    })));
    const perDateConflicts: Array<{ targetDate: string; result: ConflictCheckResult }> = results
      .map((result, idx) => ({ targetDate: uniqueKeys[idx], result }))
      .filter(({ result }) => (
        result.hasHardConflict ||
        result.hasSoftConflict ||
        result.unavailabilityConflicts.length > 0
      ));

    if (perDateConflicts.length === 0) return null;

    return {
      mode: 'multi',
      perDateConflicts,
      result: {
        hasHardConflict: perDateConflicts.some(({ result }) => result.hasHardConflict),
        hasSoftConflict: perDateConflicts.some(({ result }) => result.hasSoftConflict),
        hardConflicts: perDateConflicts.flatMap(({ result }) => result.hardConflicts),
        softConflicts: perDateConflicts.flatMap(({ result }) => result.softConflicts),
        unavailabilityConflicts: perDateConflicts.flatMap(({ result }) => result.unavailabilityConflicts),
      },
    };
  }

  if (coverageMode === 'single') {
    const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
      targetDateIso: assignmentDate,
      singleDayOnly: true,
      includePending: true,
    });
    return result.hasHardConflict || result.hasSoftConflict || result.unavailabilityConflicts.length > 0
      ? { result, targetDate: assignmentDate, mode: 'single' }
      : null;
  }

  const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
    includePending: true,
  });

  return result.hasHardConflict || result.hasSoftConflict || result.unavailabilityConflicts.length > 0
    ? { result, mode: 'full' }
    : null;
};
