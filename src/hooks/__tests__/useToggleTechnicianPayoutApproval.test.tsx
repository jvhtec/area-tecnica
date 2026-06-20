// @vitest-environment jsdom
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { useToggleTechnicianPayoutApproval } from "@/hooks/useToggleTechnicianPayoutApproval";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useToggleTechnicianPayoutApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("only updates active timesheets so voided rows never carry approval", async () => {
    const builder = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(builder);

    const { result } = renderHook(() => useToggleTechnicianPayoutApproval(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      jobId: "job-1",
      technicianId: "tech-1",
      approved: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSupabase.from).toHaveBeenCalledWith("timesheets");
    expect(builder.update).toHaveBeenCalledWith({ approved_by_manager: true });
    expect(builder.eq).toHaveBeenCalledWith("job_id", "job-1");
    expect(builder.eq).toHaveBeenCalledWith("technician_id", "tech-1");
    // Regression guard: voided timesheets (is_active = false) are excluded from
    // payout math and must never be written with an approval flag.
    expect(builder.eq).toHaveBeenCalledWith("is_active", true);
  });
});
