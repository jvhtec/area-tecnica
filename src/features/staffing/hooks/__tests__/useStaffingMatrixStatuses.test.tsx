// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useStaffingMatrixStatuses } from '../useStaffingMatrixStatuses'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}))

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
    rpcMock.mockReset()
  })

  it('includes job titles in date-level hover metadata for availability and offers', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_assignment_matrix_staffing_filtered') {
        return Promise.resolve({ data: [], error: null })
      }

      if (fn === 'get_staffing_requests_matrix_filtered') {
        return Promise.resolve({
          data: [
            {
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

      return Promise.resolve({ data: [], error: null })
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
    })
    expect(status?.pending_availability_job_titles).toEqual(['Load-in Day', 'Arena Show'])
    expect(status?.pending_offer_job_titles).toEqual(['Arena Show'])
  })
})
