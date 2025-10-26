import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeTask, revertTask, bulkCompleteTasks } from './taskCompletion';
import { supabase } from '@/lib/supabase';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('taskCompletion service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('completeTask', () => {
    it('should complete a task with all metadata', async () => {
      const mockUserId = 'user-123';
      const mockTaskId = 'task-456';
      const mockTask = {
        id: mockTaskId,
        task_type: 'Pesos',
        assigned_to: 'user-789',
        job_id: 'job-001',
      };

      // Mock auth.getUser
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      // Mock from().select() chain
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: mockTask,
        error: null,
      });

      // Mock from().update() chain
      const mockUpdate = vi.fn().mockReturnThis();
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any) = vi.fn((table: string) => {
        if (table === 'sound_job_tasks') {
          return {
            select: mockSelect,
            eq: mockEq,
            maybeSingle: mockMaybeSingle,
            update: mockUpdate,
          };
        }
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      mockUpdate.mockReturnValue({
        eq: mockUpdateEq,
      });

      // Mock push function
      (supabase.functions.invoke as any) = vi.fn().mockResolvedValue({});

      const result = await completeTask({
        taskId: mockTaskId,
        department: 'sound',
        source: 'manual',
        jobId: 'job-001',
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          progress: 100,
          completed_by: mockUserId,
          completion_source: 'manual',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Task not found' },
      });

      (supabase.from as any) = vi.fn(() => ({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      }));

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

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
      const mockUpdate = vi.fn().mockReturnThis();
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any) = vi.fn(() => ({
        update: mockUpdate,
      }));

      mockUpdate.mockReturnValue({
        eq: mockUpdateEq,
      });

      const result = await revertTask({
        taskId: 'task-456',
        department: 'lights',
        newStatus: 'in_progress',
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
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
      // Mock auth
      (supabase.auth.getUser as any) = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock empty results (no tasks found)
      (supabase.from as any) = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      }));

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
