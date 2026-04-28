// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const {
  useQueryMock,
  checkTimeConflictEnhancedMock,
  toggleTimesheetDayMock,
  removeTimesheetAssignmentMock,
  syncTimesheetCategoriesMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  checkTimeConflictEnhancedMock: vi.fn(),
  toggleTimesheetDayMock: vi.fn(),
  removeTimesheetAssignmentMock: vi.fn(),
  syncTimesheetCategoriesMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/utils/technicianAvailability", async () => {
  const actual = await vi.importActual<typeof import("@/utils/technicianAvailability")>(
    "@/utils/technicianAvailability",
  );
  return {
    ...actual,
    checkTimeConflictEnhanced: checkTimeConflictEnhancedMock,
  };
});

vi.mock("@/services/toggleTimesheetDay", () => ({
  toggleTimesheetDay: toggleTimesheetDayMock,
}));

vi.mock("@/services/removeTimesheetAssignment", () => ({
  removeTimesheetAssignment: removeTimesheetAssignmentMock,
}));

vi.mock("@/services/syncTimesheetCategories", () => ({
  syncTimesheetCategoriesForAssignment: syncTimesheetCategoriesMock,
}));

import { AssignJobDialog } from "@/components/matrix/AssignJobDialog";

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

async function getActualRemoveTimesheetAssignment() {
  const actual = await vi.importActual<typeof import("@/services/removeTimesheetAssignment")>(
    "@/services/removeTimesheetAssignment",
  );
  return actual.removeTimesheetAssignment;
}

async function getActualSyncTimesheetCategories() {
  const actual = await vi.importActual<typeof import("@/services/syncTimesheetCategories")>(
    "@/services/syncTimesheetCategories",
  );
  return actual.syncTimesheetCategoriesForAssignment;
}

const baseJob = {
  id: "job-1",
  title: "Main Event",
  start_time: "2026-12-01T10:00:00Z",
  end_time: "2026-12-02T02:00:00Z",
  status: "scheduled",
};

const defaultTechnician = {
  first_name: "Pat",
  last_name: "Jones",
  department: "sound",
};

const noConflictResult = {
  hasHardConflict: false,
  hasSoftConflict: false,
  hardConflicts: [],
  softConflicts: [],
  unavailabilityConflicts: [],
};

const configureDialogSupabase = ({
  existingAssignmentRow = null,
  existingTimesheetDates = [],
  startTime = baseJob.start_time,
  endTime = baseJob.end_time,
}: {
  existingAssignmentRow?: Record<string, unknown> | null;
  existingTimesheetDates?: string[];
  startTime?: string;
  endTime?: string;
} = {}) => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const upsertMock = vi.fn(() => createMockQueryBuilder({ data: null, error: null }));
  const deleteMock = vi.fn(() => createMockQueryBuilder({ data: null, error: null }));

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "job_assignments") {
      const updateBuilder = createMockQueryBuilder({ data: null, error: null });

      return {
        select: vi.fn((columns: string) => {
          if (columns === "job_id, technician_id, single_day, assignment_date, status") {
            return createMockQueryBuilder({
              data: existingAssignmentRow,
              error: null,
            });
          }

          if (columns === "job_id") {
            return createMockQueryBuilder({
              data: [{ job_id: baseJob.id }],
              error: null,
            });
          }

          return createMockQueryBuilder({ data: null, error: null });
        }),
        insert: insertMock,
        update: updateBuilder.update,
      };
    }

    if (table === "timesheets") {
      return {
        upsert: upsertMock,
        delete: deleteMock,
        select: vi.fn(() =>
          createMockQueryBuilder({
            data: existingTimesheetDates.map((date) => ({ date })),
            error: null,
          }),
        ),
      };
    }

    if (table === "jobs") {
      return {
        select: vi.fn(() =>
          createMockQueryBuilder({
            data: {
              start_time: startTime,
              end_time: endTime,
            },
            error: null,
          }),
        ),
      };
    }

    return createMockQueryBuilder();
  });

  return { insertMock, upsertMock, deleteMock };
};

const renderAssignmentDialog = async ({
  date = new Date("2026-12-01T00:00:00Z"),
  switchToSingleDay = false,
}: {
  date?: Date;
  switchToSingleDay?: boolean;
} = {}) => {
  const user = userEvent.setup();

  render(
    React.createElement(AssignJobDialog, {
      open: true,
      onClose: vi.fn(),
      technicianId: "tech-1",
      date,
      availableJobs: [baseJob],
      preSelectedJobId: baseJob.id,
    }),
  );

  await user.click(screen.getByRole("combobox"));
  await user.click(
    await screen.findByRole("option", { name: /foh\s+—\s+responsable/i }),
  );

  if (switchToSingleDay) {
    await user.click(screen.getByRole("tab", { name: /día suelto/i }));
  }

  await user.click(screen.getByRole("button", { name: /asignar trabajo/i }));

  return { user };
};

