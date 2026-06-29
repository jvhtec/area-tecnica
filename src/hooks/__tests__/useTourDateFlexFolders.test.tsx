// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

const { createAllFoldersForJobMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  createAllFoldersForJobMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/utils/flex-folders/folders", () => ({
  createAllFoldersForJob: createAllFoldersForJobMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

import { useTourDateFlexFolders } from "@/hooks/useTourDateFlexFolders";

const createWrapper = () => {
  const queryClient = createTestQueryClient();

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useTourDateFlexFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    createAllFoldersForJobMock.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("creates Flex folders for a tour date and marks the linked job as created", async () => {
    const job = {
      id: "job-1",
      title: "Tour Stop",
      start_time: "2026-07-05T08:30:00.000Z",
      end_time: "2026-07-05T23:00:00.000Z",
      job_type: "tourdate",
    };
    const jobQuery = createMockQueryBuilder({ data: job, error: null });
    const updateQuery = createMockQueryBuilder({ data: null, error: null });
    const builders = [jobQuery, updateQuery];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "jobs") {
        return builders.shift() ?? createMockQueryBuilder({ data: null, error: null });
      }
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useTourDateFlexFolders("tour-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createIndividualFolders({ id: "tour-date-1", date: "2026-07-05" });
    });

    expect(createAllFoldersForJobMock).toHaveBeenCalledWith(
      job,
      "2026-07-05T08:30:00.000Z",
      "2026-07-05T23:00:00.000Z",
      "260705",
    );
    expect(updateQuery.update).toHaveBeenCalledWith({ flex_folders_created: true });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "job-1");
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("push", {
      body: { action: "broadcast", type: "flex.folders.created", job_id: "job-1" },
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining("Flex folders created successfully"));
  });

  it("surfaces missing-job errors through the Sonner error toast", async () => {
    const jobQuery = createMockQueryBuilder({ data: null, error: null });
    mockSupabase.from.mockReturnValue(jobQuery);

    const { result } = renderHook(() => useTourDateFlexFolders("tour-1"), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.createIndividualFolders({ id: "missing-date", date: "2026-07-05" });
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to create Flex folders: No job found for tour date missing-date",
      );
    });
  });
});
