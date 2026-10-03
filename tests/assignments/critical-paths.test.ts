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
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  checkTimeConflictEnhancedMock: vi.fn(),
  toggleTimesheetDayMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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

import { AssignJobDialog, getAssignableJobDateKeys } from "@/components/matrix/AssignJobDialog";

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

const commandState = (dates: string[]) => ({
  exists: dates.length > 0,
  assignment: null,
  dates,
  state_token: `token-${dates.join("|")}`,
});

const committedResult = {
  ok: true,
  outcome: "committed",
  command_id: "cmd-1",
  job_id: "job-1",
  technician_id: "tech-1",
  state_token: "token-after",
  replayed: false,
  assignment: null,
  dates: [],
  side_effects: [],
  warnings: [],
};

const applyCalls = () => mockSupabase.rpc.mock.calls.filter(([name]) => name === "apply_direct_assignment");

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
  const updateBuilder = createMockQueryBuilder({ data: null, error: null });
  const deleteBuilder = createMockQueryBuilder({ data: null, error: null });

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "job_assignments") {
      return {
        select: vi.fn((columns: string) => {
          if (
            columns ===
            "job_id, technician_id, single_day, assignment_date, status, response_time"
          ) {
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
        delete: deleteBuilder.delete,
      };
    }

    if (table === "timesheets") {
      return {
        delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
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

  return {
    insertMock,
    updateMock: updateBuilder.update,
    deleteMock: deleteBuilder.delete,
  };
};

const renderAssignmentDialog = async ({
  date = new Date("2026-12-01T00:00:00Z"),
  switchToSingleDay = false,
  switchToMultiDay = false,
  existingTimesheetDates = [],
  availableJobs = [baseJob],
  submit = true,
}: {
  date?: Date;
  switchToSingleDay?: boolean;
  switchToMultiDay?: boolean;
  existingTimesheetDates?: string[];
  availableJobs?: typeof baseJob[];
  submit?: boolean;
} = {}) => {
  const user = userEvent.setup();
  if (existingTimesheetDates.length > 0) {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: any[] }) => {
      const key = queryKey[0];
      if (key === "technician") {
        return { data: defaultTechnician, isLoading: false };
      }
      if (key === "assignment-command-state") {
        return { data: commandState(existingTimesheetDates), isLoading: false };
      }
      return { data: undefined, isLoading: false };
    });
  }

  render(
    React.createElement(AssignJobDialog, {
      open: true,
      onClose: vi.fn(),
      technicianId: "tech-1",
      date,
      availableJobs,
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
  if (switchToMultiDay) {
    await user.click(screen.getByRole("tab", { name: /varios días/i }));
  }

  if (submit) {
    await user.click(screen.getByRole("button", { name: /asignar trabajo/i }));
  }

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
    if (key === "assignment-command-state") {
      return { data: commandState([]), isLoading: false };
    }
    return { data: undefined, isLoading: false };
  });

  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "manager-1" } },
    error: null,
  });
  mockSupabase.functions.invoke.mockResolvedValue({ data: null, error: null });
  mockSupabase.rpc.mockImplementation((name: string) => Promise.resolve(
    name === "apply_direct_assignment"
      ? { data: committedResult, error: null }
      : { data: { side_effects_status: "succeeded" }, error: null },
  ));

  checkTimeConflictEnhancedMock.mockResolvedValue(noConflictResult);
  toggleTimesheetDayMock.mockResolvedValue(undefined);
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

    it("creates a single-day assignment through one atomic command", async () => {
      const { insertMock, updateMock, deleteMock } = configureDialogSupabase();

      await renderAssignmentDialog({
        date: new Date("2026-12-02T00:00:00Z"),
        switchToSingleDay: true,
      });

      await waitFor(() => expect(applyCalls()).toHaveLength(1));
      expect(applyCalls()[0][1]).toMatchObject({
        p_job_id: "job-1",
        p_technician_id: "tech-1",
        p_role: "SND-FOH-R",
        p_status: "invited",
        p_coverage: "single",
        p_dates: ["2026-12-02"],
        p_conflict_policy: "reject",
        p_expected_state_token: "token-",
      });
      // Conflict enforcement, membership and schedule all live in the command.
      expect(checkTimeConflictEnhancedMock).not.toHaveBeenCalled();
      expect(toggleTimesheetDayMock).not.toHaveBeenCalled();
      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("adds a prep date to an existing scoped assignment in add mode", async () => {
      configureDialogSupabase({ existingTimesheetDates: ["2026-12-01"] });

      await renderAssignmentDialog({
        date: new Date("2026-12-02T00:00:00Z"),
        switchToSingleDay: true,
        existingTimesheetDates: ["2026-12-01"],
      });

      await waitFor(() => expect(applyCalls()).toHaveLength(1));
      expect(applyCalls()[0][1]).toMatchObject({
        p_coverage: "single",
        p_dates: ["2026-12-02"],
        p_mode: "add",
        p_expected_state_token: "token-2026-12-01",
      });
    });

    it("preselects existing timesheet dates when using multi-day add mode", async () => {
      configureDialogSupabase({ existingTimesheetDates: ["2026-12-01", "2026-12-02"] });

      await renderAssignmentDialog({
        date: new Date("2026-12-01T00:00:00Z"),
        switchToMultiDay: true,
        existingTimesheetDates: ["2026-12-01", "2026-12-02"],
        submit: false,
      });

      await waitFor(() => {
        expect(screen.getByText(/2 día\(s\) seleccionado\(s\)/i)).toBeInTheDocument();
      });
    });

    it("leaves full-job coverage to the database span", async () => {
      configureDialogSupabase();

      await renderAssignmentDialog();

      await waitFor(() => expect(applyCalls()).toHaveLength(1));
      expect(applyCalls()[0][1]).toMatchObject({ p_coverage: "full", p_dates: undefined });
    });

    it("a failed command writes nothing from the browser and keeps the dialog open", async () => {
      const { insertMock, updateMock, deleteMock } = configureDialogSupabase();
      mockSupabase.rpc.mockImplementation((name: string) => Promise.resolve(
        name === "apply_direct_assignment"
          ? { data: null, error: { code: "P0001", message: "injected schedule failure" } }
          : { data: null, error: null },
      ));

      await renderAssignmentDialog();

      await waitFor(() => expect(applyCalls()).toHaveLength(1));
      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
      expect(toggleTimesheetDayMock).not.toHaveBeenCalled();
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    });
  });
});
