// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CARLOS_AGENT_NAME } from '@/features/staffing/carlos'
import { StaffingCandidateList } from '../StaffingCandidateList'

type QueryResult = {
  data: Array<Record<string, unknown>>
  error: Error | null
}

const { fromMock, rpcMock, toastMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: {
    auth: {
      getSession: vi.fn(),
    },
    from: fromMock,
    rpc: rpcMock,
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
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

const createQueryBuilder = (table: string) => {
  let selected = ''
  const resolve = (): QueryResult => {
    if (table === 'profiles') {
      return {
        data: [
          { id: 'tech-1', profile_picture_url: null },
          { id: 'tech-2', profile_picture_url: null },
        ],
        error: null,
      }
    }

    if (table === 'staffing_events') {
      return {
        data: [
          {
            staffing_request_id: 'req-availability-1',
            event: 'whatsapp_sent',
            meta: {
              phase: 'availability',
              role: 'foh',
              request_origin: 'auto_staffing',
            },
            created_at: '2026-04-10T08:05:00.000Z',
          },
        ],
        error: null,
      }
    }

    if (table === 'staffing_requests' && selected.includes('role_code')) {
      return {
        data: [
          {
            id: 'req-availability-1',
            profile_id: 'tech-1',
            phase: 'availability',
            status: 'pending',
            target_date: null,
            single_day: false,
            updated_at: '2026-04-10T08:05:00.000Z',
            created_at: '2026-04-10T08:00:00.000Z',
            role_code: null,
          },
        ],
        error: null,
      }
    }

    return { data: [], error: null }
  }

  const builder: any = {
    select: vi.fn((value: string) => {
      selected = value
      return builder
    }),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(resolve())),
    then: vi.fn((onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected)),
  }
  return builder
}

describe('StaffingCandidateList', () => {
  beforeEach(() => {
    fromMock.mockReset()
    rpcMock.mockReset()
    toastMock.mockReset()

    fromMock.mockImplementation((table: string) => createQueryBuilder(table))
    rpcMock.mockResolvedValue({
      data: [
        {
          profile_id: 'tech-1',
          full_name: 'Confirmed Tech',
          department: 'sound',
          skills_score: 91,
          distance_to_madrid_km: 12.4,
          proximity_score: 80,
          experience_score: 84,
          reliability_score: 89,
          fairness_score: 72,
          soft_conflict: false,
          hard_conflict: false,
          final_score: 92,
          reasons: [],
        },
        {
          profile_id: 'tech-2',
          full_name: 'Next Tech',
          department: 'sound',
          skills_score: 78,
          distance_to_madrid_km: 20.1,
          proximity_score: 70,
          experience_score: 76,
          reliability_score: 80,
          fairness_score: 82,
          soft_conflict: false,
          hard_conflict: false,
          final_score: 81,
          reasons: [],
        },
      ],
      error: null,
    })
  })

  it('shows Carlos role activity and next candidate without manual send controls', async () => {
    render(
      <StaffingCandidateList
        campaignId="campaign-1"
        roleCode="foh"
        jobId="job-1"
        department="sound"
        policy={{}}
        mode="auto"
        readOnly
        actorLabel={CARLOS_AGENT_NAME}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(screen.getByText('Confirmed Tech')).toBeInTheDocument()
      expect(screen.getByText('Next Tech')).toBeInTheDocument()
    })

    expect(screen.getByText('Disponibilidad enviada')).toBeInTheDocument()
    expect(screen.getByText(`Enviado por ${CARLOS_AGENT_NAME}`)).toBeInTheDocument()
    expect(screen.getByText('Siguiente candidato')).toBeInTheDocument()
    expect(screen.queryByText('Enviar disponibilidad por')).not.toBeInTheDocument()
  })
})
