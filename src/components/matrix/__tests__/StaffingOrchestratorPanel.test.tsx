// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CARLOS_AGENT_NAME } from '@/features/staffing/carlos'
import { StaffingOrchestratorPanel } from '../StaffingOrchestratorPanel'

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: useQueryMock,
  }
})

vi.mock('@/hooks/useStaffingCampaignRealtime', () => ({
  useStaffingCampaignRealtime: vi.fn(),
  useStaffingCampaignRolesRealtime: vi.fn(),
  useStaffingRequestsRealtime: vi.fn(),
}))

vi.mock('../StaffingCampaignPanel', () => ({
  StaffingCampaignPanel: () => <div data-testid="campaign-panel" />,
}))

vi.mock('../StaffingAutoModePanel', () => ({
  StaffingAutoModePanel: () => <div data-testid="auto-mode-panel" />,
}))

vi.mock('../StaffingCandidateList', () => ({
  StaffingCandidateList: (props: {
    actorLabel?: string
    mode?: string
    readOnly?: boolean
    roleCode: string
  }) => (
    <div
      data-testid="candidate-list"
      data-actor={props.actorLabel}
      data-mode={props.mode}
      data-readonly={String(props.readOnly)}
    >
      {props.roleCode}
    </div>
  ),
}))

vi.mock('../StaffingOfferList', () => ({
  StaffingOfferList: (props: {
    actorLabel?: string
    readOnly?: boolean
    roleCode: string
  }) => (
    <div
      data-testid="offer-list"
      data-actor={props.actorLabel}
      data-readonly={String(props.readOnly)}
    >
      {props.roleCode}
    </div>
  ),
}))

const autoCampaign = {
  id: 'campaign-1',
  job_id: 'job-1',
  department: 'sound',
  mode: 'auto',
  status: 'active',
  policy: {},
  created_at: '2026-04-10T08:00:00.000Z',
  updated_at: '2026-04-10T08:00:00.000Z',
}

const campaignRoles = [
  {
    id: 'role-1',
    campaign_id: 'campaign-1',
    role_code: 'foh',
    assigned_count: 0,
    pending_availability: 1,
    confirmed_availability: 0,
    pending_offers: 0,
    accepted_offers: 0,
    stage: 'availability',
  },
]

describe('StaffingOrchestratorPanel', () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const scope = String(queryKey[0])
      if (scope === 'staffing_campaign') {
        return { data: autoCampaign, refetch: vi.fn(), isLoading: false }
      }
      if (scope === 'staffing_campaign_roles') {
        return { data: campaignRoles, isLoading: false }
      }
      if (scope === 'staffing_required_roles') {
        return {
          data: {
            roles: [{ role_code: 'foh', quantity: 1 }],
          },
          isLoading: false,
        }
      }
      return { data: null, isLoading: false }
    })
  })

  it('keeps Candidates and Offers visible in Carlos auto mode as read-only activity tabs', async () => {
    const user = userEvent.setup()

    render(
      <StaffingOrchestratorPanel
        jobId="job-1"
        department="sound"
        jobTitle="Arena Show"
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Candidates' }))
    const candidateList = screen.getByTestId('candidate-list')
    expect(candidateList).toHaveAttribute('data-mode', 'auto')
    expect(candidateList).toHaveAttribute('data-readonly', 'true')
    expect(candidateList).toHaveAttribute('data-actor', CARLOS_AGENT_NAME)

    await user.click(screen.getByRole('tab', { name: 'Offers' }))
    const offerList = screen.getByTestId('offer-list')
    expect(offerList).toHaveAttribute('data-readonly', 'true')
    expect(offerList).toHaveAttribute('data-actor', CARLOS_AGENT_NAME)
  })
})
