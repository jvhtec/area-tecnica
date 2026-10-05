/** What a staffing request's 409 said is in the way, in words for the manager. */
export interface StaffingConflictSummary {
  jobs: Array<{ title: string; range: string | null; role: string | null }>;
  off: Array<{ label: string; reason: string | null }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

const shortDate = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' });
};

const rangeOf = (start: unknown, end: unknown): string | null => {
  const from = shortDate(start);
  const to = shortDate(end);
  if (from && to) return from === to ? from : `${from} – ${to}`;
  return from ?? to;
};

/** Reads the conflict details leniently: the server's shape has varied, and a missing field must not hide the rest. */
export function describeStaffingConflict(details: unknown): StaffingConflictSummary {
  const summary: StaffingConflictSummary = { jobs: [], off: [] };
  if (!isRecord(details)) return summary;
  const conflicts = Array.isArray(details.conflicts) ? details.conflicts : [];
  for (const item of conflicts) {
    if (!isRecord(item)) continue;
    summary.jobs.push({
      title: text(item.job_name) ?? text(item.title) ?? 'Trabajo sin nombre',
      range: rangeOf(item.start_time, item.end_time),
      role: text(item.role),
    });
  }
  const unavailability = Array.isArray(details.unavailability) ? details.unavailability : [];
  for (const item of unavailability) {
    if (!isRecord(item)) continue;
    summary.off.push({
      label: rangeOf(item.start_date, item.end_date) ?? shortDate(item.date) ?? 'Fecha no especificada',
      reason: text(item.reason),
    });
  }
  return summary;
}
