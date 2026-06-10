import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteJobAssignments: vi.fn(),
  deleteJobDepartments: vi.fn(),
  deleteJobDateTypes: vi.fn(),
  deleteFestivalLogos: vi.fn(),
  deleteFlexFolders: vi.fn(),
  from: vi.fn(),
  functionsInvoke: vi.fn(),
}));

vi.mock("./deleteJobAssignments", () => ({
  deleteJobAssignments: mocks.deleteJobAssignments,
}));

vi.mock("./deleteJobDepartments", () => ({
  deleteJobDepartments: mocks.deleteJobDepartments,
}));

vi.mock("./deleteJobDateTypes", () => ({
  deleteJobDateTypes: mocks.deleteJobDateTypes,
}));

vi.mock("./deleteFestivalLogos", () => ({
  deleteFestivalLogos: mocks.deleteFestivalLogos,
}));

vi.mock("./flexFolderDeletionService", () => ({
  deleteFlexFolders: mocks.deleteFlexFolders,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
    functions: {
      invoke: mocks.functionsInvoke,
    },
  },
}));

import { deleteJobWithCleanup, deleteMultipleJobsWithCleanup } from "./jobDeletionService";

const createSupabaseFromMock = (options: {
  jobDeleteError?: unknown;
  crewCallsError?: unknown;
  rejectJobTitle?: boolean;
  crewCalls?: Array<{
    id: string;
    department: string;
    flex_crew_assignments: Array<{
      id: string;
      technician_id: string;
      flex_line_item_id?: string | null;
    }>;
  }>;
} = {}) => {
  mocks.from.mockImplementation((table: string) => {
    if (table === "jobs") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: options.rejectJobTitle
              ? vi.fn().mockRejectedValue(new Error("title lookup failed"))
              : vi.fn().mockResolvedValue({
                  data: { title: "Main Stage" },
                  error: null,
                }),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            error: options.jobDeleteError ?? null,
          }),
        })),
      };
    }

    if (table === "flex_crew_calls") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: options.crewCalls ?? [],
            error: options.crewCallsError ?? null,
          }),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });
};

describe("job deletion cleanup cascade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteJobAssignments.mockResolvedValue(undefined);
    mocks.deleteJobDepartments.mockResolvedValue(undefined);
    mocks.deleteJobDateTypes.mockResolvedValue(undefined);
    mocks.deleteFestivalLogos.mockResolvedValue(undefined);
    mocks.deleteFlexFolders.mockResolvedValue(undefined);
    mocks.functionsInvoke.mockResolvedValue({ data: null, error: null });
    createSupabaseFromMock();
  });

  it("removes Flex crew assignments, dependent rows, Flex folders, then the job before broadcasting", async () => {
    createSupabaseFromMock({
      crewCalls: [
        {
          id: "crew-1",
          department: "sound",
          flex_crew_assignments: [
            { id: "assignment-1", technician_id: "tech-1", flex_line_item_id: "line-1" },
            { id: "assignment-2", technician_id: "tech-2", flex_line_item_id: "line-2" },
          ],
        },
      ],
    });

    await deleteJobWithCleanup("job-123");

    expect(mocks.functionsInvoke).toHaveBeenCalledWith("manage-flex-crew-assignments", {
      body: {
        job_id: "job-123",
        technician_id: "tech-1",
        department: "sound",
        action: "remove",
      },
    });
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("manage-flex-crew-assignments", {
      body: {
        job_id: "job-123",
        technician_id: "tech-2",
        department: "sound",
        action: "remove",
      },
    });
    expect(mocks.deleteJobAssignments).toHaveBeenCalledWith("job-123");
    expect(mocks.deleteJobDepartments).toHaveBeenCalledWith("job-123");
    expect(mocks.deleteJobDateTypes).toHaveBeenCalledWith("job-123");
    expect(mocks.deleteFestivalLogos).toHaveBeenCalledWith("job-123");
    expect(mocks.deleteFlexFolders).toHaveBeenCalledWith("job-123");
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("push", {
      body: {
        action: "broadcast",
        type: "job.deleted",
        job_id: "job-123",
        title: "Main Stage",
      },
    });

    expect(mocks.deleteJobAssignments.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteJobDepartments.mock.invocationCallOrder[0],
    );
    expect(mocks.deleteJobDepartments.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteJobDateTypes.mock.invocationCallOrder[0],
    );
    expect(mocks.deleteJobDateTypes.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFestivalLogos.mock.invocationCallOrder[0],
    );
    expect(mocks.deleteFestivalLogos.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteFlexFolders.mock.invocationCallOrder[0],
    );
  });

  it("throws and skips the broadcast when final job deletion fails", async () => {
    const jobDeleteError = { message: "delete failed" };
    createSupabaseFromMock({ jobDeleteError });

    await expect(deleteJobWithCleanup("job-123")).rejects.toBe(jobDeleteError);

    expect(mocks.deleteJobAssignments).toHaveBeenCalledWith("job-123");
    expect(mocks.functionsInvoke).not.toHaveBeenCalledWith(
      "push",
      expect.anything(),
    );
  });

  it("continues when optional Flex crew cleanup and push notification fail", async () => {
    createSupabaseFromMock({
      rejectJobTitle: true,
      crewCalls: [
        {
          id: "crew-1",
          department: "sound",
          flex_crew_assignments: [
            { id: "assignment-1", technician_id: "tech-1" },
            { id: "assignment-2", technician_id: "tech-2" },
          ],
        },
      ],
    });
    mocks.functionsInvoke.mockImplementation((name: string, args: unknown) => {
      if (name === "manage-flex-crew-assignments") {
        const body = (args as { body?: { technician_id?: string } }).body;
        if (body?.technician_id === "tech-1") {
          return Promise.resolve({ data: null, error: { message: "Flex remove failed" } });
        }
        throw new Error("Flex function unavailable");
      }
      if (name === "push") {
        throw new Error("push unavailable");
      }
      return Promise.resolve({ data: null, error: null });
    });

    await expect(deleteJobWithCleanup("job-123")).resolves.toBeUndefined();

    expect(mocks.deleteFlexFolders).toHaveBeenCalledWith("job-123");
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("push", {
      body: {
        action: "broadcast",
        type: "job.deleted",
        job_id: "job-123",
        title: null,
      },
    });
  });

  it("continues when crew call lookup fails before local cascade cleanup", async () => {
    createSupabaseFromMock({
      crewCallsError: { message: "crew call lookup failed" },
    });

    await deleteJobWithCleanup("job-123");

    expect(mocks.deleteJobAssignments).toHaveBeenCalledWith("job-123");
    expect(mocks.deleteFlexFolders).toHaveBeenCalledWith("job-123");
  });

  it("deletes multiple jobs sequentially", async () => {
    await deleteMultipleJobsWithCleanup(["job-1", "job-2"]);

    expect(mocks.deleteJobAssignments).toHaveBeenNthCalledWith(1, "job-1");
    expect(mocks.deleteJobAssignments).toHaveBeenNthCalledWith(2, "job-2");
    expect(mocks.deleteJobAssignments.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteJobAssignments.mock.invocationCallOrder[1],
    );
  });
});
