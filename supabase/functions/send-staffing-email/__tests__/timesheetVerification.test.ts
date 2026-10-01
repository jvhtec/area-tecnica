import { describe, expect, it } from "vitest";
import { classifyTimesheetVerification } from "../timesheetVerification.ts";

describe("exact timesheet conflict verification", () => {
  it("blocks when the database returns an error even with an empty rows array", () => {
    expect(classifyTimesheetVerification([], new Error("connection lost"))).toEqual({ kind: "unavailable" });
  });

  it("blocks when an error accompanies apparently conflict-free rows", () => {
    expect(classifyTimesheetVerification([{ date: "2026-10-25" }], { code: "42501" }))
      .toEqual({ kind: "unavailable" });
  });

  it.each([null, undefined])("blocks an incomplete successful lookup (%s)", (rows) => {
    expect(classifyTimesheetVerification(rows, null)).toEqual({ kind: "unavailable" });
  });

  it("permits a verified empty result", () => {
    expect(classifyTimesheetVerification([], null)).toEqual({ kind: "clear" });
  });

  it("returns every discovered conflicting booking without dropping rows", () => {
    const bookings = [
      { date: "2026-10-25", job_id: "job-2" },
      { date: "2026-10-26", job_id: "job-3" },
    ];
    const result = classifyTimesheetVerification(bookings, null);
    expect(result.kind).toBe("conflict");
    if (result.kind === "conflict") {
      expect(result.rows).toBe(bookings);
      expect(result.rows).toHaveLength(2);
    }
  });
});
