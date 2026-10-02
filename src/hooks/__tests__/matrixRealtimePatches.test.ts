import { describe, expect, it } from "vitest";

import { applyJobAssignmentChange, applyTimesheetChange, type MatrixQueryScope } from "@/hooks/matrixRealtimePatches";
import type { MatrixJob, MatrixTimesheetAssignment } from "@/hooks/useOptimizedMatrixData";

const job: MatrixJob = {
  id: "job-1",
  title: "Bolo",
  start_time: "2026-10-01T08:00:00Z",
  end_time: "2026-10-03T20:00:00Z",
  status: "Confirmado",
  job_type: "single",
};

const row = (date: string, overrides: Partial<MatrixTimesheetAssignment> = {}): MatrixTimesheetAssignment => ({
  job_id: "job-1",
  technician_id: "tech-1",
  date,
  job,
  status: "invited",
  assigned_at: "2026-09-30T10:00:00Z",
  assigned_by: "manager-1",
  sound_role: "SND-FOH-R",
  lights_role: null,
  video_role: null,
  is_schedule_only: false,
  source: "assignment",
  ...overrides,
});

const scope: MatrixQueryScope = {
  jobsById: new Map([["job-1", job]]),
  technicianIds: new Set(["tech-1", "tech-2"]),
  startKey: "2026-09-28",
  endKey: "2026-10-12",
};

describe("applyJobAssignmentChange", () => {
  it("updates status and role on every day the technician has on the job", () => {
    const rows = [row("2026-10-01"), row("2026-10-02"), row("2026-10-01", { technician_id: "tech-2" })];
    const next = applyJobAssignmentChange(rows, {
      eventType: "UPDATE",
      new: { job_id: "job-1", technician_id: "tech-1", status: "confirmed", sound_role: "SND-MON-R" },
    });
    expect(next?.filter((r) => r.technician_id === "tech-1").map((r) => [r.status, r.sound_role])).toEqual([
      ["confirmed", "SND-MON-R"],
      ["confirmed", "SND-MON-R"],
    ]);
    expect(next?.[2]).toBe(rows[2]);
  });

  it("returns the same array when the change touches nothing cached", () => {
    const rows = [row("2026-10-01")];
    expect(applyJobAssignmentChange(rows, { eventType: "UPDATE", new: { job_id: "other", technician_id: "tech-1" } })).toBe(rows);
  });

  it("leaves a delete without its columns to the refetch", () => {
    expect(applyJobAssignmentChange([row("2026-10-01")], { eventType: "DELETE", old: { id: "a-1" } })).toBeNull();
  });
});

describe("applyTimesheetChange", () => {
  it("adds a new day, taking role and status from the technician's other days", () => {
    const rows = [row("2026-10-01", { status: "confirmed" })];
    const next = applyTimesheetChange(
      rows,
      { eventType: "INSERT", new: { job_id: "job-1", technician_id: "tech-1", date: "2026-10-02", is_active: true } },
      scope,
    );
    expect(next).toHaveLength(2);
    expect(next?.[1]).toMatchObject({ date: "2026-10-02", status: "confirmed", sound_role: "SND-FOH-R", job });
  });

  it("removes a day that was deactivated", () => {
    const rows = [row("2026-10-01"), row("2026-10-02")];
    const next = applyTimesheetChange(
      rows,
      { eventType: "UPDATE", new: { job_id: "job-1", technician_id: "tech-1", date: "2026-10-02", is_active: false } },
      scope,
    );
    expect(next?.map((r) => r.date)).toEqual(["2026-10-01"]);
  });

  it("ignores days, technicians and jobs outside what the cached query covers", () => {
    const rows = [row("2026-10-01")];
    const insert = (overrides: Record<string, unknown>) =>
      applyTimesheetChange(
        rows,
        { eventType: "INSERT", new: { job_id: "job-1", technician_id: "tech-1", date: "2026-10-02", is_active: true, ...overrides } },
        scope,
      );
    expect(insert({ date: "2026-11-30" })).toBe(rows);
    expect(insert({ technician_id: "tech-9" })).toBe(rows);
    expect(insert({ job_id: "job-unknown" })).toBe(rows);
  });

  it("removes a deleted day when the payload carries its columns, and defers otherwise", () => {
    const rows = [row("2026-10-01"), row("2026-10-02")];
    expect(
      applyTimesheetChange(rows, { eventType: "DELETE", old: { job_id: "job-1", technician_id: "tech-1", date: "2026-10-01" } }, scope)
        ?.map((r) => r.date),
    ).toEqual(["2026-10-02"]);
    expect(applyTimesheetChange(rows, { eventType: "DELETE", old: { id: "ts-1" } }, scope)).toBeNull();
  });
});
