// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const realtimeMocks = vi.hoisted(() => ({
  manualRefreshMock: vi.fn(),
  useRealtimeQueryMock: vi.fn(),
}));

const flexMocks = vi.hoisted(() => ({
  manageFlexCrewAssignmentMock: vi.fn(),
  useFlexCrewAssignmentsMock: vi.fn(),
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

vi.mock("@/hooks/useFlexCrewAssignments", () => ({
  useFlexCrewAssignments: flexMocks.useFlexCrewAssignmentsMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastMocks.errorMock,
    success: toastMocks.successMock,
  },
}));

import {
  buildAssignmentInsertPayload,
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
  flexMocks.useFlexCrewAssignmentsMock.mockReturnValue({
    manageFlexCrewAssignment: flexMocks.manageFlexCrewAssignmentMock,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('buildAssignmentInsertPayload', () => {
  it('normalizes role values and defaults single-day fields', () => {
    const fixedDate = new Date('2025-03-01T12:00:00Z');
    vi.useFakeTimers().setSystemTime(fixedDate);

    const payload = buildAssignmentInsertPayload(
      'job-1',
      'tech-1',
      'none',
      'lx-main',
      'manager-1',
      undefined
    );

    expect(payload).toMatchObject({
      job_id: 'job-1',
      technician_id: 'tech-1',
      sound_role: null,
      lights_role: 'lx-main',
      assigned_by: 'manager-1',
      single_day: false,
      assignment_date: null,
    });
    expect(payload.assigned_at).toBe(fixedDate.toISOString());
  });

  it('captures single-day metadata when provided', () => {
    const fixedDate = new Date('2025-04-15T08:30:00Z');
    vi.useFakeTimers().setSystemTime(fixedDate);

    const payload = buildAssignmentInsertPayload(
      'job-2',
      'tech-99',
      'mix',
      'none',
      'manager-2',
      {
        singleDay: true,
        singleDayDate: '2025-04-20',
      }
    );

    expect(payload).toMatchObject({
      job_id: 'job-2',
      technician_id: 'tech-99',
      sound_role: 'mix',
      lights_role: null,
      assigned_by: 'manager-2',
      single_day: true,
      assignment_date: '2025-04-20',
    });
    expect(payload.assigned_at).toBe(fixedDate.toISOString());
  });

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

describe("useJobAssignmentsRealtime optimistic cache rollback", () => {
  it("restores the jobs cache when adding an assignment fails", async () => {
    const queryClient = createRollbackQueryClient();
    const previousJobs = [
      { id: "job-1", job_assignments: [] },
      { id: "job-2", job_assignments: [{ technician_id: "other-tech" }] },
    ];
    queryClient.setQueryData(["jobs"], previousJobs);

    const insertBuilder = createMockQueryBuilder({
      data: null,
      error: { message: "insert failed" },
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "job_assignments") return insertBuilder;
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useJobAssignmentsRealtime("job-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.addAssignment("tech-1", "foh", "none");
    });

    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      job_id: "job-1",
      technician_id: "tech-1",
      sound_role: "foh",
    }));
    expect(queryClient.getQueryData(["jobs"])).toEqual(previousJobs);
    expect(toastMocks.errorMock).toHaveBeenCalledWith("Failed to add assignment");
  });

  it("restores the jobs cache when removing an assignment fails", async () => {
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

    const timesheetsDeleteBuilder = createMockQueryBuilder({ data: null, error: null });
    const assignmentDeleteBuilder = createMockQueryBuilder({
      data: null,
      error: { message: "delete failed" },
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "timesheets") return timesheetsDeleteBuilder;
      if (table === "job_assignments") return assignmentDeleteBuilder;
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useJobAssignmentsRealtime("job-1"), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.removeAssignment("tech-1", {
        technician_id: "tech-1",
        sound_role: "foh",
        lights_role: null,
        video_role: null,
      });
    });

    expect(timesheetsDeleteBuilder.delete).toHaveBeenCalled();
    expect(assignmentDeleteBuilder.delete).toHaveBeenCalled();
    expect(queryClient.getQueryData(["jobs"])).toEqual(previousJobs);
    expect(toastMocks.errorMock).toHaveBeenCalledWith("Failed to remove assignment");
  });
});
