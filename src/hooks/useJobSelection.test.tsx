// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));

import { useJobSelection } from "@/hooks/useJobSelection";

describe("useJobSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("requests ongoing/future non-terminal jobs for documentation tools", async () => {
    const jobsBuilder = createMockQueryBuilder({ data: [], error: null });
    mockSupabase.from.mockReturnValue(jobsBuilder);
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useJobSelection(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(jobsBuilder.gte).toHaveBeenCalledWith("end_time", expect.any(String));
    expect(jobsBuilder.or).toHaveBeenCalledWith(
      "status.is.null,status.in.(Tentativa,Confirmado)"
    );
    expect(jobsBuilder.in).toHaveBeenCalledWith("job_type", [
      "single",
      "festival",
      "ciclo",
      "tourdate",
    ]);
  });
});
