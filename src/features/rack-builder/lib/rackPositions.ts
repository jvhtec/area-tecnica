import type { DeviceFacing, LayoutItemWithDevice, RackWidth } from '../types'

/**
 * A horizontal slot position within a rack.
 *
 * `outer` — primary column (0 = left, 1 = right, null = full rack width).
 *   - Single rack, full-rack device: null
 *   - Single rack, half-rack device: 0 (left half) or 1 (right half)
 *   - Dual rack, any device: 0 (left column) or 1 (right column)
 *
 * `inner` — sub-position within the outer column (only for half-rack devices in dual racks).
 *   - null means the device occupies the full outer column width.
 *   - 0 = left half of the column, 1 = right half of the column.
 */
export interface ItemSlot {
  outer: 0 | 1 | null
  inner: 0 | 1 | null
}

/**
 * Derive the canonical slot for an item given the rack type.
 * `force_full_width` collapses a half-rack device to null inner (takes full column).
 */
export function getItemSlot(item: LayoutItemWithDevice, rackWidth: RackWidth): ItemSlot {
  const isHalf = item.device.is_half_rack && !item.force_full_width

  if (rackWidth === 'single') {
    if (!isHalf) return { outer: null, inner: null }
    // preferred_lane encodes which half (0 = left, 1 = right)
    const outer = item.preferred_lane === 1 ? 1 : 0
    return { outer, inner: null }
  }

  // Dual rack
  const outer = item.preferred_lane === 1 ? 1 : 0
  if (!isHalf) return { outer, inner: null }
  // preferred_sub_lane encodes which half within the column
  const inner = item.preferred_sub_lane === 1 ? 1 : 0
  return { outer, inner }
}

/**
 * Returns true when two slots conflict (i.e. they overlap horizontally).
 * The facing check is not done here — callers must only compare same-facing items.
 */
export function slotsConflict(a: ItemSlot, b: ItemSlot): boolean {
  // Full-width slot conflicts with everything
  if (a.outer === null || b.outer === null) return true
  // Different outer columns never conflict
  if (a.outer !== b.outer) return false
  // Same column: if either is full-column width they conflict
  if (a.inner === null || b.inner === null) return true
  // Both have a sub-slot: conflict only if same sub-slot
  return a.inner === b.inner
}

/**
 * Given a slot and rack type, return the CSS left% and width% for rendering.
 * Pass `facing` to mirror left/right for rear-view.
 */
export function getSlotStyle(
  slot: ItemSlot,
  rackWidth: RackWidth,
  facing: DeviceFacing = 'front',
): { left: string; width: string } {
  if (rackWidth === 'single') {
    if (slot.outer === null) return { left: '0%', width: '100%' }
    const mirror = facing === 'rear'
    const leftHalf = mirror ? slot.outer === 1 : slot.outer === 0
    return { left: leftHalf ? '0%' : '50%', width: '50%' }
  }

  // Dual rack — base per-column
  const mirror = facing === 'rear'
  const colIndex = mirror ? 1 - (slot.outer ?? 0) : (slot.outer ?? 0)

  if (slot.inner === null) {
    // Full column (50% width)
    return { left: `${colIndex * 50}%`, width: '50%' }
  }

  // Half-of-column (25% width)
  const subIndex = mirror ? 1 - slot.inner : slot.inner
  const leftPct = colIndex * 50 + subIndex * 25
  return { left: `${leftPct}%`, width: '25%' }
}

/**
 * The set of all possible slots for a given rack type and device half-rack status.
 * Used by the drag interaction to enumerate drop targets.
 */
export function availableSlots(rackWidth: RackWidth, isHalfRack: boolean): ItemSlot[] {
  if (rackWidth === 'single') {
    if (!isHalfRack) return [{ outer: null, inner: null }]
    return [
      { outer: 0, inner: null },
      { outer: 1, inner: null },
    ]
  }
  // Dual rack
  if (!isHalfRack) {
    return [
      { outer: 0, inner: null },
      { outer: 1, inner: null },
    ]
  }
  return [
    { outer: 0, inner: 0 },
    { outer: 0, inner: 1 },
    { outer: 1, inner: 0 },
    { outer: 1, inner: 1 },
  ]
}

/**
 * Converts a (preferredLane, preferredSubLane, isHalfRack) tuple to the
 * desired target slot, respecting rack type.
 */
export function preferenceToSlot(
  rackWidth: RackWidth,
  isHalfRack: boolean,
  preferredLane?: 0 | 1,
  preferredSubLane?: 0 | 1,
): ItemSlot {
  if (rackWidth === 'single') {
    if (!isHalfRack) return { outer: null, inner: null }
    return { outer: preferredLane ?? 0, inner: null }
  }
  // Dual rack
  const outer = preferredLane ?? 0
  if (!isHalfRack) return { outer, inner: null }
  return { outer, inner: preferredSubLane ?? 0 }
}

