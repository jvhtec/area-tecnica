// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createUserProfile } from "@/test/fixtures";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

import { usePersonalCalendarData } from "./usePersonalCalendarData";

describe("usePersonalCalendarData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("loads only warehouse-eligible house techs for the Personal agenda", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [
        createUserProfile({
          id: "house-1",
          first_name: "Jordan",
          last_name: "House",
          role: "house_tech",
          department: "sound",
          warehouse_duty_exempt: false,
        }),
        createUserProfile({
          id: "house-exempt",
          first_name: "Excluded",
          last_name: "House",
          role: "house_tech",
          department: "lights",
          warehouse_duty_exempt: true,
        }),
      ],
      error: null,
    });
    const timesheetsBuilder = createMockQueryBuilder({ data: [], error: null });
    const availabilityBuilder = createMockQueryBuilder({ data: [], error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "timesheets") {
        return timesheetsBuilder;
      }
      if (table === "availability_schedules") {
        return availabilityBuilder;
      }

      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => usePersonalCalendarData(new Date("2026-03-15T12:00:00Z")));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.houseTechs).toEqual([
      expect.objectContaining({
        id: "house-1",
        first_name: "Jordan",
        department: "sound",
      }),
    ]);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_profile_directory", {
      p_profile_ids: null,
    });
  });
});
