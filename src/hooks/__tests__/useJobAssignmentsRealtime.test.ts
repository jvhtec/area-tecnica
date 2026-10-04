// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const realtimeMocks = vi.hoisted(() => ({
  manualRefreshMock: vi.fn(),
  useRealtimeQueryMock: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  errorMock: vi.fn(),
  successMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/useRealtimeQuery", () => ({
  useRealtimeQuery: realtimeMocks.useRealtimeQueryMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastMocks.errorMock,
    success: toastMocks.successMock,
  },
}));

import {
  mergeTimesheetAssignmentsForDisplay,
  useJobAssignmentsRealtime,
} from "@/hooks/useJobAssignmentsRealtime";

const createRollbackQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });

const createWrapper = (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

beforeEach(() => {
  vi.clearAllMocks();
  resetMockSupabase();
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "manager-1" } },
    error: null,
  });
  realtimeMocks.useRealtimeQueryMock.mockReturnValue({
    data: [],
    isLoading: false,
    manualRefresh: realtimeMocks.manualRefreshMock,
    isRefreshing: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mergeTimesheetAssignmentsForDisplay', () => {
  it('merges timesheet presence with assignment metadata and sorted work dates', () => {
    const assignments = mergeTimesheetAssignmentsForDisplay({
      jobId: 'job-1',
      timesheets: [
        {
          technician_id: 'tech-1',
          date: '2026-07-06',
          profiles: [{ first_name: 'Timesheet', last_name: 'Profile', email: 'timesheet@example.com', department: 'sound' }],
        },
        {
          technician_id: 'tech-1',
          date: '2026-07-05',
          profiles: null,
        },
        {
          technician_id: 'tech-2',
          date: '2026-07-05',
        },
      ],
      assignmentRows: [
        {
          id: 'assignment-1',
          technician_id: 'tech-1',
          sound_role: 'foh',
          lights_role: null,
          video_role: null,
          production_role: null,
          status: 'confirmed',
          single_day: false,
          assignment_date: null,
          assigned_at: '2026-07-01T10:00:00.000Z',
          assigned_by: 'manager-1',
          profiles: { first_name: 'Assigned', last_name: 'Profile', email: 'assigned@example.com', department: 'sound' },
        },
      ],
    });

    expect(assignments[0]).toMatchObject({
      id: 'assignment-1',
      job_id: 'job-1',
      technician_id: 'tech-1',
      sound_role: 'foh',
      status: 'confirmed',
      profiles: {
        first_name: 'Assigned',
        last_name: 'Profile',
        email: 'assigned@example.com',
        department: 'sound',
      },
      _timesheet_dates: ['2026-07-05', '2026-07-06'],
    });
    expect(assignments[1]).toMatchObject({
      id: 'timesheet-job-1-tech-2',
      technician_id: 'tech-2',
      profiles: {
        first_name: '',
        last_name: '',
        email: '',
        department: '',
      },
      _timesheet_dates: ['2026-07-05'],
    });
  });
});

