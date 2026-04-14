import type { QueryClient } from "@tanstack/react-query";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { MatrixJobLite } from "@/features/staffing/hooks/useStaffingMatrixStatuses";

const MATRIX_TIMEZONE = "Europe/Madrid";
const MATRIX_DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MATRIX === "true";

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function formatMatrixDateKey(date: Date): string {
  return formatInTimeZone(date, MATRIX_TIMEZONE, "yyyy-MM-dd");
}

export function parseMatrixDateKey(dateKey: string): Date {
  return fromZonedTime(`${dateKey}T00:00:00`, MATRIX_TIMEZONE);
}

export function toMatrixDayTimestamp(dateKey: string): number {
  return fromZonedTime(`${dateKey}T00:00:00`, MATRIX_TIMEZONE).getTime();
}

export function buildMatrixCellKey(technicianId: string, dateOrKey: Date | string): string {
  const dateKey = typeof dateOrKey === "string" ? dateOrKey : formatMatrixDateKey(dateOrKey);
  return `${technicianId}-${dateKey}`;
}

export function matrixDebug(message: string, payload?: unknown) {
  if (!MATRIX_DEBUG_ENABLED) {
    return;
  }

  if (payload === undefined) {
    console.log(`[matrix] ${message}`);
    return;
  }

  console.log(`[matrix] ${message}`, payload);
}

export const matrixQueryKeys = {
  techniciansPrefix: ["optimized-matrix-technicians"] as const,
  jobsPrefix: ["optimized-matrix-jobs"] as const,
  assignmentsPrefix: ["optimized-matrix-assignments"] as const,
  legacyMatrixAssignmentsPrefix: ["matrix-assignments"] as const,
  legacyJobAssignmentsPrefix: ["job-assignments"] as const,
  availabilityPrefix: ["optimized-matrix-availability"] as const,
  staffingPrefix: ["staffing-matrix"] as const,
  legacyStaffingPrefix: ["staffing"] as const,
  staffingByDatePrefix: ["staffing-by-date"] as const,
  sortJobStatusesPrefix: ["matrix-sort-job-statuses"] as const,
  technicians: (department: string) => ["optimized-matrix-technicians", department] as const,
  jobs: (startDateKey: string, endDateKey: string, department: string) =>
    ["optimized-matrix-jobs", startDateKey, endDateKey, department] as const,
  assignments: (jobIds: string[], technicianIds: string[], startDateKey: string, endDateKey: string) =>
    ["optimized-matrix-assignments", jobIds, technicianIds, startDateKey, endDateKey] as const,
  availability: (technicianIds: string[], startDateKey: string, endDateKey: string) =>
    ["optimized-matrix-availability", technicianIds, startDateKey, endDateKey] as const,
  staffingMatrix: (technicianIds: string[], jobs: MatrixJobLite[], dates: Date[]) =>
    [
      "staffing-matrix",
      technicianIds,
      jobs.map((job) => job.id),
      dates[0] ? formatMatrixDateKey(dates[0]) : null,
      dates.length ? formatMatrixDateKey(dates[dates.length - 1]!) : null,
    ] as const,
  sortJobStatuses: (sortJobId: string | null, technicianIds: string[]) =>
    ["matrix-sort-job-statuses", sortJobId, technicianIds.join(",")] as const,
  techResidencias: (technicianIds: string[]) => ["tech-residencias", technicianIds.join(",")] as const,
  techConfirmedCounts: () => ["tech-confirmed-counts-all-with-dept"] as const,
  techLastYearCounts: () => ["tech-last-year-counts-all-with-dept"] as const,
  tooltipProfileNames: (actorIds: string[]) =>
    ["matrix-tooltip-profile-names", [...actorIds].sort().join(",")] as const,
};

export async function invalidateMatrixAssignmentQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.assignmentsPrefix }),
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.legacyMatrixAssignmentsPrefix }),
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.legacyJobAssignmentsPrefix }),
  ]);
}

export async function invalidateMatrixAvailabilityQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.availabilityPrefix }),
  ]);
}

export async function invalidateMatrixJobsAndStaffingQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.jobsPrefix }),
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.staffingPrefix }),
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.legacyStaffingPrefix }),
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.staffingByDatePrefix }),
    queryClient.invalidateQueries({ queryKey: matrixQueryKeys.sortJobStatusesPrefix }),
    queryClient.invalidateQueries({ queryKey: ["jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] }),
  ]);
}