interface VerticalRange {
  startU: number
  rackUnits: number
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function verticalOverlap(a: VerticalRange, b: VerticalRange): boolean {
  const aTop = a.startU + a.rackUnits - 1
  const bTop = b.startU + b.rackUnits - 1
  return a.startU <= bTop && aTop >= b.startU
}

export interface PositionConflictDetail {
  conflictingItemId: string
  conflictingItemName: string
  targetSlot: ItemSlot
  conflictingSlot: ItemSlot
  startU: number
  rackUnits: number
  conflictingStartU: number
  conflictingRackUnits: number
}

/**
 * Builds a map from itemId → ItemSlot for all items, respecting their preferred
 * positions and falling back to the first available slot on conflict.
 *
 * Items that are `force_full_width` always get the full-column/full-width slot;
 * no further sub-slot assignment is needed for them.
 */
export function buildSlotAssignments(
  items: LayoutItemWithDevice[],
  rackWidth: RackWidth,
): Map<string, ItemSlot> {
  const result = new Map<string, ItemSlot>()

  // Sort for deterministic assignment (lower U first, then by id)
  const ordered = [...items].sort((a, b) => {
    if (a.start_u !== b.start_u) return a.start_u - b.start_u
    return a.id.localeCompare(b.id)
  })

  for (const item of ordered) {
    const isHalf = item.device.is_half_rack && !item.force_full_width
    const preferred = getItemSlot(item, rackWidth)
    const slots = availableSlots(rackWidth, isHalf)

    // Check if the preferred slot is free
    const preferredFree = !isSlotBlockedByAssigned(result, items, item, preferred)
    if (preferredFree) {
      result.set(item.id, preferred)
      continue
    }

    // Try remaining slots in order
    let placed = false
    for (const slot of slots) {
      if (slotsConflict(slot, preferred) && preferredFree === false) {
        // Already know preferred is blocked; try others
      }
      const free = !isSlotBlockedByAssigned(result, items, item, slot)
      if (free) {
        result.set(item.id, slot)
        placed = true
        break
      }
    }

    if (!placed) {
      // Overflow fallback: use preferred slot anyway
      result.set(item.id, preferred)
    }
  }

  return result
}

function isSlotBlockedByAssigned(
  assigned: Map<string, ItemSlot>,
  items: LayoutItemWithDevice[],
  candidate: LayoutItemWithDevice,
  slot: ItemSlot,
): boolean {
  for (const [existingId, existingSlot] of assigned) {
    if (!slotsConflict(slot, existingSlot)) continue
    const existingItem = items.find((i) => i.id === existingId)
    if (!existingItem) continue
    if (verticalOverlap(
      { startU: candidate.start_u, rackUnits: candidate.device.rack_units },
      { startU: existingItem.start_u, rackUnits: existingItem.device.rack_units },
    )) {
      return true
    }
  }
  return false
}

/**
 * Check whether a device can be placed at `slotU` with `rackUnits` height,
 * at the given target slot, without conflicting with any already-placed items.
 * Optionally exclude one item (for move operations).
 */
export function canPlaceAtPosition(
  slotU: number,
  rackUnits: number,
  targetSlot: ItemSlot,
  items: LayoutItemWithDevice[],
  rackWidth: RackWidth,
  excludeItemId?: string,
): boolean {
  return findPositionConflict(slotU, rackUnits, targetSlot, items, rackWidth, excludeItemId) === null
}

export function findPositionConflict(
  slotU: number,
  rackUnits: number,
  targetSlot: ItemSlot,
  items: LayoutItemWithDevice[],
  rackWidth: RackWidth,
  excludeItemId?: string,
): PositionConflictDetail | null {
  const normalizedSlotU = toFiniteNumber(slotU)
  const normalizedRackUnits = toFiniteNumber(rackUnits)
  if (normalizedSlotU === null || normalizedRackUnits === null) return null

  const candidates = items.filter((i) => i.id !== excludeItemId)
  const assignments = buildSlotAssignments(candidates, rackWidth)

  for (const item of candidates) {
    const itemSlot = assignments.get(item.id)
    if (!itemSlot) continue
    if (!slotsConflict(targetSlot, itemSlot)) continue

    const existingStartU = toFiniteNumber(item.start_u)
    const existingRackUnits = toFiniteNumber(item.device.rack_units)
    if (existingStartU === null || existingRackUnits === null) continue

    if (verticalOverlap(
      { startU: normalizedSlotU, rackUnits: normalizedRackUnits },
      { startU: existingStartU, rackUnits: existingRackUnits },
    )) {
      return {
        conflictingItemId: item.id,
        conflictingItemName: item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`,
        targetSlot,
        conflictingSlot: itemSlot,
        startU: normalizedSlotU,
        rackUnits: normalizedRackUnits,
        conflictingStartU: existingStartU,
        conflictingRackUnits: existingRackUnits,
      }
    }
  }

  return null
}
