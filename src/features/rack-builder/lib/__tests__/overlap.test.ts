import { describe, expect, it } from 'vitest'
import { findDepthConflict } from '../overlap'
import { getItemSlot, preferenceToSlot } from '../rackPositions'
import type { DeviceFacing, LayoutItemWithDevice } from '../../types'

function makeItem(args: {
  id: string
  facing: DeviceFacing
  startU: number
  rackUnits: number
  depthMm: number
  preferredLane: 0 | 1 | null
  preferredSubLane?: 0 | 1 | null
  isHalfRack?: boolean
}): LayoutItemWithDevice {
  return {
    id: args.id,
    layout_id: 'layout-1',
    device_id: args.id,
    panel_layout_id: null,
    asset_kind: 'device',
    start_u: args.startU,
    facing: args.facing,
    preferred_lane: args.preferredLane,
    preferred_sub_lane: args.preferredSubLane ?? null,
    force_full_width: false,
    rack_ear_offset_mm: 0,
    custom_name: null,
    notes: null,
    device: {
      id: args.id,
      brand: 'Brand',
      model: 'Model',
      rack_units: args.rackUnits,
      depth_mm: args.depthMm,
      weight_kg: 0,
      power_w: 0,
      is_half_rack: args.isHalfRack ?? false,
      category_id: 'cat-1',
      fav: false,
      invert_image_in_dark_mode: false,
      front_image_path: 'front.png',
      rear_image_path: 'rear.png',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      category: null,
    },
    panel_layout: null,
  }
}

describe('depth overlap rules', () => {

  it('accounts for rack ear offset when calculating effective depth', () => {
    const frontItem = makeItem({
      id: 'front-offset',
      facing: 'front',
      startU: 4,
      rackUnits: 1,
      depthMm: 500,
      preferredLane: 0,
    })
    frontItem.rack_ear_offset_mm = 150

    const conflict = findDepthConflict(
      4,
      1,
      'rear',
      360,
      0,
      [frontItem],
      800,
      undefined,
      preferenceToSlot('dual', false, 0),
      'dual',
      new Map([[frontItem.id, getItemSlot(frontItem, 'dual')]]),
    )

    expect(conflict).toBeNull()
  })
  it('reports depth collision only when target slot footprint overlaps opposite side', () => {
    const frontItem = makeItem({
      id: 'front-1',
      facing: 'front',
      startU: 10,
      rackUnits: 2,
      depthMm: 500,
      preferredLane: 0,
    })
    const oppositeSlots = new Map([[frontItem.id, getItemSlot(frontItem, 'dual')]])

    const sameFootprintConflict = findDepthConflict(
      10,
      2,
      'rear',
      400,
      0,
      [frontItem],
      800,
      undefined,
      preferenceToSlot('dual', false, 0),
      'dual',
      oppositeSlots,
    )
    expect(sameFootprintConflict).not.toBeNull()
    expect(sameFootprintConflict?.combinedDepthMm).toBe(900)

    const differentFootprintConflict = findDepthConflict(
      10,
      2,
      'rear',
      400,
      0,
      [frontItem],
      800,
      undefined,
      preferenceToSlot('dual', false, 1),
      'dual',
      oppositeSlots,
    )
    expect(differentFootprintConflict).toBeNull()
  })
})
