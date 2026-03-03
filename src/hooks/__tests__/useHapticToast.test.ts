import { describe, expect, it, vi, beforeEach } from 'vitest'

const hapticMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  tap: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}))

vi.mock('@/lib/haptics', () => ({
  haptics: hapticMocks,
}))

vi.mock('sonner', () => ({
  toast: toastMocks,
}))

describe('hapticToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers success haptic and success toast', async () => {
    const { hapticToast } = await import('@/hooks/useHapticToast')

    hapticToast.success('Saved', { description: 'ok' })

    expect(hapticMocks.success).toHaveBeenCalledOnce()
    expect(toastMocks.success).toHaveBeenCalledWith('Saved', { description: 'ok' })
  })

  it('can disable haptic per call', async () => {
    const { hapticToast } = await import('@/hooks/useHapticToast')

    hapticToast.error('Failed', { haptic: false })

    expect(hapticMocks.error).not.toHaveBeenCalled()
    expect(toastMocks.error).toHaveBeenCalledWith('Failed', { description: undefined })
  })

  it('emits warning haptic for destructive confirmation helper', async () => {
    const { hapticToast } = await import('@/hooks/useHapticToast')

    hapticToast.destructiveConfirm()

    expect(hapticMocks.warning).toHaveBeenCalledOnce()
  })
})
