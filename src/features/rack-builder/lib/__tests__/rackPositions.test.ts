import { describe, expect, it } from 'vitest'
import { getSlotStyle, slotsConflict } from '../rackPositions'

describe('rackPositions', () => {
  it('mirrors dual-rack quarter slots in rear view', () => {
    const front = getSlotStyle({ outer: 0, inner: 0 }, 'dual', 'front')
    const rear = getSlotStyle({ outer: 0, inner: 0 }, 'dual', 'rear')

    expect(front).toEqual({ left: '0%', width: '25%' })
    expect(rear).toEqual({ left: '75%', width: '25%' })
  })

  it('mirrors single-rack half slots in rear view', () => {
    const front = getSlotStyle({ outer: 0, inner: null }, 'single', 'front')
    const rear = getSlotStyle({ outer: 0, inner: null }, 'single', 'rear')

    expect(front).toEqual({ left: '0%', width: '50%' })
    expect(rear).toEqual({ left: '50%', width: '50%' })
  })

  it('treats different half slots as non-conflicting', () => {
    expect(
      slotsConflict(
        { outer: 0, inner: 0 },
        { outer: 0, inner: 1 },
      ),
    ).toBe(false)
  })
})
