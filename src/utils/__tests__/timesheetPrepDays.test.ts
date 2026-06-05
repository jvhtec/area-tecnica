import { describe, expect, it } from "vitest";

import {
  getPrepDayDatesForAssignment,
  getTimesheetAutoCreateDatesForAssignment,
  isAssignmentScopedToPrepDay,
} from "@/utils/timesheetPrepDays";

describe("prep day assignment scoping", () => {
  it("matches only non-declined single-day assignments for the exact prep date", () => {
    expect(isAssignmentScopedToPrepDay({
      technician_id: "tech-1",
      status: "confirmed",
      single_day: true,
      assignment_date: "2026-06-01",
    }, "2026-06-01")).toBe(true);

    expect(isAssignmentScopedToPrepDay({
      technician_id: "tech-1",
      status: "confirmed",
      single_day: false,
      assignment_date: "2026-06-01",
    }, "2026-06-01")).toBe(false);

    expect(isAssignmentScopedToPrepDay({
      technician_id: "tech-1",
      status: "declined",
      single_day: true,
      assignment_date: "2026-06-01",
    }, "2026-06-01")).toBe(false);
  });

  it("returns only prep dates assigned to that technician row", () => {
    expect(getPrepDayDatesForAssignment({
      technician_id: "tech-1",
      status: "confirmed",
      single_day: true,
      assignment_date: "2026-06-02T00:00:00Z",
    }, ["2026-06-01", "2026-06-02"])).toEqual(["2026-06-02"]);
  });

  it("does not expand prep-only assignments to regular timesheet dates", () => {
    expect(getTimesheetAutoCreateDatesForAssignment({
      technician_id: "tech-1",
      status: "confirmed",
      single_day: true,
      assignment_date: "2026-05-31",
    }, ["2026-06-01"], ["2026-05-31"])).toEqual(["2026-05-31"]);
  });

  it("keeps full assignments on regular dates without adding unassigned prep days", () => {
    expect(getTimesheetAutoCreateDatesForAssignment({
      technician_id: "tech-1",
      status: "confirmed",
      single_day: false,
      assignment_date: null,
    }, ["2026-06-01"], ["2026-05-31"])).toEqual(["2026-06-01"]);
  });
});
