import { describe, expect, it } from 'vitest'
import { buildRackFaceViewModel, selectFacingImagePath } from '../rackViewModel'
import type { DeviceFacing, LayoutItemWithDevice } from '../../types'

function makeItem(args: {
  id: string
  facing: DeviceFacing
  startU: number
  rackUnits: number
  preferredLane: 0 | 1 | null
  frontImage: string | null
  rearImage: string | null
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
    preferred_sub_lane: null,
    force_full_width: false,
    rack_ear_offset_mm: 0,
    custom_name: null,
    notes: null,
    device: {
      id: args.id,
      brand: 'Brand',
      model: 'Model',
      rack_units: args.rackUnits,
      depth_mm: 350,
      weight_kg: 0,
      power_w: 0,
      is_half_rack: false,
      category_id: 'cat-1',
      fav: false,
      invert_image_in_dark_mode: false,
      front_image_path: args.frontImage,
      rear_image_path: args.rearImage,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      category: null,
    },
    panel_layout: null,
  }
}

describe('rackViewModel', () => {
  it('keeps opposite-face ghosts only when not occluded by active items', () => {
    const active = makeItem({
      id: 'front-active',
      facing: 'front',
      startU: 10,
      rackUnits: 2,
      preferredLane: 0,
      frontImage: 'front-a.png',
      rearImage: 'rear-a.png',
    })
    const occludedGhost = makeItem({
      id: 'rear-occluded',
      facing: 'rear',
      startU: 10,
      rackUnits: 2,
      preferredLane: 0,
      frontImage: 'front-b.png',
      rearImage: 'rear-b.png',
    })
    const visibleGhost = makeItem({
      id: 'rear-visible',
      facing: 'rear',
      startU: 10,
      rackUnits: 2,
      preferredLane: 1,
      frontImage: 'front-c.png',
      rearImage: 'rear-c.png',
    })

    const vm = buildRackFaceViewModel([active, occludedGhost, visibleGhost], 'front', 'dual')

    expect(vm.activeItems.map((item) => item.id)).toEqual(['front-active'])
    expect(vm.ghostItems.map((item) => item.id)).toEqual(['rear-visible'])
  })

  it('selects image path by visible device side (mounted face + current view) without fallback', () => {
    const frontMounted = makeItem({
      id: 'device-front',
      facing: 'front',
      startU: 1,
      rackUnits: 1,
      preferredLane: 0,
      frontImage: null,
      rearImage: 'rear-front-mounted.png',
    })
    const rearMounted = makeItem({
      id: 'device-rear',
      facing: 'rear',
      startU: 1,
      rackUnits: 1,
      preferredLane: 0,
      frontImage: 'front-rear-mounted.png',
      rearImage: null,
    })

    expect(selectFacingImagePath(frontMounted, 'front')).toBeNull()
    expect(selectFacingImagePath(frontMounted, 'rear')).toBe('rear-front-mounted.png')
    expect(selectFacingImagePath(rearMounted, 'rear')).toBe('front-rear-mounted.png')
    expect(selectFacingImagePath(rearMounted, 'front')).toBeNull()
  })
})
