/**
 * Copy for the evening-before shift reminder ("Mañana trabajas…"). Pure so the
 * wording is unit-testable without a database.
 */

export type ShiftReminderEntry = {
  jobId: string;
  jobTitle: string;
  jobType: string | null;
  jobStatus: string | null;
  /** Call time for that day, "HH:MM", from the technician's own timesheet. */
  startTime: string | null;
  locationName: string | null;
  /** job_date_type for that day, when one is set. */
  dateType: string | null;
};

const DATE_TYPE_ES: Record<string, string> = {
  travel: "Viaje",
  setup: "Montaje",
  show: "Show",
  rehearsal: "Ensayo",
  rigging: "Rigging",
  prep_day: "Preparación",
};

/** A day marked "off" on the job is not a working day, so it gets no reminder. */
export function isWorkingEntry(entry: ShiftReminderEntry): boolean {
  return entry.dateType !== "off";
}

export function normalizeCallTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function describeEntry(entry: ShiftReminderEntry): string[] {
  const parts: string[] = [];
  const dateTypeLabel = entry.dateType ? DATE_TYPE_ES[entry.dateType] : undefined;
  if (dateTypeLabel) parts.push(dateTypeLabel);
  if (entry.startTime) parts.push(`Citación ${entry.startTime}`);
  if (entry.locationName) parts.push(entry.locationName);
  return parts;
}

const tentativeSuffix = (entry: ShiftReminderEntry): string =>
  entry.jobStatus === "Tentativa" ? " (tentativo)" : "";

function byCallTime(a: ShiftReminderEntry, b: ShiftReminderEntry): number {
  if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
  if (a.startTime) return -1;
  if (b.startTime) return 1;
  return a.jobTitle.localeCompare(b.jobTitle, "es");
}

export function formatShiftReminder(entries: ShiftReminderEntry[]): { title: string; body: string } {
  const sorted = [...entries].sort(byCallTime);

  if (sorted.length === 1) {
    const [entry] = sorted;
    const details = describeEntry(entry);
    return {
      title: `Mañana: ${entry.jobTitle}${tentativeSuffix(entry)}`,
      body: details.length
        ? details.join(" · ")
        : "Revisa los detalles del trabajo en la app.",
    };
  }

  return {
    title: `Mañana tienes ${sorted.length} trabajos`,
    body: sorted
      .map((entry) => {
        const time = entry.startTime ? `${entry.startTime} · ` : "";
        const where = entry.locationName ? ` (${entry.locationName})` : "";
        return `${time}${entry.jobTitle}${tentativeSuffix(entry)}${where}`;
      })
      .join("\n"),
  };
}

/** YYYY-MM-DD plus `days`, calendar arithmetic only (no timezone shift). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
