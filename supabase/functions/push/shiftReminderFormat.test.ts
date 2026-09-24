import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  formatShiftReminder,
  isWorkingEntry,
  normalizeCallTime,
  type ShiftReminderEntry,
} from "./shiftReminderFormat.ts";

const entry = (overrides: Partial<ShiftReminderEntry> = {}): ShiftReminderEntry => ({
  jobId: "job-1",
  jobTitle: "Concierto Auditorio",
  jobType: "single",
  jobStatus: "Confirmado",
  startTime: "09:00",
  locationName: "Auditorio Nacional",
  dateType: null,
  ...overrides,
});

describe("formatShiftReminder", () => {
  it("names the job, call time and venue for a single shift", () => {
    expect(formatShiftReminder([entry({ dateType: "setup" })])).toEqual({
      title: "Mañana: Concierto Auditorio",
      body: "Montaje · Citación 09:00 · Auditorio Nacional",
    });
  });

  it("flags tentative jobs and still reads well without a call time", () => {
    expect(formatShiftReminder([entry({ jobStatus: "Tentativa", startTime: null, locationName: null })])).toEqual({
      title: "Mañana: Concierto Auditorio (tentativo)",
      body: "Revisa los detalles del trabajo en la app.",
    });
  });

  it("lists several shifts in call-time order", () => {
    const result = formatShiftReminder([
      entry({ jobId: "b", jobTitle: "Gala", startTime: "18:30", locationName: null }),
      entry({ jobId: "a", jobTitle: "Carga almacén", startTime: "08:00", locationName: "Nave" }),
    ]);
    expect(result.title).toBe("Mañana tienes 2 trabajos");
    expect(result.body).toBe("08:00 · Carga almacén (Nave)\n18:30 · Gala");
  });
});

describe("shift reminder helpers", () => {
  it("skips days marked off on the job", () => {
    expect(isWorkingEntry(entry({ dateType: "off" }))).toBe(false);
    expect(isWorkingEntry(entry({ dateType: "show" }))).toBe(true);
  });

  it("normalizes Postgres time values", () => {
    expect(normalizeCallTime("09:00:00")).toBe("09:00");
    expect(normalizeCallTime("7:05")).toBe("07:05");
    expect(normalizeCallTime(null)).toBeNull();
    expect(normalizeCallTime("n/a")).toBeNull();
  });

  it("adds calendar days across month and DST boundaries", () => {
    expect(addDaysToDateKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysToDateKey("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});
