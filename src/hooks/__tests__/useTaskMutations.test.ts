import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/services/taskCompletion", () => ({
  completeTask: vi.fn(),
  revertTask: vi.fn(),
}));

import { useTaskMutations } from "@/hooks/useTaskMutations";

describe("useTaskMutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("creates tasks only for normalized assignees without an existing task", async () => {
    const existingQuery = createMockQueryBuilder({
      data: [{ assigned_to: "tech-1" }],
      error: null,
    });
    const insertQuery = createMockQueryBuilder({
      data: [{ id: "task-2", assigned_to: "tech-2" }],
      error: null,
    });
    const taskBuilders = [existingQuery, insertQuery];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "sound_job_tasks") {
        return taskBuilders.shift() ?? createMockQueryBuilder({ data: [], error: null });
      }
      return createMockQueryBuilder();
    });

    const { createTaskForUsers } = useTaskMutations("job-1", "sound");
    const result = await createTaskForUsers("prep", [" tech-1 ", "tech-2", "tech-2", ""], "2026-02-01");

    expect(existingQuery.in).toHaveBeenCalledWith("assigned_to", ["tech-1", "tech-2"]);
    expect(existingQuery.eq).toHaveBeenCalledWith("job_id", "job-1");
    expect(insertQuery.insert).toHaveBeenCalledWith([
      {
        task_type: "prep",
        status: "not_started",
        progress: 0,
        job_id: "job-1",
        due_at: "2026-02-01",
        assigned_to: "tech-2",
      },
    ]);
    expect(result).toEqual({
      created: [{ id: "task-2", assigned_to: "tech-2" }],
      skippedAssigneeIds: ["tech-1"],
    });
  });

  it("normalizes tracked updates before storing and broadcasting task changes", async () => {
    const existingTaskQuery = createMockQueryBuilder({
      data: {
        id: "task-1",
        task_type: "prep",
        assigned_to: "tech-2",
        job_id: "job-1",
        tour_id: null,
        due_at: "2026-01-01T00:00:00.000Z",
        priority: "normal",
      },
      error: null,
    });
    const updateQuery = createMockQueryBuilder({ data: null, error: null });
    const taskBuilders = [existingTaskQuery, updateQuery];

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "manager-1" } },
      error: null,
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "sound_job_tasks") {
        return taskBuilders.shift() ?? createMockQueryBuilder({ data: null, error: null });
      }
      return createMockQueryBuilder();
    });

    const { updateTask } = useTaskMutations("job-1", "sound");
    await updateTask("task-1", {
      due_at: "2026-01-02",
      priority: "high",
      notes: undefined,
    });

    expect(updateQuery.update).toHaveBeenCalledWith({
      due_at: "2026-01-02T00:00:00.000Z",
      priority: "high",
    });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("push", {
      body: {
        action: "broadcast",
        type: "task.updated",
        job_id: "job-1",
        tour_id: undefined,
        recipient_id: "tech-2",
        user_ids: ["manager-1", "tech-2"],
        task_id: "task-1",
        task_type: "prep",
        changes: {
          due_at: {
            from: "2026-01-01T00:00:00.000Z",
            to: "2026-01-02T00:00:00.000Z",
          },
          priority: {
            from: "normal",
            to: "high",
          },
        },
      },
    });
  });
});
