// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthState } from "@/test/fixtures";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const { useOptimizedAuthMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { useJobExpenses } from "../useJobExpenses";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useJobExpenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useOptimizedAuthMock.mockReturnValue(
      createAuthState({
        user: { id: "manager-1", email: "manager@example.com" },
        userRole: "management",
      }),
    );
  });

  it("filters to the current user when self-service mode is enabled", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    mockSupabase.from.mockReturnValue(builder);

    const { result } = renderHook(
      () => useJobExpenses("job-1", { selfServiceOnly: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(builder.eq).toHaveBeenCalledWith("job_id", "job-1");
    expect(builder.eq).toHaveBeenCalledWith("technician_id", "manager-1");
  });

  it("keeps manager review mode unfiltered by technician by default", async () => {
    const builder = createMockQueryBuilder({ data: [], error: null });
    mockSupabase.from.mockReturnValue(builder);

    const { result } = renderHook(
      () => useJobExpenses("job-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(builder.eq).toHaveBeenCalledWith("job_id", "job-1");
    expect(builder.eq).not.toHaveBeenCalledWith("technician_id", "manager-1");
  });
});
