type TimesheetBreakdown = unknown;

export type JobDateTypeLike = {
  date?: string | null;
  type?: string | null;
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

export const prepDayHourlyRate = (breakdown: TimesheetBreakdown): number | null => {
  if (!breakdown || typeof breakdown !== "object") return null;
  const rate = Number((breakdown as Record<string, unknown>).prep_day_hourly_rate_eur);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};
