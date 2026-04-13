// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAvailableTechnicians } from '../useAvailableTechnicians';

const {
  useQueryMock,
  invalidateQueriesMock,
  channelMock,
  supabaseChannelMock,
  removeChannelMock,
  getAvailableTechniciansMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
  channelMock: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
  supabaseChannelMock: vi.fn(),
  removeChannelMock: vi.fn(),
  getAvailableTechniciansMock: vi.fn(),
}));

channelMock.on.mockImplementation(() => channelMock);
channelMock.subscribe.mockReturnValue(channelMock);

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: supabaseChannelMock,
    removeChannel: removeChannelMock,
  },
}));

vi.mock('@/utils/technicianAvailability', () => ({
  getAvailableTechnicians: getAvailableTechniciansMock,
}));

describe('useAvailableTechnicians', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });
    supabaseChannelMock.mockReturnValue(channelMock);
    channelMock.on.mockImplementation(() => channelMock);
    channelMock.subscribe.mockReturnValue(channelMock);
  });

  it('subscribes to INSERT, DELETE, and UPDATE for all job assignments and invalidates the scoped cache', () => {
    const queryKey = ['available-technicians', 'sound', 'job-1', '2026-04-14T08:00:00Z', '2026-04-14T18:00:00Z', '2026-04-14'];

    renderHook(() => useAvailableTechnicians({
      department: 'sound',
      jobId: 'job-1',
      jobStartTime: '2026-04-14T08:00:00Z',
      jobEndTime: '2026-04-14T18:00:00Z',
      assignmentDate: '2026-04-14',
    }));

    expect(supabaseChannelMock).toHaveBeenCalledWith('technician-availability-updates');
    expect(channelMock.on).toHaveBeenCalledTimes(4);

    const assignmentListeners = channelMock.on.mock.calls
      .map((call) => call.slice(0, 2))
      .filter(([, config]) => config.table === 'job_assignments');

    expect(assignmentListeners).toEqual([
      ['postgres_changes', expect.objectContaining({ event: 'INSERT', schema: 'public', table: 'job_assignments' })],
      ['postgres_changes', expect.objectContaining({ event: 'DELETE', schema: 'public', table: 'job_assignments' })],
      ['postgres_changes', expect.objectContaining({ event: 'UPDATE', schema: 'public', table: 'job_assignments' })],
    ]);
    assignmentListeners.forEach(([, config]) => {
      expect(config).not.toHaveProperty('filter');
    });

    const assignmentInsertCallback = channelMock.on.mock.calls[0]?.[2];
    const assignmentDeleteCallback = channelMock.on.mock.calls[1]?.[2];
    const assignmentUpdateCallback = channelMock.on.mock.calls[2]?.[2];

    assignmentInsertCallback?.({ eventType: 'INSERT' });
    assignmentDeleteCallback?.({ eventType: 'DELETE' });
    assignmentUpdateCallback?.({ eventType: 'UPDATE' });

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(3);
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(1, { queryKey });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(2, { queryKey });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(3, { queryKey });
  });

  it('keeps the current-job filter only on jobs updates', () => {
    renderHook(() => useAvailableTechnicians({
      department: 'sound',
      jobId: 'job-99',
      jobStartTime: '2026-04-14T08:00:00Z',
      jobEndTime: '2026-04-14T18:00:00Z',
    }));

    expect(channelMock.on).toHaveBeenLastCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: 'id=eq.job-99',
      }),
      expect.any(Function),
    );
  });
});
