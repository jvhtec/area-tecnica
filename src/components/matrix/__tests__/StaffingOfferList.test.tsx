// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CARLOS_AGENT_NAME } from '@/features/staffing/carlos'
import { StaffingOfferList } from '../StaffingOfferList'

type QueryResult = {
  data: Array<Record<string, unknown>>
  error: Error | null
}

const { fromMock, toastMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: {
    auth: {
      getSession: vi.fn(),
    },
    from: fromMock,
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
    if (table === 'staffing_requests' && selected.includes('role_code')) {
      return {
        data: [
          {
            id: 'offer-1',
            profile_id: 'tech-1',
            status: 'pending',
            created_at: '2026-04-10T09:00:00.000Z',
            updated_at: '2026-04-10T09:00:00.000Z',
            role_code: null,
          },
          {
            id: 'offer-2',
            profile_id: 'tech-2',
            status: 'pending',
            created_at: '2026-04-10T09:05:00.000Z',
            updated_at: '2026-04-10T09:05:00.000Z',
            role_code: 'foh',
          },
        ],
        error: null,
      }
    }

    if (table === 'staffing_requests') {
      return {
        data: [
          {
            id: 'availability-1',
            profile_id: 'tech-1',
            status: 'confirmed',
            created_at: '2026-04-10T08:00:00.000Z',
            updated_at: '2026-04-10T08:30:00.000Z',
          },
        ],
        error: null,
      }
    }

    if (table === 'staffing_events') {
      return {
        data: [
          {
            staffing_request_id: 'availability-1',
            event: 'email_sent',
            meta: {
              phase: 'availability',
              role: 'foh',
            },
            created_at: '2026-04-10T08:05:00.000Z',
          },
          {
            staffing_request_id: 'offer-1',
            event: 'email_sent',
            meta: {
              phase: 'offer',
              role: 'foh',
              request_origin: 'auto_staffing',
            },
            created_at: '2026-04-10T09:00:00.000Z',
          },
          {
            staffing_request_id: 'offer-2',
            event: 'email_sent',
            meta: {
              phase: 'offer',
              role: 'foh',
              request_origin: 'manual',
            },
            created_at: '2026-04-10T09:05:00.000Z',
          },
        ],
        error: null,
      }
    }

    if (table === 'profiles') {
      return {
        data: [
          {
            id: 'tech-1',
            first_name: 'Offer',
            last_name: 'Tech',
            nickname: null,
            email: 'offer@example.com',
          },
          {
            id: 'tech-2',
            first_name: 'Manual',
            last_name: 'Offer',
            nickname: null,
            email: 'manual@example.com',
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
    order: vi.fn(() => Promise.resolve(resolve())),
    then: vi.fn((onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected)),
  }
  return builder
}

describe('StaffingOfferList', () => {
  beforeEach(() => {
    fromMock.mockReset()
    toastMock.mockReset()
    fromMock.mockImplementation((table: string) => createQueryBuilder(table))
  })

  it('shows sent Carlos offers in read-only mode without manual offer controls', async () => {
    render(
      <StaffingOfferList
        campaignId="campaign-1"
        roleCode="foh"
        jobId="job-1"
        department="sound"
        readOnly
        actorLabel={CARLOS_AGENT_NAME}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(screen.getAllByText('Offer Tech').length).toBeGreaterThan(0)
      expect(screen.getByText('Manual Offer')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Offer sent')).toHaveLength(2)
    expect(screen.getAllByText(`Enviado por ${CARLOS_AGENT_NAME}`)).toHaveLength(1)
    expect(screen.queryByText('Send offers by')).not.toBeInTheDocument()
    expect(screen.queryByText(/Send Offers/i)).not.toBeInTheDocument()
  })
})
