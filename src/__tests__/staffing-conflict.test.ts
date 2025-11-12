import { describe, expect, it } from "vitest";
import { createConflictEvaluator, partitionAssignmentsByConflict } from "../../supabase/functions/staffing-click/conflict-utils.ts";

describe("createConflictEvaluator", () => {
  it("skips only the conflicting single-day assignments", () => {
    const evaluator = createConflictEvaluator({
      currentJob: {
        id: 100,
        start_time: "2024-02-01T08:00:00.000Z",
        end_time: "2024-02-03T06:00:00.000Z",
        title: "Main Job",
      },
      confirmedAssignments: [
        { job_id: 200, assignment_date: "2024-02-01", single_day: true },
        { job_id: 201, assignment_date: "2024-02-05", single_day: true },
      ],
      otherJobs: [
        { id: 200, start_time: "2024-02-01T10:00:00.000Z", end_time: "2024-02-01T18:00:00.000Z", title: "Conflicting Job" },
        { id: 201, start_time: "2024-02-05T10:00:00.000Z", end_time: "2024-02-05T18:00:00.000Z", title: "Non overlapping" },
      ],
    });

    const conflict = evaluator("2024-02-01");
    expect(conflict?.jobId).toBe(200);
    expect(conflict?.targetDate).toBe("2024-02-01");

    const safe = evaluator("2024-02-02");
    expect(safe).toBeNull();

    const processed = partitionAssignmentsByConflict(evaluator, ["2024-02-01", "2024-02-02"]);
    expect(processed.allowed).toEqual(["2024-02-02"]);
    expect(processed.conflicts).toHaveLength(1);
    expect(processed.conflicts[0]?.jobId).toBe(200);
  });
});
