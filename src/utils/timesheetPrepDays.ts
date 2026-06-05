type TimesheetBreakdown = unknown;

export type JobDateTypeLike = {
  date?: string | null;
  type?: string | null;
};

export type PrepDayAssignmentLike = {
  assignment_date?: string | null;
  single_day?: boolean | null;
  status?: string | null;
  technician_id?: string | null;
};

const toDateKey = (date?: string | null): string | null => {
  if (!date) return null;
  const key = String(date).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
};

export const isPrepDayBreakdown = (breakdown: TimesheetBreakdown): boolean => {
  if (!breakdown || typeof breakdown !== "object") return false;
  return (breakdown as Record<string, unknown>).is_prep_day === true;
};

export const isPrepDayTimesheet = (
  timesheet: {
    amount_breakdown?: unknown;
    amount_breakdown_visible?: unknown;
    is_prep_day?: boolean | null;
    category?: unknown;
  },
): boolean => (
  timesheet.is_prep_day === true ||
  timesheet.category === "prep_day" ||
  isPrepDayBreakdown(timesheet.amount_breakdown) ||
  isPrepDayBreakdown(timesheet.amount_breakdown_visible)
);

export const hasPrepDayDateType = (dateTypes: JobDateTypeLike[] | null | undefined): boolean => (
  Array.isArray(dateTypes) && dateTypes.some((dateType) => dateType?.type === "prep_day")
);

export const hasPrepDayDateTypeForDate = (
  dateTypes: JobDateTypeLike[] | null | undefined,
  date?: string | null,
): boolean => (
  Boolean(date) &&
  Array.isArray(dateTypes) &&
  dateTypes.some((dateType) => dateType?.type === "prep_day" && dateType.date === date)
);

export const isAssignmentScopedToPrepDay = (
  assignment: PrepDayAssignmentLike | null | undefined,
  prepDayDate: string,
): boolean => (
  Boolean(assignment?.technician_id) &&
  assignment?.status !== "declined" &&
  assignment?.single_day === true &&
  toDateKey(assignment?.assignment_date) === prepDayDate
);

export const getPrepDayDatesForAssignment = (
  assignment: PrepDayAssignmentLike | null | undefined,
  prepDayDates: string[],
): string[] => prepDayDates.filter((date) => isAssignmentScopedToPrepDay(assignment, date));

export const getTimesheetAutoCreateDatesForAssignment = (
  assignment: PrepDayAssignmentLike | null | undefined,
  regularDates: string[],
  prepDayDates: string[],
): string[] => {
  const assignmentDate = toDateKey(assignment?.assignment_date);
  const regularDatesForAssignment = assignment?.single_day === true
    ? regularDates.filter((date) => date === assignmentDate)
    : regularDates;

  return Array.from(new Set([
    ...regularDatesForAssignment,
    ...getPrepDayDatesForAssignment(assignment, prepDayDates),
  ])).sort();
};

export const prepDayHourlyRate = (breakdown: TimesheetBreakdown): number | null => {
  if (!breakdown || typeof breakdown !== "object") return null;
  const rate = Number((breakdown as Record<string, unknown>).prep_day_hourly_rate_eur);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};
