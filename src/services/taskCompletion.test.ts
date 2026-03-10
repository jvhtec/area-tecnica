import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTask } from "@/test/fixtures";
import { createMockQueryBuilder, mockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { bulkCompleteTasks, completeTask, revertTask } from "./taskCompletion";

describe('taskCompletion service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('completeTask', () => {
    it('should complete a task with all metadata', async () => {
      const mockUserId = 'user-123';
      const mockTaskId = 'task-456';
      const mockTask = createTask({
        id: mockTaskId,
        task_type: 'Pesos',
        assigned_to: 'user-789',
        job_id: 'job-001',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      const fetchBuilder = createMockQueryBuilder({
        data: mockTask,
        error: null,
      });
      const updateBuilder = createMockQueryBuilder({
        data: null,
        error: null,
      });

      mockSupabase.from.mockImplementationOnce(() => fetchBuilder);
      mockSupabase.from.mockImplementationOnce(() => updateBuilder);
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await completeTask({
        taskId: mockTaskId,
        department: 'sound',
        source: 'manual',
        jobId: 'job-001',
      });

      expect(result.success).toBe(true);
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          progress: 100,
          completed_by: mockUserId,
          completion_source: 'manual',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const fetchBuilder = createMockQueryBuilder({
        data: null,
        error: { message: 'Task not found' },
      });

      mockSupabase.from.mockImplementationOnce(() => fetchBuilder);

      const result = await completeTask({
        taskId: 'task-456',
        department: 'sound',
        source: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('revertTask', () => {
    it('should clear completion metadata when reverting', async () => {
      const updateBuilder = createMockQueryBuilder({
        data: null,
        error: null,
      });

      mockSupabase.from.mockImplementationOnce(() => updateBuilder);

      const result = await revertTask({
        taskId: 'task-456',
        department: 'lights',
        newStatus: 'in_progress',
      });

      expect(result.success).toBe(true);
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_progress',
          progress: 50,
          completed_at: null,
          completed_by: null,
          completion_source: null,
        })
      );
    });
  });

  describe('bulkCompleteTasks', () => {
    it('should return a result object with expected shape', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const queryBuilder = createMockQueryBuilder({
        data: [],
        error: null,
      });

      mockSupabase.from.mockImplementationOnce(() => queryBuilder);

      const result = await bulkCompleteTasks({
        jobId: 'job-001',
        taskType: 'Pesos',
        department: 'sound',
        source: 'auto_pesos_doc',
      });

      // Verify the result contract
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completedCount');
      expect(result.success).toBe(true);
      expect(typeof result.completedCount).toBe('number');
    });

    it('should require either jobId or tourId', async () => {
      const result = await bulkCompleteTasks({
        taskType: 'Pesos',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('jobId or tourId');
    });
  });
});
