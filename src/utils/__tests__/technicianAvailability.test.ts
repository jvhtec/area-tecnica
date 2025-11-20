import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ConflictCheckResult } from "../technicianAvailability";
import { checkTimeConflictEnhanced } from "../technicianAvailability";

const mockedSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockedSupabase,
}));

const getRpcMock = () => mockedSupabase.rpc as ReturnType<typeof vi.fn>;

describe("checkTimeConflictEnhanced", () => {
  beforeEach(() => {
    getRpcMock().mockReset();
  });

  it("returns conflicts reported by the RPC", async () => {
    const rpcMock = getRpcMock();
    const conflictResult: ConflictCheckResult = {
      hasHardConflict: true,
      hasSoftConflict: false,
      hardConflicts: [
        {
          id: "job-2",
          title: "Corporate Show",
          start_time: "2024-03-01T08:00:00.000Z",
          end_time: "2024-03-01T18:00:00.000Z",
          status: "confirmed",
        },
      ],
      softConflicts: [],
      unavailabilityConflicts: [],
    };

    rpcMock.mockResolvedValue({ data: conflictResult, error: null });

    const result = await checkTimeConflictEnhanced("tech-1", "job-1", {
      targetDateIso: "2024-03-01",
      singleDayOnly: true,
    });

    expect(rpcMock).toHaveBeenCalledWith("check_technician_conflicts", expect.objectContaining({
      _technician_id: "tech-1",
      _target_job_id: "job-1",
      _target_date: "2024-03-01",
      _single_day: true,
    }));
    expect(result).toEqual(conflictResult);
  });

  it("clears conflicts once the per-day timesheet is removed", async () => {
    const rpcMock = getRpcMock();
    const conflictResult: ConflictCheckResult = {
      hasHardConflict: true,
      hasSoftConflict: false,
      hardConflicts: [
        {
          id: "job-99",
          title: "Festival Day 2",
          start_time: "2024-06-02T12:00:00.000Z",
          end_time: "2024-06-02T22:00:00.000Z",
          status: "confirmed",
        },
      ],
      softConflicts: [],
      unavailabilityConflicts: [],
    };

    const clearedResult: ConflictCheckResult = {
      hasHardConflict: false,
      hasSoftConflict: false,
      hardConflicts: [],
      softConflicts: [],
      unavailabilityConflicts: [],
    };

    rpcMock
      .mockResolvedValueOnce({ data: conflictResult, error: null })
      .mockResolvedValueOnce({ data: clearedResult, error: null });

    const withConflict = await checkTimeConflictEnhanced("tech-3", "job-55", {
      targetDateIso: "2024-06-02",
      singleDayOnly: true,
    });
    expect(withConflict.hasHardConflict).toBe(true);

    const afterRemoval = await checkTimeConflictEnhanced("tech-3", "job-55", {
      targetDateIso: "2024-06-02",
      singleDayOnly: true,
    });

    expect(afterRemoval.hasHardConflict).toBe(false);
    expect(afterRemoval.softConflicts).toHaveLength(0);
  });
});
