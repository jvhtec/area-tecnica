import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { deleteJobAssignments } from "./deleteJobAssignments";

describe("deleteJobAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes assignment rows scoped to the provided job", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const deleteQuery = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ delete: deleteQuery });

    await deleteJobAssignments("job-123");

    expect(mocks.from).toHaveBeenCalledWith("job_assignments");
    expect(deleteQuery).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("job_id", "job-123");
  });

  it("throws when Supabase rejects the scoped delete", async () => {
    const error = { message: "permission denied" };
    const eq = vi.fn().mockResolvedValue({ error });
    mocks.from.mockReturnValue({ delete: vi.fn(() => ({ eq })) });

    await expect(deleteJobAssignments("job-123")).rejects.toBe(error);
  });
});
