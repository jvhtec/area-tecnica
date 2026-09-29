// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";

const { fetchJobDetails } = vi.hoisted(() => ({ fetchJobDetails: vi.fn() }));

vi.mock("@/features/festival-management/queries", () => ({ fetchFestivalJobDetails: fetchJobDetails }));
vi.mock("@/lib/errorTracking", () => ({ trackError: vi.fn() }));

import { useFestivalJobData } from "../hooks/useFestivalJobData";
import { festivalManagementKeys } from "../keys";

const details = (title: string) => ({
  job: { id: "job-1", title },
  artistCount: 2,
  festivalStageOptions: [],
  jobDates: [],
  maxStages: 3,
  venueData: {},
});

const setup = () => {
  const toast = vi.fn();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useFestivalJobData({ jobId: "job-1", toast }), { wrapper });
  return { ...rendered, toast, queryClient };
};

describe("useFestivalJobData error reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJobDetails.mockResolvedValue(details("Festival"));
  });

  it("reports a failed first load", async () => {
    fetchJobDetails.mockRejectedValue(new Error("offline"));
    const { toast } = setup();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
  });

  it("stays quiet when a background refresh (e.g. a realtime change) fails and data is on screen", async () => {
    const { result, toast, queryClient } = setup();
    await waitFor(() => expect(result.current.job?.title).toBe("Festival"));

    fetchJobDetails.mockRejectedValue(new Error("flaky connection"));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: festivalManagementKeys.jobDetails("job-1") });
    });

    expect(fetchJobDetails).toHaveBeenCalledTimes(2);
    expect(toast).not.toHaveBeenCalled();
    // The page keeps what it had.
    expect(result.current.job?.title).toBe("Festival");
  });

  it("reports a failed refresh the user asked for", async () => {
    const { result, toast } = setup();
    await waitFor(() => expect(result.current.job?.title).toBe("Festival"));

    fetchJobDetails.mockRejectedValue(new Error("boom"));
    await act(async () => {
      await result.current.fetchJobDetails();
    });

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
  });

  it("keeps an explicitly silent refresh silent", async () => {
    const { result, toast } = setup();
    await waitFor(() => expect(result.current.job?.title).toBe("Festival"));

    fetchJobDetails.mockRejectedValue(new Error("boom"));
    await act(async () => {
      await result.current.fetchJobDetails({ silent: true });
    });

    expect(toast).not.toHaveBeenCalled();
  });
});
