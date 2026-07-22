import type { LensTone } from '@/components/matrix/lenses/types';
import { addMadridCalendarDays } from '@/utils/timezoneUtils';

export interface WorkloadThresholds {
  streakWarn: number;
  streakHigh: number;
  trailing7Warn: number;
}

export const DEFAULT_WORKLOAD_THRESHOLDS: WorkloadThresholds = {
  streakWarn: 6,
  streakHigh: 10,
  trailing7Warn: 6,
};

export interface CellWorkload {
  streak: number;
  tone: LensTone;
}

export interface TechWorkloadSummary {
  streakEndingToday: number;
  trailing7: number;
  monthCount: number;
  tone: LensTone;
}

/** Consecutive days present in `dateSet`, counting backward from and including `dateKey`. */
export function streakEndingAt(dateSet: Set<string>, dateKey: string): number {
  if (!dateSet.has(dateKey)) return 0;
  let count = 0;
  let cursor = dateKey;
  while (dateSet.has(cursor)) {
    count += 1;
    cursor = addMadridCalendarDays(cursor, -1);
  }
  return count;
}

/** Count of days present in `dateSet` within the `windowDays`-day window ending at (and including) `dateKey`. */
export function trailingCount(dateSet: Set<string>, dateKey: string, windowDays: number): number {
  let count = 0;
  let cursor = dateKey;
  for (let i = 0; i < windowDays; i += 1) {
    if (dateSet.has(cursor)) count += 1;
    cursor = addMadridCalendarDays(cursor, -1);
  }
  return count;
}

export function streakTone(streak: number, thresholds: WorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS): LensTone {
  if (streak >= thresholds.streakHigh) return 'high';
  if (streak >= thresholds.streakWarn) return 'warn';
  return 'neutral';
}

/**
 * Per-cell streak values across the matrix's visible date range. `datesByTech`
 * must include enough lookback (21 days before the earliest matrix date is
 * the documented minimum) for streaks near the left edge to be correct.
 */
export function buildCellWorkloadMap(
  datesByTech: Map<string, Set<string>>,
  dateKeys: string[],
  thresholds: WorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS,
): Map<string, CellWorkload> {
  const byCell = new Map<string, CellWorkload>();

  datesByTech.forEach((dateSet, technicianId) => {
    dateKeys.forEach((dateKey) => {
      if (!dateSet.has(dateKey)) return;
      const streak = streakEndingAt(dateSet, dateKey);
      byCell.set(`${technicianId}-${dateKey}`, { streak, tone: streakTone(streak, thresholds) });
    });
  });

  return byCell;
}

/** Per-technician "as of now" summary, independent of matrix scroll position. */
export function buildTechWorkloadSummaries(
  datesByTech: Map<string, Set<string>>,
  referenceDateKey: string,
  thresholds: WorkloadThresholds = DEFAULT_WORKLOAD_THRESHOLDS,
): Map<string, TechWorkloadSummary> {
  const byTech = new Map<string, TechWorkloadSummary>();
  const monthPrefix = referenceDateKey.slice(0, 7);

  datesByTech.forEach((dateSet, technicianId) => {
    const streakEndingToday = streakEndingAt(dateSet, referenceDateKey);
    const trailing7 = trailingCount(dateSet, referenceDateKey, 7);
    let monthCount = 0;
    dateSet.forEach((key) => {
      if (key.startsWith(monthPrefix)) monthCount += 1;
    });

    byTech.set(technicianId, {
      streakEndingToday,
      trailing7,
      monthCount,
      tone: streakTone(streakEndingToday, thresholds),
    });
  });

  return byTech;
}

/** Percentile (0-100) of each technician's count among department peers — higher means busier. */
export function computeDepartmentPercentiles(
  countsByTech: Map<string, number>,
  departmentByTech: Map<string, string>,
): Map<string, number> {
  const byDept = new Map<string, Array<{ id: string; count: number }>>();

  countsByTech.forEach((count, id) => {
    const department = departmentByTech.get(id);
    if (!department) return;
    if (!byDept.has(department)) byDept.set(department, []);
    byDept.get(department)!.push({ id, count });
  });

  const result = new Map<string, number>();
  byDept.forEach((techs) => {
    const sorted = [...techs].sort((a, b) => a.count - b.count);
    const n = sorted.length;
    sorted.forEach((tech, idx) => {
      const percentile = n <= 1 ? 100 : Math.round((idx / (n - 1)) * 100);
      result.set(tech.id, percentile);
    });
  });

  return result;
}
