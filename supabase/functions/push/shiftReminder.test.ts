import { describe, expect, it, vi } from "vitest";

vi.mock("./config.ts", () => ({ EVENT_TYPES: { JOB_UPDATED: "job.updated", JOB_SHIFT_REMINDER: "job.shift.reminder" } }));
// Delivery pulls in the web-push/APNs senders, which read Deno env at import.
vi.mock("./scheduledDelivery.ts", () => ({
  addOutcome: vi.fn(), deliverScheduledToUser: vi.fn(), emptyTally: vi.fn(), finishScheduledRun: vi.fn(),
}));

import { isOccurrenceStale, loadShiftsForDate, shiftReminderUrl } from "./shiftReminder.ts";

function shiftClient(timesheets: unknown[], dateTypes: unknown[]) {
  const from = vi.fn((table: string) => {
    if (table === "timesheets") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        returns: async () => ({ data: timesheets, error: null }),
      };
      return chain;
    }
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      returns: async () => ({ data: dateTypes, error: null }),
    };
    return chain;
  });
  return { from } as never;
}

describe("loadShiftsForDate", () => {
  it("groups each technician's working jobs and drops cancelled or off days", async () => {
    const client = shiftClient([
      {
        technician_id: "tech-1",
        job_id: "job-1",
        start_time: "09:00:00",
        job: { id: "job-1", title: "Gala", status: "Confirmado", job_type: "single", location: [{ name: "Teatro" }] },
        profile: [{ role: "technician" }],
      },
      {
        technician_id: "tech-1",
        job_id: "job-2",
        start_time: null,
        job: { id: "job-2", title: "Cancelada", status: "Cancelado", job_type: "single", location: null },
        profile: { role: "technician" },
      },
      {
        technician_id: "tech-2",
        job_id: "job-3",
        start_time: "10:00:00",
        job: { id: "job-3", title: "Festival", status: "Confirmado", job_type: "festival", location: null },
        profile: { role: "house_tech" },
      },
    ], [{ job_id: "job-3", type: "off" }]);

    const shifts = await loadShiftsForDate(client, "2026-09-24");

    expect([...shifts.keys()]).toEqual(["tech-1"]);
    expect(shifts.get("tech-1")).toEqual({
      role: "technician",
      entries: [expect.objectContaining({ jobId: "job-1", startTime: "09:00", locationName: "Teatro" })],
    });
  });
});

describe("shiftReminderUrl", () => {
  const single = (role: string) => ({
    role,
    entries: [{
      jobId: "job-1", jobTitle: "Gala", jobType: "single", jobStatus: "Confirmado",
      startTime: "09:00", locationName: null, dateType: null,
    }],
  });

  it("opens the job in the surface each role can reach", () => {
    expect(shiftReminderUrl(single("technician"))).toBe("/tech-app?tab=jobs&jobId=job-1&open=details");
    expect(shiftReminderUrl(single("house_tech"))).toBe("/festival-management/job-1?singleJob=true");
  });

  it("opens the agenda when there is more than one job", () => {
    const technician = single("technician");
    technician.entries.push({ ...technician.entries[0], jobId: "job-2" });
    expect(shiftReminderUrl(technician)).toBe("/tech-app?tab=jobs");
    expect(shiftReminderUrl({ ...technician, role: "house_tech" })).toBe("/personal");
  });
});

describe("isOccurrenceStale", () => {
  it("is fresh on the evening it was scheduled for, stale after local midnight", () => {
    // 21:30 UTC on 23 Sep is 23:30 in Madrid (CEST): still the same evening.
    expect(isOccurrenceStale("2026-09-23", "Europe/Madrid", new Date("2026-09-23T21:30:00Z"))).toBe(false);
    // 22:30 UTC is 00:30 on the 24th in Madrid.
    expect(isOccurrenceStale("2026-09-23", "Europe/Madrid", new Date("2026-09-23T22:30:00Z"))).toBe(true);
  });
});
