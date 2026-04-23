import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hapticMocks = vi.hoisted(() => ({
  tap: vi.fn().mockResolvedValue(true),
  success: vi.fn().mockResolvedValue(true),
  warning: vi.fn().mockResolvedValue(true),
  error: vi.fn().mockResolvedValue(true),
  selectionChanged: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/haptics', () => ({
  haptics: hapticMocks,
}))

import { Button } from './button'

describe('Button haptics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers tap haptic by default', () => {
    render(<Button>Default haptic</Button>)

    fireEvent.click(screen.getByRole('button', { name: 'Default haptic' }))

    expect(hapticMocks.tap).toHaveBeenCalledTimes(1)
  })

  it('does not trigger haptics when set to none', () => {
    render(<Button haptic="none">No haptic</Button>)

    fireEvent.click(screen.getByRole('button', { name: 'No haptic' }))

    expect(hapticMocks.tap).not.toHaveBeenCalled()
    expect(hapticMocks.success).not.toHaveBeenCalled()
    expect(hapticMocks.warning).not.toHaveBeenCalled()
    expect(hapticMocks.error).not.toHaveBeenCalled()
  })

  it('does not trigger haptics when click is prevented', () => {
    render(<Button onClick={(event) => event.preventDefault()}>Prevented</Button>)

    fireEvent.click(screen.getByRole('button', { name: 'Prevented' }))

    expect(hapticMocks.tap).not.toHaveBeenCalled()
  })

  it('triggers explicit semantic haptic type', () => {
    render(<Button haptic="warning">Warning haptic</Button>)

    fireEvent.click(screen.getByRole('button', { name: 'Warning haptic' }))

    expect(hapticMocks.warning).toHaveBeenCalledTimes(1)
    expect(hapticMocks.tap).not.toHaveBeenCalled()
  })
})
