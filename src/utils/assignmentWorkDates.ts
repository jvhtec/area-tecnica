import { isValid, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { isNonWorkingDateType } from "@/constants/dateTypes";

type DateValue = string | Date | null | undefined;

export interface JobDateTypeLike {
  date?: DateValue;
  type?: string | null;
}

export interface JobScheduleLike {
  job_date_types?: JobDateTypeLike[] | null;
  start_time?: DateValue;
  end_time?: DateValue;
}

export interface AssignmentDateLike {
  single_day?: boolean | null;
  assignment_date?: DateValue;
  _timesheet_dates?: DateValue[] | null;
  _scheduled_work_dates?: DateValue[] | null;
}

export interface ResolveAssignmentWorkDateOptions {
  timesheetDateKeys?: Iterable<DateValue> | null;
  scheduledDateKeys?: Iterable<DateValue> | null;
}

const MADRID_TIME_ZONE = "Europe/Madrid";
const DATE_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})$/;
const TIME_ZONE_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/;

/** Normalizes date-like values to the Madrid calendar date key used by job scheduling. */
export function normalizeDateKey(value: DateValue): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatInTimeZone(value, MADRID_TIME_ZONE, "yyyy-MM-dd");
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const dateKeyMatch = trimmed.match(DATE_KEY_PATTERN);
  if (dateKeyMatch) {
    return dateKeyMatch[1];
  }

  const parsed = TIME_ZONE_PATTERN.test(trimmed)
    ? parseISO(trimmed)
    : fromZonedTime(trimmed, MADRID_TIME_ZONE);
  if (!isValid(parsed)) return null;

  return formatInTimeZone(parsed, MADRID_TIME_ZONE, "yyyy-MM-dd");
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

/** Returns the working dates for a job, excluding travel/off date types when present. */
export function getScheduledWorkDateKeys(job: JobScheduleLike | null | undefined): string[] {
  if (!job) return [];

  const dateTypeRows = Array.isArray(job.job_date_types) ? job.job_date_types : [];
  const typedRowsWithDates = dateTypeRows.filter((row) => Boolean(normalizeDateKey(row?.date)));

  if (typedRowsWithDates.length > 0) {
    return uniqueSortedDateKeys(
      typedRowsWithDates
        .filter((row) => !isNonWorkingDateType(row?.type))
        .map((row) => row.date),
    );
  }

  const startKey = normalizeDateKey(job.start_time);
  if (!startKey) return [];

  const endKey = normalizeDateKey(job.end_time) ?? startKey;
  return buildDateRange(startKey, endKey);
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

  if (assignment.single_day) {
    if (timesheetDates.length > 0) return timesheetDates;
    return assignmentDate ? [assignmentDate] : [];
  }

  if (scheduledDates.length > 0) {
    return scheduledDates;
  }

  if (timesheetDates.length > 0) {
    return timesheetDates;
  }

  return assignmentDate ? [assignmentDate] : [];
}
