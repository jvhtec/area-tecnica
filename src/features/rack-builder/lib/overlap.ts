import { getItemSlot, type ItemSlot, slotsConflict } from './rackPositions'
import type { DeviceFacing, LayoutItemWithDevice, RackWidth } from '../types'

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function effectiveDepthMm(depthMm: number, rackEarOffsetMm: number): number {
  const depth = toFiniteNumber(depthMm)
  const offset = toFiniteNumber(rackEarOffsetMm)
  if (depth === null || offset === null) return 0
  return Math.max(0, depth - offset)
}

export function hasOverlap(
  startU: number,
  rackUnits: number,
  facing: DeviceFacing,
  items: LayoutItemWithDevice[],
  excludeItemId?: string,
): boolean {
  const newTop = startU + rackUnits - 1
  return items
    .filter((item) => item.facing === facing && item.id !== excludeItemId)
    .some((item) => {
      const existingTop = item.start_u + item.device.rack_units - 1
      return startU <= existingTop && newTop >= item.start_u
    })
}

export function isWithinBounds(
  startU: number,
  rackUnits: number,
  totalRackUnits: number,
): boolean {
  const normalizedStartU = toFiniteNumber(startU)
  const normalizedRackUnits = toFiniteNumber(rackUnits)
  const normalizedTotalRackUnits = toFiniteNumber(totalRackUnits)
  if (normalizedStartU === null || normalizedRackUnits === null || normalizedTotalRackUnits === null) return false
  return normalizedStartU >= 1 && normalizedStartU + normalizedRackUnits - 1 <= normalizedTotalRackUnits
}

export interface DepthConflictDetail {
  conflictingItemId: string
  conflictingItemName: string
  currentDepthMm: number
  oppositeDepthMm: number
  combinedDepthMm: number
  rackDepthMm: number
}

export function hasDepthConflict(
  startU: number,
  rackUnits: number,
  facing: DeviceFacing,
  deviceDepthMm: number,
  currentRackEarOffsetMm: number,
  items: LayoutItemWithDevice[],
  rackDepthMm: number,
  excludeItemId?: string,
  targetSlot?: ItemSlot,
  rackWidth?: RackWidth,
  oppositeSlotByItemId?: Map<string, ItemSlot>,
): boolean {
  return (
    findDepthConflict(
      startU,
      rackUnits,
      facing,
      deviceDepthMm,
      currentRackEarOffsetMm,
      items,
      rackDepthMm,
      excludeItemId,
      targetSlot,
      rackWidth,
      oppositeSlotByItemId,
    ) !== null
  )
}

export function findDepthConflict(
  startU: number,
  rackUnits: number,
  facing: DeviceFacing,
  deviceDepthMm: number,
  currentRackEarOffsetMm: number,
  items: LayoutItemWithDevice[],
  rackDepthMm: number,
  excludeItemId?: string,
  targetSlot?: ItemSlot,
  rackWidth?: RackWidth,
  oppositeSlotByItemId?: Map<string, ItemSlot>,
): DepthConflictDetail | null {
  const normalizedStartU = toFiniteNumber(startU)
  const normalizedRackUnits = toFiniteNumber(rackUnits)
  const currentDepth = toFiniteNumber(effectiveDepthMm(deviceDepthMm, currentRackEarOffsetMm))
  const rackDepth = toFiniteNumber(rackDepthMm)
  if (normalizedStartU === null || normalizedRackUnits === null || currentDepth === null || rackDepth === null) return null

  const newTop = normalizedStartU + normalizedRackUnits - 1
  const oppositeFacing: DeviceFacing = facing === 'front' ? 'rear' : 'front'

  for (const item of items) {
    if (item.facing !== oppositeFacing || item.id === excludeItemId) continue

    const existingStartU = toFiniteNumber(item.start_u)
    const existingRackUnits = toFiniteNumber(item.device.rack_units)
    if (existingStartU === null || existingRackUnits === null) continue

    const existingTop = existingStartU + existingRackUnits - 1
    if (normalizedStartU > existingTop || newTop < existingStartU) continue

    if (targetSlot && rackWidth) {
      const oppositeSlot = oppositeSlotByItemId?.get(item.id) ?? getItemSlot(item, rackWidth)
      if (!slotsConflict(targetSlot, oppositeSlot)) continue
    }

    const oppositeDepth = toFiniteNumber(effectiveDepthMm(item.device.depth_mm, item.rack_ear_offset_mm))
    if (oppositeDepth === null) continue

    const combinedDepth = currentDepth + oppositeDepth
    if (combinedDepth <= rackDepth) continue

    return {
      conflictingItemId: item.id,
      conflictingItemName: item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`,
      currentDepthMm: currentDepth,
      oppositeDepthMm: oppositeDepth,
      combinedDepthMm: combinedDepth,
      rackDepthMm: rackDepth,
    }
  }

  return null
}
