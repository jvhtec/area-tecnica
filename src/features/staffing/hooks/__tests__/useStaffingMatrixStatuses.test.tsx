// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CARLOS_AGENT_NAME } from '@/features/staffing/carlos'
import { useStaffingMatrixStatuses } from '../useStaffingMatrixStatuses'

const { fromMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}))

const createQueryBuilder = (result: { data: unknown[]; error: unknown | null }) => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
  }
  return builder
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useStaffingMatrixStatuses', () => {
  const originalRequests = ['availability', 'offer'].map(phase => ({
    id: `original-${phase}`, job_id: 'job-1', profile_id: 'tech-1', phase,
    status: 'confirmed', single_day: false, target_date: null,
    created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-02T10:00:00Z', requested_by: 'manager-1',
  }))
  const extendedJob = { id: 'job-1', start_time: '2026-07-02T10:00:00Z', end_time: '2026-07-06T10:00:00Z' }
  const extendedDates = [2, 3, 4, 5, 6].map(day => new Date(`2026-07-0${day}T10:00:00Z`))

  it('keeps a completed legacy whole-job cycle on its scheduled dates after extension', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation(table => createQueryBuilder({ data: table === 'staffing_requests' ? originalRequests : [], error: null }))
    const scheduled = [3, 4].map(day => ({ job_id: 'job-1', technician_id: 'tech-1', date: `2026-07-0${day}`, status: 'confirmed' }))
    const { result } = renderHook(() => useStaffingMatrixStatuses(['tech-1'], [extendedJob], extendedDates, scheduled), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect([...result.current.data!.byDate.keys()]).toEqual(['tech-1-2026-07-03', 'tech-1-2026-07-04'])
  })

  it('shows the new request cycle only on added dates alongside the original confirmation', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const addedRequest = { ...originalRequests[0], id: 'extension', status: 'pending', single_day: true, target_date: '2026-07-05', updated_at: '2026-07-03T10:00:00Z' }
    fromMock.mockImplementation(table => createQueryBuilder({ data: table === 'staffing_requests' ? [...originalRequests, addedRequest] : [], error: null }))
    const scheduled = [{ job_id: 'job-1', technician_id: 'tech-1', date: '2026-07-03', status: 'confirmed' }]
    const { result } = renderHook(() => useStaffingMatrixStatuses(['tech-1'], [extendedJob], extendedDates, scheduled), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.byDate.get('tech-1-2026-07-05')).toMatchObject({ availability_status: 'requested', offer_status: null })
    expect(result.current.data!.byDate.get('tech-1-2026-07-03')).toMatchObject({ availability_status: 'confirmed', offer_status: 'confirmed' })
    expect(result.current.data!.byDate.has('tech-1-2026-07-06')).toBe(false)
  })

  it('honors a delivery date snapshot even before confirmation', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation(table => createQueryBuilder({ data: table === 'staffing_requests'
      ? [{ ...originalRequests[0], status: 'pending' }]
      : [
        { staffing_request_id: 'original-availability', event: 'email_sent', created_at: '2026-07-02T10:00:00Z', meta: { status: 200, dates: ['2026-07-03', '2026-07-04', '2026-07-05'] } },
        { staffing_request_id: 'original-availability', event: 'email_sent', created_at: '2026-07-01T10:00:00Z', meta: { status: 200, dates: ['2026-07-03', '2026-07-04'] } },
      ], error: null }))
    const { result } = renderHook(() => useStaffingMatrixStatuses(['tech-1'], [extendedJob], extendedDates), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect([...result.current.data!.byDate.keys()]).toEqual(['tech-1-2026-07-03', 'tech-1-2026-07-04'])
  })

  it('recomputes date statuses when the same job changes dates or scheduling changes', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation(table => createQueryBuilder({ data: table === 'staffing_requests' ? originalRequests : [], error: null }))
    const originalJob = { ...extendedJob, end_time: '2026-07-04T10:00:00Z' }
    const originalSchedule = [{ job_id: 'job-1', technician_id: 'tech-1', date: '2026-07-03', status: 'confirmed' }]
    const { result, rerender } = renderHook(({ jobs, scheduled }) => useStaffingMatrixStatuses(['tech-1'], jobs, extendedDates, scheduled),
      { wrapper: createWrapper(), initialProps: { jobs: [originalJob], scheduled: originalSchedule } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const calls = fromMock.mock.calls.length
    rerender({ jobs: [extendedJob], scheduled: originalSchedule })
    await waitFor(() => expect(fromMock.mock.calls.length).toBeGreaterThan(calls))
    expect(result.current.data!.byDate.has('tech-1-2026-07-05')).toBe(false)
    rerender({ jobs: [extendedJob], scheduled: [...originalSchedule, { ...originalSchedule[0], date: '2026-07-05' }] })
    await waitFor(() => expect(result.current.data!.byDate.has('tech-1-2026-07-05')).toBe(true))
  })

  beforeEach(() => {
    fromMock.mockReset()
    rpcMock.mockReset()
  })

  it('includes job titles in date-level hover metadata for availability and offers', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_assignment_matrix_staffing_filtered') {
        return Promise.resolve({ data: [], error: null })
      }

      return Promise.resolve({ data: [], error: null })
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'staffing_requests') {
        return createQueryBuilder({
          data: [
            {
              id: 'req-av-1',
              job_id: 'job-1',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'pending',
              updated_at: '2026-04-10T08:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T07:55:00.000Z',
              requested_by: 'manager-1',
            },
            {
              id: 'req-av-2',
              job_id: 'job-2',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'confirmed',
              updated_at: '2026-04-10T09:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T08:55:00.000Z',
              requested_by: 'manager-2',
            },
            {
              id: 'req-offer-1',
              job_id: 'job-2',
              profile_id: 'tech-1',
              phase: 'offer',
              status: 'pending',
              updated_at: '2026-04-10T10:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T09:55:00.000Z',
              requested_by: 'manager-2',
            },
          ],
          error: null,
        })
      }

      if (table === 'staffing_events') {
        return createQueryBuilder({
          data: [
            {
              staffing_request_id: 'req-av-2',
              event: 'whatsapp_sent',
              meta: { request_origin: 'auto_staffing' },
              created_at: '2026-04-10T08:56:00.000Z',
            },
            {
              staffing_request_id: 'req-offer-1',
              event: 'email_sent',
              meta: { request_origin: 'auto_staffing' },
              created_at: '2026-04-10T09:56:00.000Z',
            },
          ],
          error: null,
        })
      }

      return createQueryBuilder({ data: [], error: null })
    })

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        [
          {
            id: 'job-1',
            title: 'Load-in Day',
            start_time: '2026-04-10T06:00:00.000Z',
            end_time: '2026-04-10T12:00:00.000Z',
          },
          {
            id: 'job-2',
            title: 'Arena Show',
            start_time: '2026-04-10T12:00:00.000Z',
            end_time: '2026-04-10T23:00:00.000Z',
          },
        ],
        [new Date('2026-04-10T12:00:00.000Z')],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const status = result.current.data?.byDate.get('tech-1-2026-04-10')
    expect(status).toMatchObject({
      availability_status: 'confirmed',
      availability_job_id: 'job-2',
      availability_job_title: 'Arena Show',
      offer_status: 'sent',
      offer_job_id: 'job-2',
      offer_job_title: 'Arena Show',
      availability_actor_label: CARLOS_AGENT_NAME,
      offer_actor_label: CARLOS_AGENT_NAME,
    })
    expect(status?.pending_availability_job_titles).toEqual(['Load-in Day', 'Arena Show'])
    expect(status?.pending_offer_job_titles).toEqual(['Arena Show'])
  })

  it('uses request ids from the RPC fallback to attribute Carlos activity', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_assignment_matrix_staffing_filtered') {
        return Promise.resolve({ data: [], error: null })
      }

      if (fn === 'get_staffing_requests_matrix_filtered') {
        return Promise.resolve({
          data: [
            {
              id: 'rpc-availability-1',
              job_id: 'job-1',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'pending',
              updated_at: '2026-04-10T08:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T07:55:00.000Z',
              requested_by: 'manager-1',
            },
          ],
          error: null,
        })
      }

      return Promise.resolve({ data: [], error: null })
    })

    fromMock.mockImplementation((table: string) => {
      if (table === 'staffing_requests') {
        return createQueryBuilder({ data: [], error: new Error('direct read blocked') })
      }

      if (table === 'staffing_events') {
        return createQueryBuilder({
          data: [
            {
              staffing_request_id: 'rpc-availability-1',
              event: 'email_sent',
              meta: { request_origin: 'auto_staffing' },
              created_at: '2026-04-10T07:56:00.000Z',
            },
          ],
          error: null,
        })
      }

      return createQueryBuilder({ data: [], error: null })
    })

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        [
          {
            id: 'job-1',
            title: 'Fallback Show',
            start_time: '2026-04-10T06:00:00.000Z',
            end_time: '2026-04-10T23:00:00.000Z',
          },
        ],
        [new Date('2026-04-10T12:00:00.000Z')],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const status = result.current.data?.byDate.get('tech-1-2026-04-10')
    expect(status).toMatchObject({
      availability_status: 'requested',
      availability_actor_label: CARLOS_AGENT_NAME,
    })
  })
  it('matches full-span requests on the Madrid day the column represents', async () => {
    // The matrix supplies local-midnight calendar values; in a browser east of
    // Madrid the column keyed Madrid 2026-04-10 is backed by a Date whose local
    // day is the 11th. The overlap check must use the Madrid day either way.
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'staffing_requests') {
        return createQueryBuilder({
          data: [
            {
              id: 'req-span',
              job_id: 'job-span',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'pending',
              updated_at: '2026-04-10T08:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T07:55:00.000Z',
              requested_by: 'manager-1',
            },
          ],
          error: null,
        })
      }
      return createQueryBuilder({ data: [], error: null })
    })

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        [
          {
            id: 'job-span',
            title: 'Single Madrid Day',
            // 08:00-20:00 Madrid on 2026-04-10 (CEST, UTC+2)
            start_time: '2026-04-10T06:00:00.000Z',
            end_time: '2026-04-10T18:00:00.000Z',
          },
        ],
        [
          new Date('2026-04-09T23:00:00.000Z'), // Madrid 2026-04-10 01:00
          new Date('2026-04-10T23:00:00.000Z'), // Madrid 2026-04-11 01:00
        ],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.byDate.get('tech-1-2026-04-10')).toMatchObject({
      availability_status: 'requested',
    })
    // The following Madrid day is outside the job span and must stay empty.
    expect(result.current.data?.byDate.get('tech-1-2026-04-11')).toBeUndefined()
  })

  it('returns empty maps without touching Supabase when any input dimension is empty', async () => {
    const { result } = renderHook(
      () => useStaffingMatrixStatuses([], [], []),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.byJob.size).toBe(0)
    expect(result.current.data?.byDate.size).toBe(0)
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('maps job-level pending states and clears expired states', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_assignment_matrix_staffing_filtered') {
        return Promise.resolve({
          data: [
            {
              job_id: 'job-1',
              profile_id: 'tech-1',
              availability_status: 'pending',
              offer_status: 'expired',
            },
            {
              job_id: 'job-2',
              profile_id: 'tech-1',
              availability_status: 'expired',
              offer_status: 'pending',
            },
            {
              job_id: 'job-3',
              profile_id: 'tech-1',
              availability_status: 'unexpected',
              offer_status: null,
            },
          ],
          error: null,
        })
      }
      return Promise.resolve({ data: [], error: null })
    })
    fromMock.mockReturnValue(createQueryBuilder({ data: [], error: null }))

    const jobs = ['job-1', 'job-2', 'job-3'].map((id) => ({
      id,
      title: id,
      start_time: '2026-04-10T06:00:00.000Z',
      end_time: '2026-04-10T18:00:00.000Z',
    }))

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        jobs,
        [new Date('2026-04-10T12:00:00.000Z')],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.byJob.get('job-1-tech-1')).toEqual({
      availability_status: 'requested',
      offer_status: null,
    })
    expect(result.current.data?.byJob.get('job-2-tech-1')).toEqual({
      availability_status: null,
      offer_status: 'sent',
    })
    expect(result.current.data?.byJob.has('job-3-tech-1')).toBe(false)
  })

  it('lets the newest expired request clear an older visible request on the same date', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'staffing_requests') {
        return createQueryBuilder({
          data: [
            {
              id: 'req-new-expired',
              job_id: 'job-1',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'expired',
              updated_at: '2026-04-10T10:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T09:59:00.000Z',
              requested_by: 'manager-1',
            },
            {
              id: 'req-old-pending',
              job_id: 'job-1',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'pending',
              updated_at: '2026-04-10T08:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T07:59:00.000Z',
              requested_by: 'manager-1',
            },
          ],
          error: null,
        })
      }
      return createQueryBuilder({ data: [], error: null })
    })

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        [{
          id: 'job-1',
          title: 'Cleared Show',
          start_time: '2026-04-10T06:00:00.000Z',
          end_time: '2026-04-10T18:00:00.000Z',
        }],
        [new Date('2026-04-10T12:00:00.000Z')],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.byDate.get('tech-1-2026-04-10')).toBeUndefined()
  })

  it('keeps single-day requests pinned to target_date even if the job span moves', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'staffing_requests') {
        return createQueryBuilder({
          data: [{
            id: 'req-single',
            job_id: 'job-1',
            profile_id: 'tech-1',
            phase: 'offer',
            status: 'pending',
            updated_at: '2026-04-10T08:00:00.000Z',
            single_day: true,
            target_date: '2026-04-10',
            created_at: '2026-04-10T07:55:00.000Z',
            requested_by: 'manager-1',
          }],
          error: null,
        })
      }
      return createQueryBuilder({ data: [], error: null })
    })

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        [{
          id: 'job-1',
          title: 'Rescheduled Show',
          start_time: '2026-04-11T06:00:00.000Z',
          end_time: '2026-04-11T18:00:00.000Z',
        }],
        [
          new Date('2026-04-10T12:00:00.000Z'),
          new Date('2026-04-11T12:00:00.000Z'),
        ],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.byDate.get('tech-1-2026-04-10')).toMatchObject({
      offer_status: 'sent',
      offer_job_id: 'job-1',
    })
    expect(result.current.data?.byDate.get('tech-1-2026-04-11')).toBeUndefined()
  })

  it('selects the latest availability and latest offer independently across visible jobs', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockImplementation((table: string) => {
      if (table === 'staffing_requests') {
        return createQueryBuilder({
          data: [
            {
              id: 'avail-new',
              job_id: 'job-a',
              profile_id: 'tech-1',
              phase: 'availability',
              status: 'confirmed',
              updated_at: '2026-04-10T09:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T08:50:00.000Z',
              requested_by: 'manager-a',
            },
            {
              id: 'offer-new',
              job_id: 'job-b',
              profile_id: 'tech-1',
              phase: 'offer',
              status: 'declined',
              updated_at: '2026-04-10T10:00:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T09:50:00.000Z',
              requested_by: 'manager-b',
            },
            {
              id: 'offer-old',
              job_id: 'job-a',
              profile_id: 'tech-1',
              phase: 'offer',
              status: 'pending',
              updated_at: '2026-04-10T08:30:00.000Z',
              single_day: false,
              target_date: null,
              created_at: '2026-04-10T08:20:00.000Z',
              requested_by: 'manager-a',
            },
          ],
          error: null,
        })
      }
      return createQueryBuilder({ data: [], error: null })
    })

    const jobs = [
      {
        id: 'job-a',
        title: 'A Stage',
        start_time: '2026-04-10T06:00:00.000Z',
        end_time: '2026-04-10T18:00:00.000Z',
      },
      {
        id: 'job-b',
        title: 'B Stage',
        start_time: '2026-04-10T07:00:00.000Z',
        end_time: '2026-04-10T19:00:00.000Z',
      },
    ]

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        ['tech-1'],
        jobs,
        [new Date('2026-04-10T12:00:00.000Z')],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.byDate.get('tech-1-2026-04-10')).toMatchObject({
      availability_status: 'confirmed',
      availability_job_id: 'job-a',
      availability_job_title: 'A Stage',
      offer_status: 'declined',
      offer_job_id: 'job-b',
      offer_job_title: 'B Stage',
    })
  })

  it('chunks large matrix status RPC requests at 100 technicians by 100 jobs', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    fromMock.mockReturnValue(createQueryBuilder({ data: [], error: null }))

    const technicianIds = Array.from({ length: 101 }, (_, index) => `tech-${index}`)
    const jobs = Array.from({ length: 101 }, (_, index) => ({
      id: `job-${index}`,
      title: `Job ${index}`,
      start_time: '2026-04-10T06:00:00.000Z',
      end_time: '2026-04-10T18:00:00.000Z',
    }))

    const { result } = renderHook(
      () => useStaffingMatrixStatuses(
        technicianIds,
        jobs,
        [new Date('2026-04-10T12:00:00.000Z')],
      ),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const statusCalls = rpcMock.mock.calls.filter(
      ([fn]) => fn === 'get_assignment_matrix_staffing_filtered',
    )
    expect(statusCalls).toHaveLength(4)
    expect(statusCalls.map(([, args]) => [
      args.p_profile_ids.length,
      args.p_job_ids.length,
    ])).toEqual(expect.arrayContaining([
      [100, 100],
      [100, 1],
      [1, 100],
      [1, 1],
    ]))
  })

})
