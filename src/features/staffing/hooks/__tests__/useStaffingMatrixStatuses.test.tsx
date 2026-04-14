// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { useStaffingMatrixStatuses } from "../useStaffingMatrixStatuses";

describe("useStaffingMatrixStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  const createWrapper = () => {
    const queryClient = createTestQueryClient();

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it("loads staffing statuses with one query per source instead of batch cross-products", async () => {
    const technicianIds = ["tech-1", "tech-2"];
    const jobs = [
      { id: "job-1", start_time: "2025-03-01T10:00:00Z", end_time: "2025-03-01T18:00:00Z" },
      { id: "job-2", start_time: "2025-03-02T10:00:00Z", end_time: "2025-03-02T18:00:00Z" },
    ];
    const dates = [new Date("2025-03-01T00:00:00Z")];
    const jobIds = jobs.map((job) => job.id);

    const rpcBuilder = createMockQueryBuilder({
      data: [
        {
          job_id: "job-1",
          profile_id: "tech-1",
          availability_status: "pending",
          offer_status: null,
        },
      ],
      error: null,
    });
    const requestsBuilder = createMockQueryBuilder({
      data: [
        {
          job_id: "job-1",
          profile_id: "tech-1",
          phase: "availability",
          status: "pending",
          updated_at: "2025-03-01T09:00:00Z",
          single_day: true,
          target_date: "2025-03-01",
          created_at: "2025-03-01T08:00:00Z",
          requested_by: "manager-1",
        },
      ],
      error: null,
    });

    mockSupabase.rpc.mockReturnValue(rpcBuilder);
    mockSupabase.from.mockReturnValue(requestsBuilder);

    const { result } = renderHook(() => useStaffingMatrixStatuses(technicianIds, jobs, dates), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.byJob.get("job-1-tech-1")).toEqual({
        availability_status: "requested",
        offer_status: null,
      });
    });

    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_assignment_matrix_staffing");
    expect(rpcBuilder.in).toHaveBeenCalledWith("job_id", jobIds);
    expect(rpcBuilder.in).toHaveBeenCalledWith("profile_id", technicianIds);

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("staffing_requests");
    expect(requestsBuilder.in).toHaveBeenCalledWith("profile_id", technicianIds);
    expect(requestsBuilder.in).toHaveBeenCalledWith("job_id", jobIds);
    expect(result.current.data?.byDate.get("tech-1-2025-03-01")).toMatchObject({
      availability_status: "requested",
      availability_job_id: "job-1",
    });
  });
});