describe("useJobAssignmentsRealtime assignment commands", () => {
  const STATES = {
    job_id: "job-1",
    absent_state_token: "absent-token",
    states: { "tech-1": "tech-1-token" },
  };

  /** Job state RPC answers; every command RPC answers with `commandResponse`. */
  const configureRpc = (commandResponse: { data: unknown; error: unknown }) => {
    mockSupabase.rpc.mockImplementation((name: string) => Promise.resolve(
      name === "get_job_assignment_command_states" ? { data: STATES, error: null } : commandResponse,
    ));
  };

  const renderManaged = async (queryClient: QueryClient) => {
    const rendered = renderHook(() => useJobAssignmentsRealtime("job-1", { manageCommands: true }), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(rendered.result.current.expectedStateTokenFor("tech-1")).toBe("tech-1-token"));
    return rendered;
  };

  it("adds through the atomic command with the loaded state and restores the jobs cache when it fails", async () => {
    const queryClient = createRollbackQueryClient();
    const previousJobs = [
      { id: "job-1", job_assignments: [] },
      { id: "job-2", job_assignments: [{ technician_id: "other-tech" }] },
    ];
    queryClient.setQueryData(["jobs"], previousJobs);
    configureRpc({ data: null, error: { code: "42501", message: "permission denied" } });

    const { result } = await renderManaged(queryClient);
    await act(async () => {
      await result.current.addAssignment("tech-2", "SND-FOH-R", "none");
    });

    // Membership + full schedule in one command; no direct table insert. A
    // technician new to the job is guarded by the absent-pair token.
    expect(mockSupabase.rpc).toHaveBeenCalledWith("apply_direct_assignment", expect.objectContaining({
      p_job_id: "job-1",
      p_technician_id: "tech-2",
      p_role: "SND-FOH-R",
      p_coverage: "full",
      p_mode: "add",
      p_expected_state_token: "absent-token",
      p_conflict_policy: "reject",
      p_source: "department-dialog",
    }));
    expect(mockSupabase.from).not.toHaveBeenCalledWith("job_assignments");
    expect(queryClient.getQueryData(["jobs"])).toEqual(previousJobs);
    expect(toastMocks.errorMock).toHaveBeenCalledWith("No tienes permiso para modificar asignaciones.");
  });

  it("reloads the state tokens when the realtime list shows a change made elsewhere", async () => {
    const queryClient = createRollbackQueryClient();
    configureRpc({ data: null, error: null });
    const { rerender } = await renderManaged(queryClient);
    const stateLoads = () => mockSupabase.rpc.mock.calls.filter(([name]) => name === "get_job_assignment_command_states").length;
    expect(stateLoads()).toBe(1);

    // Same data again: no reload.
    rerender();
    expect(stateLoads()).toBe(1);

    realtimeMocks.useRealtimeQueryMock.mockReturnValue({
      data: [{ technician_id: "tech-1", status: "confirmed", sound_role: "SND-FOH-R", lights_role: null,
        video_role: null, production_role: null, _timesheet_dates: ["2026-12-01"] }],
      isLoading: false,
      manualRefresh: realtimeMocks.manualRefreshMock,
      isRefreshing: false,
    });
    rerender();
    await waitFor(() => expect(stateLoads()).toBe(2));
  });

  it("never widens a single-day request without its day to the whole job", async () => {
    const queryClient = createRollbackQueryClient();
    configureRpc({ data: null, error: null });
    const { result } = await renderManaged(queryClient);

    await act(async () => {
      await result.current.addAssignment("tech-2", "SND-FOH-R", "none", { singleDay: true, singleDayDate: null });
    });

    expect(mockSupabase.rpc).not.toHaveBeenCalledWith("apply_direct_assignment", expect.anything());
    expect(toastMocks.errorMock).toHaveBeenCalledWith("Selecciona el día de la asignación");
  });

  it("removes through the atomic command with the technician's token and restores the cache when it fails", async () => {
    const queryClient = createRollbackQueryClient();
    const previousJobs = [
      {
        id: "job-1",
        job_assignments: [
          {
            technician_id: "tech-1",
            sound_role: "foh",
            lights_role: null as string | null,
            video_role: null as string | null,
          },
        ],
      },
    ];
    queryClient.setQueryData(["jobs"], previousJobs);
    configureRpc({ data: null, error: { code: "42501", message: "permission denied" } });

    const { result } = await renderManaged(queryClient);
    await act(async () => {
      await result.current.removeAssignment("tech-1");
    });

    // One atomic command; no browser-side table deletes.
    expect(mockSupabase.rpc).toHaveBeenCalledWith("remove_direct_assignment", expect.objectContaining({
      p_job_id: "job-1", p_technician_id: "tech-1", p_expected_state_token: "tech-1-token", p_source: "job-card",
    }));
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["jobs"])).toEqual(previousJobs);
    expect(toastMocks.errorMock).toHaveBeenCalledWith("No tienes permiso para modificar asignaciones.");
  });

  it("fails closed without loaded state: read-only views cannot mutate", async () => {
    const queryClient = createRollbackQueryClient();
    configureRpc({ data: null, error: null });
    const { result } = renderHook(() => useJobAssignmentsRealtime("job-1"), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.removeAssignment("tech-1");
      await result.current.addAssignment("tech-2", "SND-FOH-R", "none");
    });

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(toastMocks.errorMock).toHaveBeenCalledWith(expect.stringMatching(/no se pudo cargar el estado actual/i));
  });
});
