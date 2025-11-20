import { format, parseISO } from 'date-fns';

const SAFE_FORMAT = 'MMM d';

function safeFormat(date: string, formatter: string = SAFE_FORMAT) {
  try {
    return format(parseISO(`${date}T00:00:00`), formatter);
  } catch {
    return date;
  }
}

export function formatTimesheetCoverage(
  ranges: Array<{ start: string; end: string }>
): string {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return '';
  }

  return ranges
    .map(({ start, end }) => {
      if (!start) return '';
      if (!end || start === end) {
        return safeFormat(start);
      }
      const startLabel = safeFormat(start);
      const endLabel = safeFormat(end, SAFE_FORMAT);
      return `${startLabel} – ${endLabel}`;
    })
    .filter(Boolean)
    .join(', ');
}

export function buildTimesheetTooltip(dates: string[]): string {
  if (!Array.isArray(dates) || dates.length === 0) {
    return '';
  }

  return dates
    .map(date => {
      try {
        return format(parseISO(`${date}T00:00:00`), 'PPP');
      } catch {
        return date;
      }
    })
    .join('\n');
}
