import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  interface QueryResponse {
    data: any;
    error: any;
  }

  const createQueryBuilder = (response: QueryResponse, terminalMethod: 'order' | 'or' | 'lte') => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.gte = vi.fn(() => builder);
    builder.lte = vi.fn(() => (terminalMethod === 'lte' ? Promise.resolve(response) : builder));
    builder.order = vi.fn(() => (terminalMethod === 'order' ? Promise.resolve(response) : builder));
    builder.or = vi.fn(() => (terminalMethod === 'or' ? Promise.resolve(response) : builder));
    return builder;
  };

  const profilesResponse = {
    data: [
      {
        id: 'tech-1',
        first_name: 'Alex',
        last_name: 'Johnson',
        department: 'sound',
        phone: '555-0101',
      },
    ],
    error: null,
  };

  const jobAssignmentsResponse = {
    data: [
      {
        technician_id: 'tech-1',
        sound_role: 'foh',
        lights_role: null,
        video_role: null,
        jobs: {
          id: 'job-1',
          title: 'Main Event',
          color: '#123456',
          start_time: '2024-05-20T10:00:00.000Z',
          end_time: null,
          status: 'scheduled',
          locations: [
            { name: 'Auditorium' },
          ],
        },
      },
    ],
    error: null,
  };

  const vacationResponse = {
    data: [],
    error: null,
  };

  const profilesQuery = createQueryBuilder(profilesResponse, 'order');
  const jobAssignmentsQuery = createQueryBuilder(jobAssignmentsResponse, 'or');
  const vacationQuery = createQueryBuilder(vacationResponse, 'lte');

  const jobAssignmentsOrMock = jobAssignmentsQuery.or as ReturnType<typeof vi.fn>;

  const subscriptionA = { id: 'assignment-channel' };
  const subscriptionB = { id: 'availability-channel' };

  const removeChannelMock = vi.fn();
  const subscriptions = [subscriptionA, subscriptionB];
  const channelMock = vi.fn(() => {
    const callIndex = channelMock.mock.calls.length;
    const subscription = subscriptions[callIndex - 1] ?? { id: `channel-${callIndex}` };
    return {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue(subscription),
    };
  });

  const fromMock = vi.fn((table: string) => {
    switch (table) {
      case 'profiles':
        return profilesQuery;
      case 'job_assignments':
        return jobAssignmentsQuery;
      case 'availability_schedules':
        return vacationQuery;
      default:
        throw new Error(`Unexpected table requested: ${table}`);
    }
  });

  return {
    profilesResponse,
    jobAssignmentsResponse,
    vacationResponse,
    profilesQuery,
    jobAssignmentsQuery,
    vacationQuery,
    jobAssignmentsOrMock,
    subscriptionA,
    subscriptionB,
    removeChannelMock,
    channelMock,
    fromMock,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: hoisted.fromMock,
    channel: hoisted.channelMock,
    removeChannel: hoisted.removeChannelMock,
  },
  checkNetworkConnection: vi.fn(),
  getRealtimeConnectionStatus: vi.fn(),
  ensureRealtimeConnection: vi.fn(),
  monitorConnectionHealth: vi.fn(),
  forceRefreshSubscriptions: vi.fn(),
}));

const {
  profilesResponse,
  jobAssignmentsResponse,
  vacationResponse,
  profilesQuery,
  jobAssignmentsQuery,
  vacationQuery,
  jobAssignmentsOrMock,
  subscriptionA,
  subscriptionB,
  removeChannelMock,
  channelMock,
  fromMock,
} = hoisted;

import { usePersonalCalendarData } from '../usePersonalCalendarData';

describe('usePersonalCalendarData', () => {
  beforeEach(() => {
    profilesQuery.select.mockClear();
    profilesQuery.in.mockClear();
    profilesQuery.eq.mockClear();
    profilesQuery.order.mockClear();

    jobAssignmentsQuery.select.mockClear();
    jobAssignmentsQuery.in.mockClear();
    jobAssignmentsQuery.lte.mockClear();
    jobAssignmentsQuery.or.mockClear();

    vacationQuery.select.mockClear();
    vacationQuery.in.mockClear();
    vacationQuery.eq.mockClear();
    vacationQuery.gte.mockClear();
    vacationQuery.lte.mockClear();

    fromMock.mockClear();
    channelMock.mockClear();
    removeChannelMock.mockClear();
  });

  it('returns assignments with fallback end_time when job end_time is null', async () => {
    const currentMonth = new Date('2024-05-01T00:00:00.000Z');
    const { result, unmount } = renderHook(() => usePersonalCalendarData(currentMonth));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.assignments).toHaveLength(1);
    const assignment = result.current.assignments[0];
    expect(assignment.job.end_time).toBe(jobAssignmentsResponse.data[0].jobs.start_time);
    expect(jobAssignmentsOrMock).toHaveBeenCalledWith(expect.stringContaining('jobs.end_time.is.null'));

    unmount();
    expect(removeChannelMock).toHaveBeenCalledWith(subscriptionA);
    expect(removeChannelMock).toHaveBeenCalledWith(subscriptionB);
  });
});
