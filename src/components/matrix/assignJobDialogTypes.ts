import type { Database } from "@/integrations/supabase/types";
import { normalizeDateKey, uniqueSortedDateKeys } from "@/utils/assignmentWorkDates";
import {
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
} from "@/utils/timezoneUtils";

type AssignableJobDateType = {
  date?: string | null;
  type?: string | null;
};

export type AssignableJob = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_date_types?: AssignableJobDateType[] | null;
};

export type JobAssignmentRow = Database["public"]["Tables"]["job_assignments"]["Row"];
export type JobAssignmentUpdate = Database["public"]["Tables"]["job_assignments"]["Update"];
export type ExistingAssignment = JobAssignmentRow & {
  jobs?: (Pick<AssignableJob, "title"> & { department?: string | null }) | null;
};
export type CoverageMode = "full" | "single" | "multi";

export interface AssignJobDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  date: Date;
  availableJobs: AssignableJob[];
  existingAssignment?: ExistingAssignment;
  preSelectedJobId?: string;
}

export const formatDateKey = formatMadridDateKey;
export const parseDateKey = fromMadridDateKey;
export const sortDateKeys = uniqueSortedDateKeys;

const EXCLUDED_ASSIGNABLE_DATE_TYPES = new Set(["off", "travel"]);

/**
 * Returns every job date that may receive an assignment, including prep/rehearsal
 * typed dates before the main job span while excluding non-work travel/off days.
 */
export const getAssignableJobDateKeys = (job: AssignableJob | null | undefined) => {
  if (!job) return [];

  const keys = new Set<string>();
  const excludedTypedDates = new Set<string>();
  const dateTypes = Array.isArray(job.job_date_types) ? job.job_date_types : [];

  dateTypes.forEach((row) => {
    const key = normalizeDateKey(row?.date);
    if (!key) return;
    const type = String(row?.type || "").toLowerCase();
    if (EXCLUDED_ASSIGNABLE_DATE_TYPES.has(type)) {
      excludedTypedDates.add(key);
      return;
    }
    keys.add(key);
  });

  const startKey = normalizeDateKey(job.start_time);
  const endKey = normalizeDateKey(job.end_time) ?? startKey;
  if (!startKey) return sortDateKeys(keys);
  let cursorKey = startKey;

  while (cursorKey <= endKey) {
    if (!excludedTypedDates.has(cursorKey)) keys.add(cursorKey);
    cursorKey = addMadridCalendarDays(cursorKey, 1);
  }

  return sortDateKeys(keys);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Error desconocido";

export const getErrorCode = (error: unknown) =>
  isRecord(error) && typeof error.code === "string" ? error.code : null;
