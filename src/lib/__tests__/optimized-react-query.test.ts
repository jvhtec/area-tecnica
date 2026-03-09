import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  createOptimizedQueryClient,
  updateQueryClientForRole,
  createQueryKey,
  optimizedInvalidation,
} from '@/lib/optimized-react-query';

describe('optimized-react-query', () => {
  describe('createOptimizedQueryClient', () => {
    it('creates a QueryClient with optimized defaults for leader', () => {
      const queryClient = createOptimizedQueryClient(true);
      expect(queryClient).toBeInstanceOf(QueryClient);

      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(2 * 60 * 1000); // 2 minutes
      expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000); // 5 minutes
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
      expect(defaultOptions.queries?.refetchOnMount).toBe(true);
    });

    it('creates a QueryClient with optimized defaults for follower', () => {
      const queryClient = createOptimizedQueryClient(false);
      expect(queryClient).toBeInstanceOf(QueryClient);

      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);
      expect(defaultOptions.queries?.refetchOnMount).toBe(false);
    });

    it('deduplicates concurrent queries with same key', async () => {
      const queryClient = createOptimizedQueryClient(true);

      let callCount = 0;
      const queryFn = vi.fn(async () => {
        callCount++;
        return { data: 'test' };
      });

      // Make two concurrent queries with the same key
      const promise1 = queryClient.fetchQuery({ queryKey: ['test'], queryFn });
      const promise2 = queryClient.fetchQuery({ queryKey: ['test'], queryFn });

      await Promise.all([promise1, promise2]);

      // Should only call queryFn once due to deduplication
      expect(callCount).toBe(1);
    });
  });

  describe('updateQueryClientForRole', () => {
    it('updates query client options when role changes', () => {
      const queryClient = createOptimizedQueryClient(true);

      // Initially leader
      let options = queryClient.getDefaultOptions();
      expect(options.queries?.refetchOnWindowFocus).toBe(true);

      // Update to follower
      updateQueryClientForRole(queryClient, false);
      options = queryClient.getDefaultOptions();
      expect(options.queries?.refetchOnWindowFocus).toBe(false);
    });
  });

  describe('createQueryKey', () => {
    describe('tours', () => {
      it('creates all tours key', () => {
        expect(createQueryKey.tours.all).toEqual(['tours']);
      });

      it('creates byUser key', () => {
        expect(createQueryKey.tours.byUser('user-123')).toEqual(['tours', 'my', 'user-123']);
      });
    });

    describe('pendingTasks', () => {
      it('creates all pending tasks key', () => {
        expect(createQueryKey.pendingTasks.all).toEqual(['pending-tasks']);
      });

      it('creates byUser key with department', () => {
        expect(createQueryKey.pendingTasks.byUser('user-123', 'sound')).toEqual([
          'pending-tasks',
          'user-123',
          'sound',
        ]);
      });

      it('creates byUser key without department', () => {
        expect(createQueryKey.pendingTasks.byUser('user-123', null)).toEqual([
          'pending-tasks',
          'user-123',
          null,
        ]);
      });
    });

    describe('jobs', () => {
      it('creates all jobs key', () => {
        expect(createQueryKey.jobs.all).toEqual(['jobs']);
      });

      it('creates list key with filters', () => {
        const filters = { status: 'active', limit: 10 };
        expect(createQueryKey.jobs.list(filters)).toEqual(['jobs', 'list', filters]);
      });

      it('creates detail key', () => {
        expect(createQueryKey.jobs.detail('job-123')).toEqual(['jobs', 'detail', 'job-123']);
      });

      it('creates meta key', () => {
        expect(createQueryKey.jobs.meta('job-123')).toEqual(['jobs', 'meta', 'job-123']);
      });
    });

    describe('tasks', () => {
      it('creates byJob key', () => {
        expect(createQueryKey.tasks.byJob('job-123')).toEqual(['tasks', 'job', 'job-123']);
      });

      it('creates byDepartment key', () => {
        expect(createQueryKey.tasks.byDepartment('sound', 'job-123')).toEqual([
          'tasks',
          'job',
          'job-123',
          'sound',
        ]);
      });
    });

    describe('folders', () => {
      it('creates existence key', () => {
        expect(createQueryKey.folders.existence('job-123')).toEqual([
          'folders',
          'existence',
          'job-123',
        ]);
      });
    });

    describe('assignments', () => {
      it('creates byJob key', () => {
        expect(createQueryKey.assignments.byJob('job-123')).toEqual([
          'assignments',
          'job',
          'job-123',
        ]);
      });
    });

    describe('whatsapp', () => {
      it('creates prodAssignmentsByJob key', () => {
        expect(createQueryKey.whatsapp.prodAssignmentsByJob('job-123')).toEqual([
          'whatsapp',
          'prod-assignments',
          'job-123',
        ]);
      });

      it('creates prodTimesheetsByJob key', () => {
        expect(createQueryKey.whatsapp.prodTimesheetsByJob('job-123')).toEqual([
          'whatsapp',
          'prod-timesheets',
          'job-123',
        ]);
      });
    });

    describe('profiles', () => {
      it('creates currentUser key', () => {
        expect(createQueryKey.profiles.currentUser).toEqual(['profiles', 'current-user']);
      });
    });

    describe('payoutOverrides', () => {
      it('creates byJobAndTechnician key', () => {
        expect(createQueryKey.payoutOverrides.byJobAndTechnician('job-123', 'tech-456')).toEqual([
          'payout-overrides',
          'job-123',
          'tech-456',
        ]);
      });

      it('handles null values', () => {
        expect(createQueryKey.payoutOverrides.byJobAndTechnician(null, null)).toEqual([
          'payout-overrides',
          null,
          null,
        ]);
      });
    });

    describe('technician', () => {
      it('creates rfTableArtists key', () => {
        expect(createQueryKey.technician.rfTableArtists('job-123')).toEqual([
          'technician',
          'rf-table-artists',
          'job-123',
        ]);
      });

      it('creates rfTableStages key', () => {
        expect(createQueryKey.technician.rfTableStages('job-123')).toEqual([
          'technician',
          'rf-table-stages',
          'job-123',
        ]);
      });
    });
  });

  describe('optimizedInvalidation', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = createOptimizedQueryClient(true);
      vi.spyOn(queryClient, 'invalidateQueries');
    });

    it('invalidates job-related queries', () => {
      optimizedInvalidation.invalidateJobRelated(queryClient, 'job-123');

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: createQueryKey.jobs.detail('job-123'),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: createQueryKey.jobs.meta('job-123'),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: createQueryKey.tasks.byJob('job-123'),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: createQueryKey.assignments.byJob('job-123'),
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: createQueryKey.folders.existence('job-123'),
      });
    });

    it('batch invalidates multiple jobs', () => {
      const jobIds = ['job-1', 'job-2', 'job-3'];
      optimizedInvalidation.batchInvalidateJobs(queryClient, jobIds);

      // Should invalidate job lists once
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: createQueryKey.jobs.lists(),
      });

      // Should invalidate each job's related queries
      jobIds.forEach(jobId => {
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: createQueryKey.jobs.detail(jobId),
        });
      });
    });

    it('invalidates arbitrary query keys', () => {
      const queryKeys = [
        createQueryKey.tours.all,
        createQueryKey.profiles.currentUser,
      ];

      optimizedInvalidation.invalidateQueryKeys(queryClient, queryKeys);

      queryKeys.forEach(key => {
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: key });
      });
    });
  });

  describe('retry logic', () => {
    it('does not retry on 401 errors', () => {
      const queryClient = createOptimizedQueryClient(true);
      const retryFn = queryClient.getDefaultOptions().queries?.retry;

      if (typeof retryFn === 'function') {
        expect(retryFn(0, { status: 401 })).toBe(false);
      }
    });

    it('does not retry on 404 errors', () => {
      const queryClient = createOptimizedQueryClient(true);
      const retryFn = queryClient.getDefaultOptions().queries?.retry;

      if (typeof retryFn === 'function') {
        expect(retryFn(0, { status: 404 })).toBe(false);
      }
    });

    it('retries other errors up to 2 times', () => {
      const queryClient = createOptimizedQueryClient(true);
      const retryFn = queryClient.getDefaultOptions().queries?.retry;

      if (typeof retryFn === 'function') {
        expect(retryFn(0, { status: 500 })).toBe(true);
        expect(retryFn(1, { status: 500 })).toBe(true);
        expect(retryFn(2, { status: 500 })).toBe(false);
      }
    });
  });

  describe('retry delay', () => {
    it('uses exponential backoff with max 10s', () => {
      const queryClient = createOptimizedQueryClient(true);
      const retryDelayFn = queryClient.getDefaultOptions().queries?.retryDelay;

      if (typeof retryDelayFn === 'function') {
        expect(retryDelayFn(0)).toBe(1000); // 1s
        expect(retryDelayFn(1)).toBe(1500); // 1.5s
        expect(retryDelayFn(2)).toBe(2250); // 2.25s
        // Should cap at 10s
        expect(retryDelayFn(10)).toBe(10000);
      }
    });
  });
});