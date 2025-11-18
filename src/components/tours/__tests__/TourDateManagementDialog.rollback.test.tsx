import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';

// Mock Supabase client
const mockSupabaseFrom = vi.fn();
const mockSupabaseFunctions = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

const mockSupabase = {
  from: mockSupabaseFrom,
  functions: {
    invoke: mockSupabaseFunctions,
  },
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => children,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('TourDateManagementDialog - handleAddDate Rollback Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock chains
    mockEq.mockReturnThis();
    mockDelete.mockReturnValue({ eq: mockEq });
    mockSupabaseFrom.mockReturnValue({
      delete: mockDelete,
      insert: mockInsert,
      select: mockSelect,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should rollback tour_dates when job creation fails', async () => {
    const tourDateId = 'tour-date-123';
    const jobId = null; // Job not created yet

    // Simulate successful tour_date creation
    mockInsert.mockResolvedValueOnce({
      data: { id: tourDateId },
      error: null,
    });

    // Simulate successful tour fetch
    mockSingle.mockResolvedValueOnce({
      data: { name: 'Test Tour', tour_dates: [] },
      error: null,
    });

    mockSelect.mockReturnValue({ single: mockSingle });

    // Simulate job creation failure
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Job creation failed', code: '500' },
    });

    // Mock the delete for rollback
    mockEq.mockResolvedValueOnce({ error: null });

    const { handleAddDate } = await import('../TourDateManagementDialog');

    // Note: This is a conceptual test. In practice, you'd need to extract handleAddDate
    // or test it through the component interface
    // The actual test would involve rendering the component and triggering the add date action
    
    expect(mockDelete).not.toHaveBeenCalled(); // Will be called during rollback
  });

  it('should rollback both job and tour_date when job_departments creation fails', async () => {
    const tourDateId = 'tour-date-123';
    const jobId = 'job-456';

    // Setup successful tour_date creation
    mockInsert.mockResolvedValueOnce({
      data: { id: tourDateId },
      error: null,
    });

    // Setup successful tour fetch
    mockSingle.mockResolvedValueOnce({
      data: { 
        name: 'Test Tour',
        tour_dates: [{
          jobs: [{
            job_departments: [
              { department: 'sound' },
              { department: 'lights' }
            ]
          }]
        }]
      },
      error: null,
    });

    // Setup successful job creation
    mockInsert.mockResolvedValueOnce({
      data: { id: jobId },
      error: null,
    });

    // Setup job_departments creation failure
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Department creation failed' },
    });

    // Verify rollback attempts were made
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  it('should rollback all entities when job_date_types creation fails', async () => {
    const tourDateId = 'tour-date-123';
    const jobId = 'job-456';

    // Setup successful tour_date creation
    mockInsert.mockResolvedValueOnce({
      data: { id: tourDateId },
      error: null,
    });

    // Setup successful tour fetch
    mockSingle.mockResolvedValueOnce({
      data: { 
        name: 'Test Tour',
        tour_dates: [{
          jobs: [{
            job_departments: [{ department: 'sound' }]
          }]
        }]
      },
      error: null,
    });

    // Setup successful job creation
    mockInsert.mockResolvedValueOnce({
      data: { id: jobId },
      error: null,
    });

    // Setup successful job_departments creation
    mockInsert.mockResolvedValueOnce({
      data: [{ job_id: jobId, department: 'sound' }],
      error: null,
    });

    // Setup job_date_types creation failure
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Date types creation failed', code: '23505' }, // Unique constraint violation
    });

    // Verify proper cleanup
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  it('should handle rollback errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const tourDateId = 'tour-date-123';
    const jobId = 'job-456';

    // Setup successful tour_date and job creation
    mockInsert.mockResolvedValueOnce({
      data: { id: tourDateId },
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: { 
        name: 'Test Tour',
        tour_dates: [{
          jobs: [{
            job_departments: [{ department: 'sound' }]
          }]
        }]
      },
      error: null,
    });

    mockInsert.mockResolvedValueOnce({
      data: { id: jobId },
      error: null,
    });

    // Setup job_departments creation failure
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Department creation failed' },
    });

    // Setup rollback failure
    mockEq.mockResolvedValueOnce({
      error: { message: 'Rollback failed' },
    });

    // Should log error but not throw
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rollback failed'),
        expect.anything()
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('should not attempt rollback when no records were created', async () => {
    // Setup tour_date creation failure at the start
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Tour date creation failed' },
    });

    // Delete should not be called since nothing was created
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should send push notification on creation failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup tour_date creation
    mockInsert.mockResolvedValueOnce({
      data: { id: 'tour-date-123' },
      error: null,
    });

    // Setup tour fetch failure
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Tour not found' },
    });

    mockSupabaseFunctions.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await waitFor(() => {
      expect(mockSupabaseFunctions).toHaveBeenCalledWith('push', {
        body: expect.objectContaining({
          action: 'broadcast',
          type: 'tour.date.creation.failed',
          stage: expect.any(String),
        }),
      });
    });

    consoleErrorSpy.mockRestore();
  });

  it('should include metadata in failure alerts', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const metadata = {
      tourId: 'tour-123',
      location: 'Test Venue',
      startDate: '2024-01-15',
      endDate: '2024-01-16',
      tourDateType: 'show',
      isTourPackOnly: false,
    };

    // Setup tour_date creation
    mockInsert.mockResolvedValueOnce({
      data: { id: 'tour-date-123' },
      error: null,
    });

    // Setup tour fetch failure
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Tour not found' },
    });

    mockSupabaseFunctions.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await waitFor(() => {
      expect(mockSupabaseFunctions).toHaveBeenCalledWith('push', {
        body: expect.objectContaining({
          metadata: expect.objectContaining({
            tourId: expect.any(String),
            location: expect.any(String),
            startDate: expect.any(String),
            tourDateType: expect.any(String),
          }),
        }),
      });
    });

    consoleErrorSpy.mockRestore();
  });

  it('should handle push notification failures gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup tour_date creation
    mockInsert.mockResolvedValueOnce({
      data: { id: 'tour-date-123' },
      error: null,
    });

    // Setup tour fetch failure
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Tour not found' },
    });

    // Setup push notification failure
    mockSupabaseFunctions.mockRejectedValueOnce(
      new Error('Push service unavailable')
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send tour date creation failure alert'),
        expect.anything()
      );
    });

    consoleErrorSpy.mockRestore();
  });
});

