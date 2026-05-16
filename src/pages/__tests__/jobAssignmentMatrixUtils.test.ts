import { describe, expect, it, vi } from "vitest";
import {
  countMatrixAssignmentsForDepartment,
  shouldShowMatrixJob,
} from "../job-assignment-matrix/utils";

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

describe("job assignment matrix utils", () => {
  it("counts cancelled-job assignments only for the selected department", () => {
    const assignments: Array<{ status: string; sound_role: string | null; lights_role: string | null }> = [
      { status: "confirmed", sound_role: null, lights_role: "LGT-OP" },
      { status: "confirmed", sound_role: "SND-FOH", lights_role: null },
      { status: "declined", sound_role: "SND-MON", lights_role: null },
      { status: "confirmed", sound_role: "none", lights_role: null },
    ];

    expect(countMatrixAssignmentsForDepartment(assignments, "sound")).toBe(1);
    expect(countMatrixAssignmentsForDepartment(assignments, "lights")).toBe(1);
  });

  it("hides a cancelled job when the current department has no assignments", () => {
    const soundAssignmentCount = countMatrixAssignmentsForDepartment(
      [{ status: "confirmed", sound_role: null, lights_role: "LGT-OP" }],
      "sound",
    );

    expect(soundAssignmentCount).toBe(0);
    expect(shouldShowMatrixJob({ status: "Cancelado", _assigned_count: soundAssignmentCount })).toBe(false);
  });

  it("keeps cancelled jobs visible when the current department still has assignments", () => {
    const soundAssignmentCount = countMatrixAssignmentsForDepartment(
      [{ status: "confirmed", sound_role: "SND-FOH", lights_role: null }],
      "sound",
    );

    expect(soundAssignmentCount).toBe(1);
    expect(shouldShowMatrixJob({ status: "Cancelado", _assigned_count: soundAssignmentCount })).toBe(true);
  });

  it("keeps active jobs visible without assignments", () => {
    expect(shouldShowMatrixJob({ status: "Confirmado", _assigned_count: 0 })).toBe(true);
  });
});
