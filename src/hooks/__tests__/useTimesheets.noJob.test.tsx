// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { useTimesheets } from "@/hooks/useTimesheets";

describe("useTimesheets without a selected job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("clears a previous job error when the job selection is removed", async () => {
    const jobBuilder = createMockQueryBuilder({
      data: { job_type: "standard", job_date_types: [] },
      error: null,
    });
    const failingTimesheetBuilder = createMockQueryBuilder({
      data: null,
      error: { message: "temporarily unavailable" },
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "jobs") return jobBuilder;
      if (table === "timesheets") return failingTimesheetBuilder;
      return createMockQueryBuilder();
    });

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ jobId }: { jobId: string | undefined }) =>
        useTimesheets(jobId, { userRole: "technician" }),
      { initialProps: { jobId: "job-1" as string | undefined }, wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    rerender({ jobId: undefined });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.timesheets).toEqual([]);
    });
  });
});
