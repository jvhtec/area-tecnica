import type { DeviceFacing, LayoutItemWithDevice, RackWidth } from '../types'
import { buildSlotAssignments, getItemSlot, slotsConflict, type ItemSlot } from './rackPositions'

export interface RackFaceViewModel {
  activeItems: LayoutItemWithDevice[]
  activeSlotByItemId: Map<string, ItemSlot>
  ghostItems: LayoutItemWithDevice[]
  ghostSlotByItemId: Map<string, ItemSlot>
}

function verticalRangesOverlap(aStartU: number, aHeightRu: number, bStartU: number, bHeightRu: number): boolean {
  const aTop = aStartU + aHeightRu - 1
  const bTop = bStartU + bHeightRu - 1
  return aStartU <= bTop && aTop >= bStartU
}

export function buildRackFaceViewModel(
  items: LayoutItemWithDevice[],
  facing: DeviceFacing,
  rackWidth: RackWidth,
): RackFaceViewModel {
  const activeItems = items.filter((item) => item.facing === facing)
  const oppositeItems = items.filter((item) => item.facing !== facing)

  const activeSlotByItemId = buildSlotAssignments(activeItems, rackWidth)
  const oppositeSlotByItemId = buildSlotAssignments(oppositeItems, rackWidth)

  const ghostItems = oppositeItems.filter((opposite) => {
    const oppositeSlot = oppositeSlotByItemId.get(opposite.id) ?? getItemSlot(opposite, rackWidth)
    return !activeItems.some((active) => {
      const activeSlot = activeSlotByItemId.get(active.id) ?? getItemSlot(active, rackWidth)
      if (!slotsConflict(oppositeSlot, activeSlot)) return false
      return verticalRangesOverlap(
        opposite.start_u,
        opposite.device.rack_units,
        active.start_u,
        active.device.rack_units,
      )
    })
  })

  return {
    activeItems,
    activeSlotByItemId,
    ghostItems,
    ghostSlotByItemId: oppositeSlotByItemId,
  }
}

export function resolveVisibleImageSide(itemFacing: DeviceFacing, viewFacing: DeviceFacing): DeviceFacing {
  return itemFacing === viewFacing ? 'front' : 'rear'
}

export function selectFacingImagePath(item: LayoutItemWithDevice, facing: DeviceFacing): string | null {
  const visibleSide = resolveVisibleImageSide(item.facing, facing)
  return visibleSide === 'front' ? item.device.front_image_path : item.device.rear_image_path
}
