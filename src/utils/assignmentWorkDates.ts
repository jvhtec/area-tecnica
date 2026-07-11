import { isValid, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { isNonWorkingDateType } from "@/constants/dateTypes";

type DateValue = string | Date | null | undefined;

export interface JobDateTypeLike {
  date?: DateValue;
  type?: string | null;
}

export interface TourDateLike {
  date?: DateValue;
  start_date?: DateValue;
  end_date?: DateValue;
  tour_date_type?: string | null;
  type?: string | null;
}

export interface JobScheduleLike {
  job_date_types?: JobDateTypeLike[] | null;
  start_time?: DateValue;
  end_time?: DateValue;
  timezone?: string | null;
  tour_date?: TourDateLike | TourDateLike[] | null;
}

export interface AssignmentDateLike {
  assignment_source?: string | null;
  single_day?: boolean | null;
  assignment_date?: DateValue;
  _timesheet_dates?: DateValue[] | null;
  _scheduled_work_dates?: DateValue[] | null;
}

export interface ResolveAssignmentWorkDateOptions {
  timesheetDateKeys?: Iterable<DateValue> | null;
  scheduledDateKeys?: Iterable<DateValue> | null;
}

export const DEFAULT_JOB_TIME_ZONE = "Europe/Madrid";
const DATE_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})$/;
const TIME_ZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/;

/** Normalizes date-like values to the Madrid calendar date key used by job scheduling. */
export function normalizeDateKey(
  value: DateValue,
  timeZone: string = DEFAULT_JOB_TIME_ZONE,
): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatInTimeZone(value, timeZone, "yyyy-MM-dd");
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const dateKeyMatch = trimmed.match(DATE_KEY_PATTERN);
  if (dateKeyMatch) {
    return dateKeyMatch[1];
  }

  const parsed = TIME_ZONE_PATTERN.test(trimmed)
    ? parseISO(trimmed)
    : fromZonedTime(trimmed, timeZone);
  if (!isValid(parsed)) return null;

  return formatInTimeZone(parsed, timeZone, "yyyy-MM-dd");
}

/** Deduplicates and sorts date-like values after normalizing them to date keys. */
export function uniqueSortedDateKeys(values: Iterable<DateValue> | null | undefined): string[] {
  if (!values) return [];

  const keys = new Set<string>();
  for (const value of values) {
    const key = normalizeDateKey(value);
    if (key) keys.add(key);
  }

  return Array.from(keys).sort();
}

function addDays(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function buildDateRange(startKey: string, endKey: string): string[] {
  if (endKey < startKey) return [startKey];

  const dates: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

/** Builds an inclusive range of calendar keys in the job's configured timezone. */
export function getDateKeyRange(
  start: DateValue,
  end: DateValue,
  timeZone: string = DEFAULT_JOB_TIME_ZONE,
): string[] {
  const startKey = normalizeDateKey(start, timeZone);
  if (!startKey) return [];

  const endKey = normalizeDateKey(end, timeZone) ?? startKey;
  return buildDateRange(startKey, endKey);
}

function normalizeTourDateRows(tourDate: JobScheduleLike["tour_date"]): TourDateLike[] {
  if (!tourDate) return [];
  return (Array.isArray(tourDate) ? tourDate : [tourDate]).filter(Boolean);
}

function getTourDateWorkDateKeys(tourDate: JobScheduleLike["tour_date"]): string[] {
  const dates: string[] = [];

  for (const row of normalizeTourDateRows(tourDate)) {
    const dateType = row.tour_date_type ?? row.type;
    if (isNonWorkingDateType(dateType)) continue;

    const startKey = normalizeDateKey(row.start_date ?? row.date);
    if (!startKey) continue;

    const endKey = normalizeDateKey(row.end_date) ?? normalizeDateKey(row.date) ?? startKey;
    dates.push(...buildDateRange(startKey, endKey));
  }

  return uniqueSortedDateKeys(dates);
}

/** Returns the working dates for a job, excluding travel/off date types when present. */
export function getScheduledWorkDateKeys(job: JobScheduleLike | null | undefined): string[] {
  if (!job) return [];

  const timeZone = job.timezone || DEFAULT_JOB_TIME_ZONE;

  const dateTypeRows = Array.isArray(job.job_date_types) ? job.job_date_types : [];
  const typedRowsWithDates = dateTypeRows.filter((row) => Boolean(normalizeDateKey(row?.date)));
  const tourDateWorkDates = getTourDateWorkDateKeys(job.tour_date);

  if (typedRowsWithDates.length > 0) {
    const nonWorkingTypedDates = new Set(
      uniqueSortedDateKeys(
        typedRowsWithDates
          .filter((row) => isNonWorkingDateType(row?.type))
          .map((row) => row.date),
      ),
    );
    const typedWorkDates = uniqueSortedDateKeys(
      typedRowsWithDates
        .filter((row) => !isNonWorkingDateType(row?.type))
        .map((row) => row.date),
    );
    const fallbackTourDates = tourDateWorkDates.filter((dateKey) => !nonWorkingTypedDates.has(dateKey));
    return uniqueSortedDateKeys([...typedWorkDates, ...fallbackTourDates]);
  }

  if (tourDateWorkDates.length > 0) {
    return tourDateWorkDates;
  }

  return getDateKeyRange(job.start_time, job.end_time, timeZone);
}

/** Resolves the exact work dates that should be displayed for a personnel assignment. */
export function resolveAssignmentWorkDateKeys(
  assignment: AssignmentDateLike | null | undefined,
  options: ResolveAssignmentWorkDateOptions = {},
): string[] {
  if (!assignment) return [];

  const assignmentTimesheetDates = uniqueSortedDateKeys(assignment._timesheet_dates);
  const optionTimesheetDates = uniqueSortedDateKeys(options.timesheetDateKeys);
  const timesheetDates = uniqueSortedDateKeys([...assignmentTimesheetDates, ...optionTimesheetDates]);

  const assignmentScheduledDates = uniqueSortedDateKeys(assignment._scheduled_work_dates);
  const optionScheduledDates = uniqueSortedDateKeys(options.scheduledDateKeys);
  const scheduledDates = uniqueSortedDateKeys([...assignmentScheduledDates, ...optionScheduledDates]);

  const assignmentDate = normalizeDateKey(assignment.assignment_date);
  const isTourAssignment = assignment.assignment_source === "tour";

  if (timesheetDates.length > 0) {
    return timesheetDates;
  }

  if (assignment.single_day && !isTourAssignment) {
    return assignmentDate ? [assignmentDate] : [];
  }

  if (scheduledDates.length > 0) {
    return scheduledDates;
  }

  return assignmentDate ? [assignmentDate] : [];
}
