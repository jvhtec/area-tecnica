import type { LayoutItemWithDevice } from '../../types'
import { getRackPanelAspect } from '../../lib/rackVisual'

export const RACK_SLOT_HEIGHT_PX = 40
export const RACK_RAIL_WIDTH_PX = 14
export const RACK_SINGLE_WIDTH = 'clamp(700px, 70vw, 1100px)'
export const RACK_DUAL_WIDTH = 'clamp(900px, 85vw, 1400px)'
export const STANDARD_PANEL_ASPECT = getRackPanelAspect(1)
export const MIN_SLOT_HEIGHT_PX = 34

export function getTopU(item: LayoutItemWithDevice): number {
  return item.start_u + item.device.rack_units - 1
}

export function overlaps(aStart: number, aUnits: number, b: LayoutItemWithDevice): boolean {
  const aTop = aStart + aUnits - 1
  return aStart <= getTopU(b) && aTop >= b.start_u
}

export function getSlotTopPx(
  totalRackUnits: number,
  startU: number,
  rackUnits: number,
  slotHeight: number,
): number {
  const topSlotIndex = totalRackUnits - startU - (rackUnits - 1)
  return topSlotIndex * slotHeight
}

export function getLaneLeftFactor(laneCount: number, laneIndex: number): number {
  if (laneCount === 1) return 0
  return laneIndex * 0.5
}

export function getLaneWidthFactor(laneCount: number): number {
  return laneCount === 1 ? 1 : 0.5
}

export function buildSlots(totalRackUnits: number): number[] {
  const slots: number[] = []
  for (let u = totalRackUnits; u >= 1; u -= 1) {
    slots.push(u)
  }
  return slots
}

export function getAutoSlotHeight(canvasWidth: number, laneCount: number): number {
  const laneWidth = canvasWidth / Math.max(1, laneCount)
  const ideal = laneWidth / STANDARD_PANEL_ASPECT
  return Math.round(Math.max(MIN_SLOT_HEIGHT_PX, ideal))
}
