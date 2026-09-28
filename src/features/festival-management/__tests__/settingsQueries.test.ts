import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockQueryBuilder,
  mockSupabase,
  resetMockSupabase,
} from "@/test/mockSupabase";

const { fetchWithOfflineFallbackMock, getOfflineFestivalContextMock } = vi.hoisted(() => ({
  fetchWithOfflineFallbackMock: vi.fn(),
  getOfflineFestivalContextMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/lib/offline", () => ({
  fetchWithOfflineFallback: fetchWithOfflineFallbackMock,
  getFestivalSnapshot: vi.fn(),
  getOfflineFestivalContext: getOfflineFestivalContextMock,
}));

import {
  fetchFestivalDateTypes,
  fetchFestivalSettings,
} from "@/features/festival-management/queries";

describe("festival settings queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    fetchWithOfflineFallbackMock.mockImplementation(async ({ online }) => ({
      data: await online(),
      fromOffline: false,
    }));
  });

  it("treats a missing settings row as defaults without writing", async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(builder);

    await expect(fetchFestivalSettings("job-1")).resolves.toBeNull();

    expect(mockSupabase.from).toHaveBeenCalledWith("festival_settings");
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("propagates settings query failures", async () => {
    const queryError = { code: "42501", message: "permission denied" };
    mockSupabase.from.mockReturnValue(
      createMockQueryBuilder({ data: null, error: queryError }),
    );

    await expect(fetchFestivalSettings("job-1")).rejects.toBe(queryError);
  });

  it("maps date types by job and date", async () => {
    mockSupabase.from.mockReturnValue(
      createMockQueryBuilder({
        data: [
          { date: "2026-07-10", type: "show" },
          { date: "2026-07-11", type: "off" },
        ],
        error: null,
      }),
    );

    await expect(fetchFestivalDateTypes("job-1")).resolves.toEqual({
      "job-1-2026-07-10": "show",
      "job-1-2026-07-11": "off",
    });
  });

  it("propagates date-type query failures instead of returning an empty map", async () => {
    const queryError = { code: "08006", message: "connection failure" };
    mockSupabase.from.mockReturnValue(
      createMockQueryBuilder({ data: null, error: queryError }),
    );

    await expect(fetchFestivalDateTypes("job-1")).rejects.toBe(queryError);
  });
});
