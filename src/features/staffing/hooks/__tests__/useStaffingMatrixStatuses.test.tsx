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
})
