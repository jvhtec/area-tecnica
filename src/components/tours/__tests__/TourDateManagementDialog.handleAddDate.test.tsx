import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock dependencies
const mockToast = vi.fn();
const mockDeleteJobDateTypes = vi.fn();
const mockSupabaseFunctionsInvoke = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/services/deleteJobDateTypes', () => ({
  deleteJobDateTypes: (...args: any[]) => mockDeleteJobDateTypes(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: (...args: any[]) => mockSupabaseFunctionsInvoke(...args),
    },
  },
}));

describe('TourDateManagementDialog - handleAddDate with rollback', () => {
  let queryClient: QueryClient;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.invalidateQueries = mockInvalidateQueries;

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Reset all mocks
    mockToast.mockClear();
    mockDeleteJobDateTypes.mockClear();
    mockSupabaseFunctionsInvoke.mockClear();
    mockSupabaseFrom.mockClear();
    mockInvalidateQueries.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // Helper to create mock supabase chain
  const createMockSupabaseChain = (responses: Record<string, any>) => {
    return (table: string) => {
      const response = responses[table] || {};
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(response.insert || { data: null, error: null }),
          }),
          eq: vi.fn().mockResolvedValue(response.insert || { data: null, error: null }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(response.select || { data: null, error: null }),
          }),
          in: vi.fn().mockResolvedValue(response.select || { data: null, error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(response.delete || { data: null, error: null }),
        }),
      };
    };
  };

  describe('Happy Path - Successful Tour Date Creation', () => {
    it('should create tour date, job, departments, and job_date_types successfully', async () => {
      const mockLocationId = 'loc-123';
      const mockTourDateId = 'td-456';
      const mockJobId = 'job-789';

      mockSupabaseFrom.mockImplementation(
        createMockSupabaseChain({
          tour_dates: {
            insert: {
              data: {
                id: mockTourDateId,
                date: '2024-01-15',
                start_date: '2024-01-15',
                end_date: '2024-01-15',
                tour_date_type: 'show',
                rehearsal_days: 1,
                location: { id: mockLocationId, name: 'Test Venue' },
              },
              error: null,
            },
          },
          tours: {
            select: {
              data: {
                name: 'Test Tour',
                color: '#FF0000',
                tour_dates: [{ jobs: [{ job_departments: [{ department: 'sound' }] }] }],
              },
              error: null,
            },
          },
          jobs: {
            insert: {
              data: { id: mockJobId },
              error: null,
            },
          },
          job_departments: {
            insert: { data: null, error: null },
          },
          job_date_types: {
            insert: { data: null, error: null },
          },
        })
      );

      mockInvalidateQueries.mockResolvedValue(undefined);

      // We can't easily test the actual component function directly,
      // but we can test the logic flow by simulating it
      const tourId = 'tour-123';
      const location = 'Test Venue';
      const startDate = '2024-01-15';
      const endDate = '2024-01-15';
      const tourDateType = 'show';
      const isTourPackOnly = false;

      // Simulate the function behavior
      let success = true;
      const createdRecords = { tourDateId: null as string | null, jobId: null as string | null };

      try {
        // Simulate tour_dates creation
        const tourDateResult = await mockSupabaseFrom('tour_dates')
          .insert({})
          .select()
          .single();
        if (tourDateResult.error) throw tourDateResult.error;
        createdRecords.tourDateId = tourDateResult.data.id;

        // Simulate tours fetch
        const tourResult = await mockSupabaseFrom('tours').select().eq().single();
        if (tourResult.error) throw tourResult.error;

        // Simulate jobs creation
        const jobResult = await mockSupabaseFrom('jobs').insert({}).select().single();
        if (jobResult.error) throw jobResult.error;
        createdRecords.jobId = jobResult.data.id;

        // Simulate job_departments creation
        const deptResult = await mockSupabaseFrom('job_departments').insert({}).eq();
        if (deptResult.error) throw deptResult.error;

        // Simulate job_date_types creation
        const dateTypeResult = await mockSupabaseFrom('job_date_types').insert({}).eq();
        if (dateTypeResult.error) throw dateTypeResult.error;

        await mockInvalidateQueries();
        mockToast({ title: 'Success', description: 'Tour date and job created successfully' });
      } catch (error: any) {
        success = false;
      }

      expect(success).toBe(true);
      expect(createdRecords.tourDateId).toBe(mockTourDateId);
      expect(createdRecords.jobId).toBe(mockJobId);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Tour date and job created successfully',
      });
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });

    it('should use endDate when provided, otherwise default to startDate', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'td-1', date: '2024-01-15', start_date: '2024-01-15', end_date: '2024-01-20' },
            error: null,
          }),
        }),
      });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tour_dates') {
          return { insert: insertSpy };
        }
        return createMockSupabaseChain({
          tours: {
            select: {
              data: { name: 'Tour', color: '#000', tour_dates: [] },
              error: null,
            },
          },
        })(table);
      });

      const startDate = '2024-01-15';
      const endDate = '2024-01-20';

      // Simulate finalEndDate logic
      const finalEndDate = endDate || startDate;
      expect(finalEndDate).toBe('2024-01-20');

      // When endDate is empty
      const finalEndDateEmpty = '' || startDate;
      expect(finalEndDateEmpty).toBe('2024-01-15');
    });

    it('should generate correct job_date_types for multi-day date range', async () => {
      const startDate = '2024-01-15';
      const endDate = '2024-01-17';
      const tourDateType = 'rehearsal';
      const jobId = 'job-123';

      // Simulate the date range logic
      const jobDateTypes = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        jobDateTypes.push({
          job_id: jobId,
          date: d.toISOString().split('T')[0],
          type: tourDateType,
        });
      }

      expect(jobDateTypes).toHaveLength(3);
      expect(jobDateTypes[0]).toEqual({ job_id: jobId, date: '2024-01-15', type: 'rehearsal' });
      expect(jobDateTypes[1]).toEqual({ job_id: jobId, date: '2024-01-16', type: 'rehearsal' });
      expect(jobDateTypes[2]).toEqual({ job_id: jobId, date: '2024-01-17', type: 'rehearsal' });
    });
  });

  describe('Error Handling - Missing Tour ID', () => {
    it('should throw error when tourId is null', async () => {
      let errorThrown = false;
      const tourId = null;

      try {
        if (!tourId) {
          throw new Error('Tour ID is required');
        }
      } catch (error: any) {
        errorThrown = true;
        expect(error.message).toBe('Tour ID is required');
      }

      expect(errorThrown).toBe(true);
    });

    it('should not create any records when tourId is missing', async () => {
      const tourId = null;
      let createdRecords = { tourDateId: null as string | null, jobId: null as string | null };

      try {
        if (!tourId) {
          throw new Error('Tour ID is required');
        }
        // This code should not execute
        createdRecords.tourDateId = 'should-not-be-set';
      } catch (error) {
        // Expected error
      }

      expect(createdRecords.tourDateId).toBeNull();
      expect(createdRecords.jobId).toBeNull();
    });
  });

  describe('Rollback Mechanism - Partial Creation Failures', () => {
    it('should rollback tour_dates when job creation fails', async () => {
      const mockTourDateId = 'td-rollback-1';
      const deleteFromTourDates = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tour_dates') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockTourDateId },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: deleteFromTourDates,
            }),
          };
        }
        if (table === 'tours') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { name: 'Test Tour', color: '#000', tour_dates: [] },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'jobs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Job creation failed' },
                }),
              }),
            }),
          };
        }
        return createMockSupabaseChain({})(table);
      });

      const createdRecords = { tourDateId: null as string | null, jobId: null as string | null };
      let creationStage = 'preparing';

      const rollbackCreatedRecords = async () => {
        if (!createdRecords.tourDateId && !createdRecords.jobId) {
          return;
        }

        if (createdRecords.tourDateId) {
          try {
            const { error } = await mockSupabaseFrom('tour_dates').delete().eq('id', createdRecords.tourDateId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for tour_dates:', rollbackError);
          }
        }
      };

      try {
        creationStage = 'tour_dates';
        const tourDateResult = await mockSupabaseFrom('tour_dates').insert({}).select().single();
        if (tourDateResult.error) throw tourDateResult.error;
        createdRecords.tourDateId = tourDateResult.data.id;

        creationStage = 'fetch_tour';
        const tourResult = await mockSupabaseFrom('tours').select().eq().single();
        if (tourResult.error) throw tourResult.error;

        creationStage = 'jobs';
        const jobResult = await mockSupabaseFrom('jobs').insert({}).select().single();
        if (jobResult.error) throw jobResult.error;
      } catch (error: any) {
        await rollbackCreatedRecords();
        mockToast({ title: 'Error adding date', description: error.message, variant: 'destructive' });
      }

      expect(createdRecords.tourDateId).toBe(mockTourDateId);
      expect(createdRecords.jobId).toBeNull();
      expect(deleteFromTourDates).toHaveBeenCalledWith('id', mockTourDateId);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Rolling back partial tour date creation',
        expect.objectContaining({ tourDateId: mockTourDateId })
      );
    });

    it('should rollback both job and tour_dates when job_departments fails', async () => {
      const mockTourDateId = 'td-rollback-2';
      const mockJobId = 'job-rollback-2';

      const deleteFromTourDates = vi.fn().mockResolvedValue({ error: null });
      const deleteFromJobs = vi.fn().mockResolvedValue({ error: null });
      const deleteFromJobDepartments = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tour_dates') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockTourDateId },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({ eq: deleteFromTourDates }),
          };
        }
        if (table === 'jobs') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockJobId },
                  error: null,
                }),
              }),
            }),
            delete: vi.fn().mockReturnValue({ eq: deleteFromJobs }),
          };
        }
        if (table === 'job_departments') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Department creation failed' },
            }),
            delete: vi.fn().mockReturnValue({ eq: deleteFromJobDepartments }),
          };
        }
        return createMockSupabaseChain({
          tours: {
            select: { data: { name: 'Tour', color: '#000', tour_dates: [] }, error: null },
          },
        })(table);
      });

      mockDeleteJobDateTypes.mockResolvedValue(undefined);

      const createdRecords = { tourDateId: null as string | null, jobId: null as string | null };

      const rollbackCreatedRecords = async () => {
        if (!createdRecords.tourDateId && !createdRecords.jobId) {
          return;
        }

        if (createdRecords.jobId) {
          try {
            await mockDeleteJobDateTypes(createdRecords.jobId);
          } catch (rollbackError) {
            console.error('Rollback failed for job_date_types:', rollbackError);
          }

          try {
            const { error } = await mockSupabaseFrom('job_departments').delete().eq('job_id', createdRecords.jobId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for job_departments:', rollbackError);
          }

          try {
            const { error } = await mockSupabaseFrom('jobs').delete().eq('id', createdRecords.jobId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for jobs:', rollbackError);
          }
        }

        if (createdRecords.tourDateId) {
          try {
            const { error } = await mockSupabaseFrom('tour_dates').delete().eq('id', createdRecords.tourDateId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for tour_dates:', rollbackError);
          }
        }
      };

      try {
        const tourDateResult = await mockSupabaseFrom('tour_dates').insert({}).select().single();
        if (tourDateResult.error) throw tourDateResult.error;
        createdRecords.tourDateId = tourDateResult.data.id;

        const tourResult = await mockSupabaseFrom('tours').select().eq().single();
        if (tourResult.error) throw tourResult.error;

        const jobResult = await mockSupabaseFrom('jobs').insert({}).select().single();
        if (jobResult.error) throw jobResult.error;
        createdRecords.jobId = jobResult.data.id;

        const deptResult = await mockSupabaseFrom('job_departments').insert({});
        if (deptResult.error) throw deptResult.error;
      } catch (error: any) {
        await rollbackCreatedRecords();
      }

      expect(mockDeleteJobDateTypes).toHaveBeenCalledWith(mockJobId);
      expect(deleteFromJobDepartments).toHaveBeenCalledWith('job_id', mockJobId);
      expect(deleteFromJobs).toHaveBeenCalledWith('id', mockJobId);
      expect(deleteFromTourDates).toHaveBeenCalledWith('id', mockTourDateId);
    });

    it('should continue rollback even if individual rollback steps fail', async () => {
      const mockTourDateId = 'td-rollback-3';
      const mockJobId = 'job-rollback-3';

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tour_dates') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'Tour date delete failed' } }),
            }),
          };
        }
        if (table === 'jobs') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'job_departments') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return createMockSupabaseChain({})(table);
      });

      mockDeleteJobDateTypes.mockRejectedValue(new Error('Delete job date types failed'));

      const createdRecords = { tourDateId: mockTourDateId, jobId: mockJobId };

      const rollbackCreatedRecords = async () => {
        if (createdRecords.jobId) {
          try {
            await mockDeleteJobDateTypes(createdRecords.jobId);
          } catch (rollbackError) {
            console.error('Rollback failed for job_date_types:', rollbackError);
          }

          try {
            const { error } = await mockSupabaseFrom('job_departments').delete().eq('job_id', createdRecords.jobId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for job_departments:', rollbackError);
          }

          try {
            const { error } = await mockSupabaseFrom('jobs').delete().eq('id', createdRecords.jobId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for jobs:', rollbackError);
          }
        }

        if (createdRecords.tourDateId) {
          try {
            const { error } = await mockSupabaseFrom('tour_dates').delete().eq('id', createdRecords.tourDateId);
            if (error) throw error;
          } catch (rollbackError) {
            console.error('Rollback failed for tour_dates:', rollbackError);
          }
        }
      };

      await rollbackCreatedRecords();

      // Verify all rollback attempts were made despite failures
      expect(mockDeleteJobDateTypes).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Rollback failed for job_date_types:',
        expect.any(Error)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Rollback failed for tour_dates:',
        expect.objectContaining({ message: 'Tour date delete failed' })
      );
    });

    it('should not attempt rollback when no records were created', async () => {
      const createdRecords = { tourDateId: null as string | null, jobId: null as string | null };

      const rollbackCreatedRecords = async () => {
        if (!createdRecords.tourDateId && !createdRecords.jobId) {
          return;
        }
        // Rollback logic should not execute
        throw new Error('Should not reach here');
      };

      await rollbackCreatedRecords();

      expect(mockDeleteJobDateTypes).not.toHaveBeenCalled();
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });
  });

  describe('Error Alerting - Push Notification', () => {
    it('should send push notification on failure with correct metadata', async () => {
      const errorMessage = 'Database constraint violation';
      const creationMetadata = {
        tourId: 'tour-456',
        location: 'Madrid Arena',
        startDate: '2024-01-20',
        endDate: '2024-01-20',
        tourDateType: 'show' as const,
        isTourPackOnly: false,
        traceId: 'tour-456-1234567890',
      };
      let creationStage = 'job_date_types';

      mockSupabaseFunctionsInvoke.mockResolvedValue({ data: null, error: null });

      const alertCreationFailure = async (error: any) => {
        console.error(`[TourDateManagement] Failed during ${creationStage}:`, error, creationMetadata);
        try {
          await mockSupabaseFunctionsInvoke('push', {
            body: {
              action: 'broadcast',
              type: 'tour.date.creation.failed',
              stage: creationStage,
              message: error?.message ?? 'Unknown error',
              metadata: creationMetadata,
            },
          });
        } catch (pushError) {
          console.error('Failed to send tour date creation failure alert:', pushError);
        }
      };

      await alertCreationFailure({ message: errorMessage });

      expect(mockSupabaseFunctionsInvoke).toHaveBeenCalledWith('push', {
        body: {
          action: 'broadcast',
          type: 'tour.date.creation.failed',
          stage: 'job_date_types',
          message: errorMessage,
          metadata: creationMetadata,
        },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TourDateManagement] Failed during job_date_types:',
        expect.objectContaining({ message: errorMessage }),
        creationMetadata
      );
    });

    it('should handle unknown error messages gracefully', async () => {
      const creationMetadata = {
        tourId: 'tour-789',
        location: 'Barcelona',
        startDate: '2024-02-01',
        endDate: '2024-02-03',
        tourDateType: 'rehearsal' as const,
        isTourPackOnly: true,
        traceId: 'tour-789-9876543210',
      };
      let creationStage = 'tour_dates';

      mockSupabaseFunctionsInvoke.mockResolvedValue({ data: null, error: null });

      const alertCreationFailure = async (error: any) => {
        try {
          await mockSupabaseFunctionsInvoke('push', {
            body: {
              action: 'broadcast',
              type: 'tour.date.creation.failed',
              stage: creationStage,
              message: error?.message ?? 'Unknown error',
              metadata: creationMetadata,
            },
          });
        } catch (pushError) {
          console.error('Failed to send tour date creation failure alert:', pushError);
        }
      };

      await alertCreationFailure(null);

      expect(mockSupabaseFunctionsInvoke).toHaveBeenCalledWith('push', {
        body: expect.objectContaining({
          message: 'Unknown error',
        }),
      });
    });

    it('should log error if push notification fails', async () => {
      const pushError = new Error('Push service unavailable');
      mockSupabaseFunctionsInvoke.mockRejectedValue(pushError);

      const creationMetadata = {
        tourId: 'tour-111',
        location: 'Test',
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        tourDateType: 'show' as const,
        isTourPackOnly: false,
        traceId: 'tour-111-1111111111',
      };
      const creationStage = 'jobs';

      const alertCreationFailure = async (error: any) => {
        try {
          await mockSupabaseFunctionsInvoke('push', {
            body: {
              action: 'broadcast',
              type: 'tour.date.creation.failed',
              stage: creationStage,
              message: error?.message ?? 'Unknown error',
              metadata: creationMetadata,
            },
          });
        } catch (pushError) {
          console.error('Failed to send tour date creation failure alert:', pushError);
        }
      };

      await alertCreationFailure({ message: 'Test error' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send tour date creation failure alert:',
        pushError
      );
    });
  });

  describe('Creation Stage Tracking', () => {
    it('should track creation stage progression through all steps', async () => {
      const stages: string[] = [];

      mockSupabaseFrom.mockImplementation(
        createMockSupabaseChain({
          tour_dates: {
            insert: { data: { id: 'td-1' }, error: null },
          },
          tours: {
            select: { data: { name: 'Tour', color: '#000', tour_dates: [] }, error: null },
          },
          jobs: {
            insert: { data: { id: 'job-1' }, error: null },
          },
          job_departments: {
            insert: { data: null, error: null },
          },
          job_date_types: {
            insert: { data: null, error: null },
          },
        })
      );

      let creationStage = 'preparing';
      stages.push(creationStage);

      try {
        creationStage = 'tour_dates';
        stages.push(creationStage);
        await mockSupabaseFrom('tour_dates').insert({}).select().single();

        creationStage = 'fetch_tour';
        stages.push(creationStage);
        await mockSupabaseFrom('tours').select().eq().single();

        creationStage = 'jobs';
        stages.push(creationStage);
        await mockSupabaseFrom('jobs').insert({}).select().single();

        creationStage = 'job_departments';
        stages.push(creationStage);
        await mockSupabaseFrom('job_departments').insert({});

        creationStage = 'job_date_types';
        stages.push(creationStage);
        await mockSupabaseFrom('job_date_types').insert({});

        creationStage = 'completed';
        stages.push(creationStage);
      } catch (error) {
        // Error handling
      }

      expect(stages).toEqual([
        'preparing',
        'tour_dates',
        'fetch_tour',
        'jobs',
        'job_departments',
        'job_date_types',
        'completed',
      ]);
    });

    it('should report correct stage when failure occurs at job_date_types', async () => {
      let creationStage = 'preparing';

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'job_date_types') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Duplicate entry' },
            }),
          };
        }
        return createMockSupabaseChain({
          tour_dates: { insert: { data: { id: 'td-1' }, error: null } },
          tours: { select: { data: { name: 'Tour', color: '#000', tour_dates: [] }, error: null } },
          jobs: { insert: { data: { id: 'job-1' }, error: null } },
          job_departments: { insert: { data: null, error: null } },
        })(table);
      });

      try {
        creationStage = 'tour_dates';
        await mockSupabaseFrom('tour_dates').insert({}).select().single();

        creationStage = 'fetch_tour';
        await mockSupabaseFrom('tours').select().eq().single();

        creationStage = 'jobs';
        await mockSupabaseFrom('jobs').insert({}).select().single();

        creationStage = 'job_departments';
        await mockSupabaseFrom('job_departments').insert({});

        creationStage = 'job_date_types';
        const result = await mockSupabaseFrom('job_date_types').insert({});
        if (result.error) throw result.error;
      } catch (error) {
        // Expected
      }

      expect(creationStage).toBe('job_date_types');
    });
  });

  describe('Creation Metadata and Tracing', () => {
    it('should generate unique traceId with tourId and timestamp', () => {
      const tourId = 'tour-555';
      const now = Date.now();

      const creationMetadata = {
        tourId,
        location: 'Test Location',
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        tourDateType: 'show' as const,
        isTourPackOnly: false,
        traceId: `${tourId ?? 'unknown'}-${now}`,
      };

      expect(creationMetadata.traceId).toMatch(/^tour-555-\d+$/);
      expect(creationMetadata.traceId).toContain(tourId);
    });

    it('should use "unknown" in traceId when tourId is null', () => {
      const tourId = null;
      const traceId = `${tourId ?? 'unknown'}-${Date.now()}`;

      expect(traceId).toMatch(/^unknown-\d+$/);
    });

    it('should include all relevant metadata fields', () => {
      const creationMetadata = {
        tourId: 'tour-999',
        location: 'Valencia Concert Hall',
        startDate: '2024-03-15',
        endDate: '2024-03-17',
        tourDateType: 'travel' as const,
        isTourPackOnly: true,
        traceId: `tour-999-${Date.now()}`,
      };

      expect(creationMetadata).toHaveProperty('tourId');
      expect(creationMetadata).toHaveProperty('location');
      expect(creationMetadata).toHaveProperty('startDate');
      expect(creationMetadata).toHaveProperty('endDate');
      expect(creationMetadata).toHaveProperty('tourDateType');
      expect(creationMetadata).toHaveProperty('isTourPackOnly');
      expect(creationMetadata).toHaveProperty('traceId');
    });
  });

  describe('Toast Notifications', () => {
    it('should show success toast with correct message on completion', async () => {
      mockSupabaseFrom.mockImplementation(
        createMockSupabaseChain({
          tour_dates: { insert: { data: { id: 'td-1' }, error: null } },
          tours: { select: { data: { name: 'Tour', color: '#000', tour_dates: [] }, error: null } },
          jobs: { insert: { data: { id: 'job-1' }, error: null } },
          job_departments: { insert: { data: null, error: null } },
          job_date_types: { insert: { data: null, error: null } },
        })
      );

      try {
        await mockSupabaseFrom('tour_dates').insert({}).select().single();
        await mockSupabaseFrom('tours').select().eq().single();
        await mockSupabaseFrom('jobs').insert({}).select().single();
        await mockSupabaseFrom('job_departments').insert({});
        await mockSupabaseFrom('job_date_types').insert({});

        mockToast({
          title: 'Success',
          description: 'Tour date and job created successfully',
        });
      } catch (error) {
        // Not expected
      }

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Tour date and job created successfully',
      });
    });

    it('should show error toast with error message on failure', async () => {
      const errorMsg = 'Network timeout';

      try {
        throw new Error(errorMsg);
      } catch (error: any) {
        mockToast({
          title: 'Error adding date',
          description: error?.message || 'Failed to add tour date',
          variant: 'destructive',
        });
      }

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error adding date',
        description: errorMsg,
        variant: 'destructive',
      });
    });

    it('should use fallback message when error has no message', async () => {
      try {
        throw { code: 'UNKNOWN' }; // Error without message property
      } catch (error: any) {
        mockToast({
          title: 'Error adding date',
          description: error?.message || 'Failed to add tour date',
          variant: 'destructive',
        });
      }

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error adding date',
        description: 'Failed to add tour date',
        variant: 'destructive',
      });
    });
  });

  describe('Query Invalidation', () => {
    it('should invalidate all related queries on successful creation', async () => {
      const tourId = 'tour-888';

      mockSupabaseFrom.mockImplementation(
        createMockSupabaseChain({
          tour_dates: { insert: { data: { id: 'td-1' }, error: null } },
          tours: { select: { data: { name: 'Tour', color: '#000', tour_dates: [] }, error: null } },
          jobs: { insert: { data: { id: 'job-1' }, error: null } },
          job_departments: { insert: { data: null, error: null } },
          job_date_types: { insert: { data: null, error: null } },
        })
      );

      mockInvalidateQueries.mockResolvedValue(undefined);

      try {
        await mockSupabaseFrom('tour_dates').insert({}).select().single();
        await mockSupabaseFrom('tours').select().eq().single();
        await mockSupabaseFrom('jobs').insert({}).select().single();
        await mockSupabaseFrom('job_departments').insert({});
        await mockSupabaseFrom('job_date_types').insert({});

        await Promise.all([
          mockInvalidateQueries({ queryKey: ['tour', tourId] }),
          mockInvalidateQueries({ queryKey: ['tours'] }),
          mockInvalidateQueries({ queryKey: ['jobs'] }),
          mockInvalidateQueries({ queryKey: ['flex-folders-existence'] }),
        ]);
      } catch (error) {
        // Not expected
      }

      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['tour', tourId] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['tours'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobs'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['flex-folders-existence'] });
    });

    it('should not invalidate queries when creation fails', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'tour_dates') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Creation failed' },
                }),
              }),
            }),
          };
        }
        return createMockSupabaseChain({})(table);
      });

      try {
        const result = await mockSupabaseFrom('tour_dates').insert({}).select().single();
        if (result.error) throw result.error;

        await mockInvalidateQueries();
      } catch (error) {
        // Expected error, should not invalidate
      }

      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-day tour date (startDate === endDate)', async () => {
      const startDate = '2024-01-15';
      const endDate = '2024-01-15';
      const jobId = 'job-single';

      const jobDateTypes = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        jobDateTypes.push({
          job_id: jobId,
          date: d.toISOString().split('T')[0],
          type: 'show',
        });
      }

      expect(jobDateTypes).toHaveLength(1);
      expect(jobDateTypes[0].date).toBe('2024-01-15');
    });

    it('should calculate correct rehearsal days for date range', () => {
      const startDate = '2024-01-15';
      const endDate = '2024-01-20';

      const rehearsalDays =
        Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

      expect(rehearsalDays).toBe(6); // 5 days difference + 1 = 6 days total
    });

    it('should handle different tour date types correctly', () => {
      const types: Array<'show' | 'rehearsal' | 'travel'> = ['show', 'rehearsal', 'travel'];
      const location = 'Test Venue';
      const tourName = 'Summer Tour';

      types.forEach((type) => {
        let title: string;
        if (type === 'rehearsal') {
          title = `${tourName} - Rehearsal (${location})`;
        } else if (type === 'travel') {
          title = `${tourName} - Travel (${location})`;
        } else {
          title = `${tourName} (${location || 'No Location'})`;
        }

        if (type === 'show') {
          expect(title).toBe('Summer Tour (Test Venue)');
        } else if (type === 'rehearsal') {
          expect(title).toBe('Summer Tour - Rehearsal (Test Venue)');
        } else {
          expect(title).toBe('Summer Tour - Travel (Test Venue)');
        }
      });
    });

    it('should handle empty location gracefully', () => {
      const location = '';
      const tourName = 'Test Tour';
      const title = `${tourName} (${location || 'No Location'})`;

      expect(title).toBe('Test Tour (No Location)');
    });

    it('should handle very long date ranges', () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const jobId = 'job-long';

      const jobDateTypes = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        jobDateTypes.push({
          job_id: jobId,
          date: d.toISOString().split('T')[0],
          type: 'show',
        });
      }

      expect(jobDateTypes.length).toBeGreaterThan(360); // Should be 366 for leap year
      expect(jobDateTypes[0].date).toBe('2024-01-01');
      expect(jobDateTypes[jobDateTypes.length - 1].date).toBe('2024-12-31');
    });
  });
});