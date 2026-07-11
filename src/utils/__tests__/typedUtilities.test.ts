import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { findClosestFestival, calculatePageForFestival } from "@/utils/dateUtils";
import { shouldAutoComplete, type AutoCompleteJobResult } from "@/utils/jobStatusUtils";
import { throttle } from "@/utils/throttle";
import {
  aggregateJobTimesheets,
  type AssignmentLookupRow,
  type TimesheetRowWithTechnician,
} from "@/utils/timesheetAssignments";

afterEach(() => {
  vi.useRealTimers();
});

describe("typed utility regressions", () => {
  it("finds the closest festival and calculates its page", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-10T12:00:00Z"));
    const festivals = [
      { id: "festival-1", start_time: "2026-06-20T10:00:00Z", title: "Later" },
      { id: "festival-2", start_time: "2026-06-09T10:00:00Z", title: "Closest" },
      { id: "festival-3", start_time: "2026-07-01T10:00:00Z", title: "Latest" },
    ];

    const closest = findClosestFestival(festivals);

    expect(closest?.id).toBe("festival-2");
    expect(calculatePageForFestival(festivals, closest, 2)).toBe(1);
    expect(calculatePageForFestival(festivals, festivals[2], 2)).toBe(2);
  });

  it("compares festival calendar days in Madrid for viewers in any timezone", () => {
    const festivals = [
      { id: "previous", start_time: "2026-06-01T21:30:00Z" },
      { id: "today", start_time: "2026-06-01T22:30:00Z" },
    ];

    const closest = findClosestFestival(festivals, new Date("2026-06-02T12:00:00Z"));

    expect(closest?.id).toBe("today");
  });

  it("checks auto-completion against the job closure window", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-20T12:00:00Z"));

    expect(shouldAutoComplete({
      id: "job-1",
      end_time: "2026-06-01T18:00:00Z",
      status: "Confirmado",
      timezone: "Europe/Madrid",
    })).toBe(true);
    expect(shouldAutoComplete({
      id: "job-2",
      end_time: "2026-06-01T18:00:00Z",
      status: "Cancelado",
      timezone: "Europe/Madrid",
    })).toBe(false);
  });

  it("widens auto-completed job status without erasing caller fields", () => {
    type ConfirmedJob = {
      id: string;
      end_time: string;
      status: "Confirmado";
      projectCode: string;
    };

    expectTypeOf<AutoCompleteJobResult<ConfirmedJob>>().toMatchTypeOf<
      | ConfirmedJob
      | {
          id: string;
          end_time: string;
          status: "Confirmado" | "Completado";
          projectCode: string;
        }
    >();
  });

  it("runs throttled calls immediately, then flushes or cancels trailing calls", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-06-10T12:00:00Z"));
    const calls: string[] = [];
    const throttled = throttle((value: string) => {
      calls.push(value);
    }, 100);

    throttled("first");
    throttled("second");
    expect(calls).toEqual(["first"]);

    vi.advanceTimersByTime(100);
    expect(calls).toEqual(["first", "second"]);

    throttled("third");
    throttled.cancel();
    vi.advanceTimersByTime(100);
    expect(calls).toEqual(["first", "second"]);
  });

  it("aggregates timesheet rows and preserves matching assignment metadata", () => {
    const technician = {
      id: "tech-1",
      first_name: "Alex",
      last_name: "Tech",
      nickname: "AT",
      department: "sound",
    };
    const timesheets: TimesheetRowWithTechnician[] = [
      {
        job_id: "job-1",
        technician_id: "tech-1",
        date: "2026-06-11",
        is_schedule_only: false,
        technician,
      },
      {
        job_id: "job-1",
        technician_id: "tech-1",
        date: "2026-06-10",
        is_schedule_only: false,
        technician,
      },
    ];
    const assignment: AssignmentLookupRow = {
      technician_id: "tech-1",
      status: "confirmed",
      sound_role: "foh",
      profiles: technician,
    };

    expect(aggregateJobTimesheets(timesheets, { "job-1": [assignment] })).toEqual({
      "job-1": [
        {
          technician_id: "tech-1",
          technician,
          dates: ["2026-06-10", "2026-06-11"],
          status: "confirmed",
          source: "assignment",
          roles: {
            sound_role: "foh",
            lights_role: undefined,
            video_role: undefined,
          },
          original_assignment: assignment,
        },
      ],
    });
  });
});
