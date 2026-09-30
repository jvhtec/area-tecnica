// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";

const mocks = vi.hoisted(() => ({ fetchShiftsForDate: vi.fn(), useRealtimeSubscription: vi.fn() }));

vi.mock("../api", () => ({ fetchShiftsForDate: mocks.fetchShiftsForDate }));
vi.mock("@/hooks/useRealtimeSubscription", () => ({ useRealtimeSubscription: mocks.useRealtimeSubscription }));

import { useFestivalShifts } from "../hooks/useFestivalShifts";
import { festivalShiftKeys } from "../keys";

const setup = (props = { jobId: "job-1", selectedDate: "2026-07-01" }) => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook((p) => useFestivalShifts(p), { wrapper, initialProps: props }) };
};

describe("useFestivalShifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchShiftsForDate.mockResolvedValue([{ id: "s1", assignments: [] }]);
  });

  it("loads the day's shifts", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.shifts).toHaveLength(1));
    expect(mocks.fetchShiftsForDate).toHaveBeenCalledWith("job-1", "2026-07-01");
  });

  it("stays live: subscribes to the festival's shifts and to shift assignments, both refreshing its query", () => {
    setup();
    const [options] = mocks.useRealtimeSubscription.mock.calls[0];
    expect(options).toEqual([
      { table: "festival_shifts", filter: "job_id=eq.job-1", queryKey: festivalShiftKeys.job("job-1") },
      { table: "festival_shift_assignments", queryKey: festivalShiftKeys.job("job-1") },
    ]);
  });

  it("does not subscribe or load without a festival or a date", () => {
    const { result } = setup({ jobId: "", selectedDate: "" });
    expect(mocks.useRealtimeSubscription.mock.calls[0][0]).toEqual([]);
    expect(mocks.fetchShiftsForDate).not.toHaveBeenCalled();
    expect(result.current.shifts).toEqual([]);
  });

  it("reports a failed load as an error, not as an empty day", async () => {
    mocks.fetchShiftsForDate.mockRejectedValue(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });
    expect(result.current.shifts).toEqual([]);
  });

  it("refreshes after a write and hands back the new list", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.shifts).toHaveLength(1));
    mocks.fetchShiftsForDate.mockResolvedValue([{ id: "s1", assignments: [] }, { id: "s2", assignments: [] }]);

    await act(() => result.current.invalidate());

    await waitFor(() => expect(result.current.shifts).toHaveLength(2));
  });
});
