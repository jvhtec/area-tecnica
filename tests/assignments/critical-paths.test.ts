import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { getAssignableJobDateKeys } from "@/features/matrix-v2/jobDays";

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

async function getActualConflictCheck() {
  const actual = await vi.importActual<typeof import("@/utils/technicianAvailability")>(
    "@/utils/technicianAvailability",
  );
  return actual.checkTimeConflictEnhanced;
}

async function getActualToggleTimesheetDay() {
  const actual = await vi.importActual<typeof import("@/services/toggleTimesheetDay")>(
    "@/services/toggleTimesheetDay",
  );
  return actual.toggleTimesheetDay;
}

const baseJob = {
  id: "job-1",
  title: "Main Event",
  start_time: "2026-12-01T10:00:00Z",
  end_time: "2026-12-02T02:00:00Z",
  status: "scheduled",
};

const noConflictResult = {
  hasHardConflict: false,
  hasSoftConflict: false,
  hardConflicts: [],
  softConflicts: [],
  unavailabilityConflicts: [],
};

beforeEach(() => {
  resetMockSupabase();
  vi.clearAllMocks();
});

describe("Assignments Critical Paths", () => {
  describe("Conflict detection", () => {
    it("surfaces hard, soft, and unavailability conflicts from the RPC payload", async () => {
      const rpcResult = {
        hasHardConflict: true,
        hasSoftConflict: true,
        hardConflicts: [{ id: "job-hard", title: "Confirmed Clash" }],
        softConflicts: [{ id: "job-soft", title: "Pending Clash" }],
        unavailabilityConflicts: [{ date: "2026-12-01", reason: "Unavailable", source: "manual" }],
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: rpcResult,
        error: null,
      });

      const checkTimeConflictEnhanced = await getActualConflictCheck();
      const result = await checkTimeConflictEnhanced("tech-1", "job-1", {
        targetDateIso: "2026-12-01",
        singleDayOnly: true,
        includePending: true,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("check_technician_conflicts", {
        _technician_id: "tech-1",
        _target_job_id: "job-1",
        _target_date: "2026-12-01",
        _single_day: true,
        _include_pending: true,
      });
      expect(result).toEqual(rpcResult);
    });

    it("falls back to an empty conflict result when the RPC errors", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "rpc failed" },
      });

      const checkTimeConflictEnhanced = await getActualConflictCheck();
      const result = await checkTimeConflictEnhanced("tech-1", "job-1");

      expect(result).toEqual(noConflictResult);
    });
  });

  describe("Timesheet side effects", () => {
    it("toggles a timesheet day with the matrix defaults", async () => {
      const toggleTimesheetDay = await getActualToggleTimesheetDay();
      await toggleTimesheetDay({
        jobId: "job-1",
        technicianId: "tech-1",
        dateIso: "2026-12-01",
        present: true,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith("toggle_timesheet_day", {
        p_job_id: "job-1",
        p_technician_id: "tech-1",
        p_date: "2026-12-01",
        p_present: true,
        p_source: "matrix",
      });
    });
  });

  describe("Coverage modes", () => {
    it("includes prep days before the tour date in assignable picker dates", () => {
      expect(
        getAssignableJobDateKeys({
          ...baseJob,
          start_time: "2026-06-11T08:00:00Z",
          end_time: "2026-06-11T20:00:00Z",
          job_date_types: [
            { date: "2026-06-08", type: "prep_day" },
            { date: "2026-06-09", type: "prep_day" },
            { date: "2026-06-10", type: "travel" },
          ],
        }),
      ).toEqual(["2026-06-08", "2026-06-09", "2026-06-11"]);
    });
  });
});
