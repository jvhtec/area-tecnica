import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAllFoldersForJob: vi.fn(),
  invoke: vi.fn(),
  jobs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/utils/flex-folders", () => ({
  createAllFoldersForJob: mocks.createAllFoldersForJob,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: (table: string) => {
      if (table !== "jobs") throw new Error(`Unexpected table ${table}`);
      const query = {
        select: () => query,
        eq: () => query,
        order: async () => ({ data: mocks.jobs, error: null }),
      };
      return query;
    },
  },
}));

import {
  createTourDateFolders,
  createTourRootFolders,
  createTourRootFoldersManual,
} from "@/utils/tourFolders";

describe("canonical tour folder orchestration", () => {
  beforeEach(() => {
    mocks.createAllFoldersForJob.mockReset().mockResolvedValue(undefined);
    mocks.invoke.mockReset().mockResolvedValue({ data: { success: true }, error: null });
    mocks.jobs = [{
      id: "job-1",
      tour_id: "tour-1",
      tour_date_id: "date-1",
      job_type: "tourdate",
      title: "Kase-O (Madrid)",
      start_time: "2026-08-01T10:00:00.000Z",
      end_time: "2026-08-01T22:00:00.000Z",
    }];
  });

  it.each([createTourRootFolders, createTourRootFoldersManual])(
    "routes root aliases through the same authenticated server operation",
    async (createRoot) => {
      await expect(createRoot("tour-1")).resolves.toMatchObject({ success: true });
      expect(mocks.invoke).toHaveBeenCalledWith("create-flex-folders", {
        body: { operation: "tour-root", tourId: "tour-1" },
      });
    },
  );

  it("routes bulk dates through the same rich job/date creator as single dates", async () => {
    await expect(createTourDateFolders("tour-1")).resolves.toMatchObject({ success: true });
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.createAllFoldersForJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-1", tour_date_id: "date-1" }),
    );
  });

  it("passes explicit reconciliation intent to the server", async () => {
    await createTourRootFolders("tour-1", { reconcile: true });
    expect(mocks.invoke).toHaveBeenCalledWith("create-flex-folders", {
      body: { operation: "tour-root", tourId: "tour-1", reconcile: true },
    });
  });

  it("does not mark a failed server result as success", async () => {
    mocks.invoke.mockResolvedValue({ data: { success: false, error: "reconciliation required" }, error: null });
    await expect(createTourRootFolders("tour-1")).resolves.toEqual({
      success: false,
      error: "reconciliation required",
    });
  });
});
