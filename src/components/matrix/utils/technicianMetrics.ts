import { isWithinInterval, parseISO } from 'date-fns';

export interface TechnicianMetricRow {
  job_id: string;
  date: string | Date;
}

export interface TechnicianMetricResult {
  monthConfirmed: number;
  yearConfirmed: number;
}

export function computeTechnicianTimesheetMetrics(
  rows: TechnicianMetricRow[] = [],
  monthStart: Date,
  monthEnd: Date
): TechnicianMetricResult {
  const monthInterval = { start: monthStart, end: monthEnd };
  const yearKeys = new Set<string>();
  const monthKeys = new Set<string>();

  rows.forEach(row => {
    if (!row.job_id || !row.date) {
      return;
    }
    const isoDate = typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10);
    const key = `${row.job_id}:${isoDate}`;
    yearKeys.add(key);

    const parsedDate = typeof row.date === 'string' ? parseISO(row.date) : row.date;
    if (isWithinInterval(parsedDate, monthInterval)) {
      monthKeys.add(key);
    }
  });

  return {
    monthConfirmed: monthKeys.size,
    yearConfirmed: yearKeys.size
  };
}
