// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { useTourRateSubscriptions } from "../useTourRateSubscriptions";

describe("useTourRateSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWrapper = () => {
    const queryClient = createTestQueryClient();

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it("uses instance-scoped realtime channel names for simultaneous hook mounts", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.123456789)
      .mockReturnValueOnce(0.987654321);

    const first = renderHook(() => useTourRateSubscriptions(), { wrapper: createWrapper() });
    const second = renderHook(() => useTourRateSubscriptions(), { wrapper: createWrapper() });

    const channelNames = mockSupabase.channel.mock.calls.map(([name]) => name);

    expect(channelNames).toHaveLength(8);
    expect(new Set(channelNames).size).toBe(8);
    expect(channelNames).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^tour-jobs-changes-[a-z0-9]+$/),
        expect.stringMatching(/^job-assignments-changes-[a-z0-9]+$/),
        expect.stringMatching(/^house-tech-rates-changes-[a-z0-9]+$/),
        expect.stringMatching(/^job-rate-extras-changes-[a-z0-9]+$/),
      ]),
    );
    expect(channelNames).not.toContain("tour-jobs-changes");

    first.unmount();
    second.unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(8);
  });
});