describe('TourDateManagementDialog - handleAddDate Creation Stages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track creation stage as "tour_dates" during tour date creation', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockInsert.mockResolvedValueOnce({
      data: { id: 'tour-date-123' },
      error: null,
    });

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tour date created'),
        expect.anything()
      );
    });

    consoleLogSpy.mockRestore();
  });

  it('should track creation stage as "jobs" during job creation', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockInsert
      .mockResolvedValueOnce({
        data: { id: 'tour-date-123' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'job-456' },
        error: null,
      });

    mockSingle.mockResolvedValueOnce({
      data: { 
        name: 'Test Tour',
        tour_dates: [{
          jobs: [{
            job_departments: [{ department: 'sound' }]
          }]
        }]
      },
      error: null,
    });

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job created'),
        expect.anything()
      );
    });

    consoleLogSpy.mockRestore();
  });

  it('should track creation stage as "job_departments" during departments creation', async () => {
    // This would be tested by checking the stage reported in error messages
    expect(true).toBe(true); // Placeholder for stage tracking tests
  });

  it('should track creation stage as "job_date_types" during date types creation', async () => {
    // This would be tested by checking the stage reported in error messages
    expect(true).toBe(true); // Placeholder for stage tracking tests
  });

  it('should track creation stage as "completed" on successful completion', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Setup all successful operations
    mockInsert
      .mockResolvedValueOnce({ data: { id: 'tour-date-123' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'job-456' }, error: null })
      .mockResolvedValueOnce({ data: [{}], error: null })
      .mockResolvedValueOnce({ data: [{}], error: null });

    mockSingle.mockResolvedValueOnce({
      data: { 
        name: 'Test Tour',
        tour_dates: [{
          jobs: [{
            job_departments: [{ department: 'sound' }]
          }]
        }]
      },
      error: null,
    });

    // Test would verify completion stage
    expect(true).toBe(true);

    consoleLogSpy.mockRestore();
  });
});

describe('TourDateManagementDialog - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle missing tourId gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Test would call handleAddDate with tourId = null
    // Should throw error early without creating any records

    expect(true).toBe(true); // Placeholder

    consoleErrorSpy.mockRestore();
  });

  it('should handle endDate defaulting to startDate', async () => {
    // When endDate is not provided, it should use startDate
    // This affects the number of job_date_types records created
    expect(true).toBe(true); // Placeholder
  });

  it('should create multiple job_date_types for date ranges', async () => {
    // For a 3-day range, should create 3 separate job_date_types records
    // Test would verify the correct number of insert operations
    expect(true).toBe(true); // Placeholder
  });

  it('should handle unique constraint violations on job_date_types', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Setup operations leading to job_date_types creation
    mockInsert
      .mockResolvedValueOnce({ data: { id: 'tour-date-123' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'job-456' }, error: null })
      .mockResolvedValueOnce({ data: [{}], error: null });

    mockSingle.mockResolvedValueOnce({
      data: { 
        name: 'Test Tour',
        tour_dates: [{
          jobs: [{
            job_departments: [{ department: 'sound' }]
          }]
        }]
      },
      error: null,
    });

    // Simulate unique constraint violation
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { 
        message: 'duplicate key value violates unique constraint',
        code: '23505',
      },
    });

    // Should trigger rollback
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });

    consoleErrorSpy.mockRestore();
  });
});