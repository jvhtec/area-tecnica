// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from '@/test/mockSupabase'

vi.mock('@/services/dataLayerClient', () => ({ dataLayerClient: mockSupabase }))
vi.mock('@/hooks/useAppBadgeSource', () => ({ useAppBadgeSource: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}))

import { NotificationBadge } from '../NotificationBadge'

describe('NotificationBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    resetMockSupabase()
  })

  afterEach(() => vi.useRealTimers())

  it('counts the current user unread notification inbox', async () => {
    const builder = createMockQueryBuilder({ data: null, error: null, count: 3 })
    mockSupabase.from.mockReturnValue(builder)
    render(<NotificationBadge userId="user-1" userRole="technician" userDepartment={null} />)
    await act(async () => undefined)

    expect(mockSupabase.from).toHaveBeenCalledWith('notification_inbox')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(builder.is).toHaveBeenCalledWith('read_at', null)
  })

  it('polls on a stable thirty-second interval', async () => {
    mockSupabase.from.mockImplementation(() => createMockQueryBuilder({ data: null, error: null, count: 0 }))
    render(<NotificationBadge userId="user-1" userRole="management" userDepartment="sound" />)
    await act(async () => undefined)
    expect(mockSupabase.from).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(mockSupabase.from).toHaveBeenCalledTimes(2)
  })
})
