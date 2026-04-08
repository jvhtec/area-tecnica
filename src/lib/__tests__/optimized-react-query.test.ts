import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  createOptimizedQueryClient,
  updateQueryClientForRole,
  createQueryKey,
  optimizedInvalidation,
} from '../optimized-react-query';

describe('optimized-react-query', () => {
  describe('createOptimizedQueryClient', () => {
    it('creates a query client with leader configuration', () => {
      const client = createOptimizedQueryClient(true);
      expect(client).toBeInstanceOf(QueryClient);

      const options = client.getDefaultOptions();
      expect(options.queries?.refetchOnWindowFocus).toBe(true);
      expect(options.queries?.refetchOnMount).toBe(true);
      expect(options.queries?.refetchOnReconnect).toBe(true);
    });

    it('creates a query client with follower configuration', () => {
      const client = createOptimizedQueryClient(false);
      expect(client).toBeInstanceOf(QueryClient);

      const options = client.getDefaultOptions();
      expect(options.queries?.refetchOnWindowFocus).toBe(false);
      expect(options.queries?.refetchOnMount).toBe(false);
      expect(options.queries?.refetchOnReconnect).toBe(false);
    });

    it('deduplicates concurrent identical queries', async () => {
      const client = createOptimizedQueryClient(true);

      let callCount = 0;
      const queryFn = vi.fn(async () => {
        callCount++;
        return { data: 'test' };
      });

      // Make two identical concurrent queries
      const promise1 = client.fetchQuery({
        queryKey: ['test', '1'],
        queryFn,
      });
      const promise2 = client.fetchQuery({
        queryKey: ['test', '1'],
        queryFn,
      });

      await Promise.all([promise1, promise2]);

      // Should only call the query function once due to deduplication
      expect(callCount).toBe(1);
    });
  });

  describe('updateQueryClientForRole', () => {
    it('updates client options when role changes', () => {
      const client = createOptimizedQueryClient(true);

      // Start as leader
      expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);

      // Change to follower
      updateQueryClientForRole(client, false);
      expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);

      // Change back to leader
      updateQueryClientForRole(client, true);
      expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);
    });
  });

  describe('createQueryKey', () => {
    it('generates consistent tour query keys', () => {
      expect(createQueryKey.tours.all).toEqual(['tours']);
      expect(createQueryKey.tours.byUser('user-123')).toEqual(['tours', 'my', 'user-123']);
    });

    it('generates pending task query keys', () => {
      expect(createQueryKey.pendingTasks.all).toEqual(['pending-tasks']);
      expect(createQueryKey.pendingTasks.byUser('user-123', 'sound')).toEqual([
        'pending-tasks',
        'user-123',
        'sound',
      ]);
      expect(createQueryKey.pendingTasks.byUser('user-123', null)).toEqual([
        'pending-tasks',
        'user-123',
        null,
      ]);
    });

    it('generates job query keys', () => {
      expect(createQueryKey.jobs.all).toEqual(['jobs']);
      expect(createQueryKey.jobs.lists()).toEqual(['jobs', 'list']);
      expect(createQueryKey.jobs.list({ status: 'active' })).toEqual([
        'jobs',
        'list',
        { status: 'active' },
      ]);
      expect(createQueryKey.jobs.details()).toEqual(['jobs', 'detail']);
      expect(createQueryKey.jobs.detail('job-123')).toEqual(['jobs', 'detail', 'job-123']);
      expect(createQueryKey.jobs.meta('job-123')).toEqual(['jobs', 'meta', 'job-123']);
    });

    it('generates task query keys', () => {
      expect(createQueryKey.tasks.all).toEqual(['tasks']);
      expect(createQueryKey.tasks.byJob('job-123')).toEqual(['tasks', 'job', 'job-123']);
      expect(createQueryKey.tasks.byDepartment('sound', 'job-123')).toEqual([
        'tasks',
        'job',
        'job-123',
        'sound',
      ]);
    });

    it('generates folder query keys', () => {
      expect(createQueryKey.folders.all).toEqual(['folders']);
      expect(createQueryKey.folders.existence('job-123')).toEqual([
        'folders',
        'existence',
        'job-123',
      ]);
    });

    it('generates assignment query keys', () => {
      expect(createQueryKey.assignments.all).toEqual(['assignments']);
      expect(createQueryKey.assignments.byJob('job-123')).toEqual([
        'assignments',
        'job',
        'job-123',
      ]);
    });

    it('generates whatsapp query keys', () => {
      expect(createQueryKey.whatsapp.all).toEqual(['whatsapp']);
      expect(createQueryKey.whatsapp.prodAssignmentsByJob('job-123')).toEqual([
        'whatsapp',
        'prod-assignments',
        'job-123',
      ]);
      expect(createQueryKey.whatsapp.prodTimesheetsByJob('job-123')).toEqual([
        'whatsapp',
        'prod-timesheets',
        'job-123',
      ]);
    });

    it('generates profile query keys', () => {
      expect(createQueryKey.profiles.all).toEqual(['profiles']);
      expect(createQueryKey.profiles.currentUser).toEqual(['profiles', 'current-user']);
    });

    it('generates payout override query keys', () => {
      expect(createQueryKey.payoutOverrides.all).toEqual(['payout-overrides']);
      expect(createQueryKey.payoutOverrides.byJobAndTechnician('job-123', 'tech-456')).toEqual([
        'payout-overrides',
        'job-123',
        'tech-456',
      ]);
      expect(createQueryKey.payoutOverrides.byJobAndTechnician(null, null)).toEqual([
        'payout-overrides',
        null,
        null,
      ]);
    });

    it('generates timesheet reminder settings query keys', () => {
      expect(createQueryKey.timesheetReminderSettings.all).toEqual([
        'timesheet-reminder-settings',
      ]);
    });

    it('generates payout due fortnights query keys', () => {
      expect(createQueryKey.payoutDueFortnights.all).toEqual(['payout-due-fortnights']);
    });

    it('generates technician RF table query keys', () => {
      expect(createQueryKey.technician.rfTableArtists('job-123')).toEqual([
        'technician',
        'rf-table-artists',
        'job-123',
      ]);
      expect(createQueryKey.technician.rfTableStages('job-123')).toEqual([
        'technician',
        'rf-table-stages',
        'job-123',
      ]);
    });
  });

  describe('optimizedInvalidation', () => {
    let client: QueryClient;

    beforeEach(() => {
      client = createOptimizedQueryClient(true);
      vi.clearAllMocks();
    });

    it('invalidates job-related queries', () => {
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      optimizedInvalidation.invalidateJobRelated(client, 'job-123');

      expect(invalidateSpy).toHaveBeenCalledTimes(5);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: createQueryKey.jobs.detail('job-123'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: createQueryKey.jobs.meta('job-123'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: createQueryKey.tasks.byJob('job-123'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: createQueryKey.assignments.byJob('job-123'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: createQueryKey.folders.existence('job-123'),
      });
    });

    it('batch invalidates multiple jobs', () => {
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      optimizedInvalidation.batchInvalidateJobs(client, ['job-1', 'job-2']);

      // Should invalidate job lists once + 5 calls per job (2 jobs)
      expect(invalidateSpy).toHaveBeenCalledTimes(11);

      // Check that lists were invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: createQueryKey.jobs.lists(),
      });
    });

    it('invalidates arbitrary query keys', () => {
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

      const keys = [
        createQueryKey.tours.all,
        createQueryKey.profiles.currentUser,
      ];

      optimizedInvalidation.invalidateQueryKeys(client, keys);

      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys[0] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keys[1] });
    });
  });

  describe('query client retry configuration', () => {
    it('does not retry on 401 errors', async () => {
      const client = createOptimizedQueryClient(true);
      const retryFn = client.getDefaultOptions().queries?.retry;

      if (typeof retryFn === 'function') {
        expect(retryFn(1, { status: 401 })).toBe(false);
      }
    });

    it('does not retry on 404 errors', async () => {
      const client = createOptimizedQueryClient(true);
      const retryFn = client.getDefaultOptions().queries?.retry;

      if (typeof retryFn === 'function') {
        expect(retryFn(1, { status: 404 })).toBe(false);
      }
    });

    it('retries on other errors up to 2 times', async () => {
      const client = createOptimizedQueryClient(true);
      const retryFn = client.getDefaultOptions().queries?.retry;

      if (typeof retryFn === 'function') {
        expect(retryFn(0, { status: 500 })).toBe(true);
        expect(retryFn(1, { status: 500 })).toBe(true);
        expect(retryFn(2, { status: 500 })).toBe(false);
      }
    });
  });
});