beforeEach(() => {
  resetMockSupabase();
  vi.clearAllMocks();

  useQueryMock.mockImplementation(({ queryKey }: { queryKey: any[] }) => {
    const key = queryKey[0];
    if (key === "technician") {
      return { data: defaultTechnician, isLoading: false };
    }
    if (key === "existing-timesheets") {
      return { data: [], isLoading: false };
    }
    return { data: undefined, isLoading: false };
  });

  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "manager-1" } },
    error: null,
  });
  mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: null });
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

  checkTimeConflictEnhancedMock.mockResolvedValue(noConflictResult);
  toggleTimesheetDayMock.mockResolvedValue(undefined);
  removeTimesheetAssignmentMock.mockResolvedValue({
    deleted_assignment: true,
    deleted_timesheets: 0,
  });
  syncTimesheetCategoriesMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
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

    it("returns the deleted assignment and timesheet counts from the RPC result", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ deleted_timesheets: 2, deleted_assignment: true }],
        error: null,
      });

      const removeTimesheetAssignment = await getActualRemoveTimesheetAssignment();
      const result = await removeTimesheetAssignment({
        jobId: "job-1",
        technicianId: "tech-1",
      });

      expect(result).toEqual({
        deleted_timesheets: 2,
        deleted_assignment: true,
      });
    });

    it("updates active timesheets and recalculates each affected row when roles change", async () => {
      const updateBuilder = createMockQueryBuilder({
        data: [{ id: "ts-1" }, { id: "ts-2" }],
        error: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "timesheets") {
          return updateBuilder;
        }
        return createMockQueryBuilder();
      });

      const syncTimesheetCategoriesForAssignment = await getActualSyncTimesheetCategories();
      await syncTimesheetCategoriesForAssignment({
        jobId: "job-1",
        technicianId: "tech-1",
        soundRole: "SND-FOH-R",
      });

      expect(updateBuilder.update).toHaveBeenCalledWith({ category: "responsable" });
      expect(mockSupabase.rpc).toHaveBeenNthCalledWith(1, "compute_timesheet_amount_2025", {
        _timesheet_id: "ts-1",
        _persist: true,
      });
      expect(mockSupabase.rpc).toHaveBeenNthCalledWith(2, "compute_timesheet_amount_2025", {
        _timesheet_id: "ts-2",
        _persist: true,
      });
    });

    it("skips category sync when no valid role code is provided", async () => {
      const syncTimesheetCategoriesForAssignment = await getActualSyncTimesheetCategories();
      await syncTimesheetCategoriesForAssignment({
        jobId: "job-1",
        technicianId: "tech-1",
        soundRole: "legacy-foh",
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("Coverage modes", () => {
    it("creates a single-day assignment and toggles only the selected date", async () => {
      const { insertMock, upsertMock, deleteMock } = configureDialogSupabase();

      await renderAssignmentDialog({
        date: new Date("2026-12-02T00:00:00Z"),
        switchToSingleDay: true,
      });

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            job_id: "job-1",
            technician_id: "tech-1",
            sound_role: "SND-FOH-R",
            single_day: true,
            assignment_date: "2026-12-02",
          }),
        );
      });
      expect(checkTimeConflictEnhancedMock).toHaveBeenCalledWith(
        "tech-1",
        "job-1",
        expect.objectContaining({
          targetDateIso: "2026-12-02",
          singleDayOnly: true,
          includePending: true,
        }),
      );
      expect(upsertMock).toHaveBeenCalledWith(
        [
          {
            job_id: "job-1",
            technician_id: "tech-1",
            date: "2026-12-02",
            status: "draft",
            source: "assignment-dialog",
            is_active: true,
          },
        ],
        { onConflict: "job_id,technician_id,date" },
      );
      expect(deleteMock).not.toHaveBeenCalled();
      expect(toggleTimesheetDayMock).not.toHaveBeenCalled();
    });

    it("creates full-job coverage across every job date", async () => {
      const { insertMock, upsertMock, deleteMock } = configureDialogSupabase();

      await renderAssignmentDialog();

      await waitFor(() => {
        expect(insertMock).toHaveBeenCalledWith(
          expect.objectContaining({
            job_id: "job-1",
            technician_id: "tech-1",
            sound_role: "SND-FOH-R",
            single_day: false,
            assignment_date: null,
          }),
        );
      });
      expect(checkTimeConflictEnhancedMock).toHaveBeenCalledWith(
        "tech-1",
        "job-1",
        expect.objectContaining({ includePending: true }),
      );
      expect(upsertMock).toHaveBeenCalledWith(
        [
          {
            job_id: "job-1",
            technician_id: "tech-1",
            date: "2026-12-01",
            status: "draft",
            source: "assignment-dialog",
            is_active: true,
          },
          {
            job_id: "job-1",
            technician_id: "tech-1",
            date: "2026-12-02",
            status: "draft",
            source: "assignment-dialog",
            is_active: true,
          },
        ],
        { onConflict: "job_id,technician_id,date" },
      );
      expect(deleteMock).not.toHaveBeenCalled();
      expect(toggleTimesheetDayMock).not.toHaveBeenCalled();
    });
  });
});
