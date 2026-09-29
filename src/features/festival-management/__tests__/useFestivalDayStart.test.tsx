// @vitest-environment jsdom

import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchFestivalSettingsMock } = vi.hoisted(() => ({
  fetchFestivalSettingsMock: vi.fn(),
}));

vi.mock("@/features/festival-management/queries", () => ({
  fetchFestivalSettings: fetchFestivalSettingsMock,
}));

import { useFestivalDayStart } from "@/features/festival-management/useFestivalDayStart";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFestivalDayStart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not expose the default boundary while settings are unresolved", () => {
    fetchFestivalSettingsMock.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useFestivalDayStart("job-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isDayStartReady).toBe(false);
    expect(result.current.dayStartTime).toBeUndefined();
  });

  it("returns the configured normalized boundary", async () => {
    fetchFestivalSettingsMock.mockResolvedValue({ day_start_time: "06:30:00" });
    const { result } = renderHook(() => useFestivalDayStart("job-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isDayStartReady).toBe(true);
    expect(result.current.dayStartTime).toBe("06:30");
  });

  it("uses the product default only when the settings row is absent", async () => {
    fetchFestivalSettingsMock.mockResolvedValue(null);
    const { result } = renderHook(() => useFestivalDayStart("job-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isDayStartReady).toBe(true);
    expect(result.current.dayStartTime).toBe("07:00");
  });

  it("exposes query failures instead of treating them as missing settings", async () => {
    const queryError = new Error("permission denied");
    fetchFestivalSettingsMock.mockRejectedValue(queryError);
    const { result } = renderHook(() => useFestivalDayStart("job-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isDayStartReady).toBe(false);
    expect(result.current.dayStartTime).toBeUndefined();
    expect(result.current.error).toBe(queryError);
  });
});
