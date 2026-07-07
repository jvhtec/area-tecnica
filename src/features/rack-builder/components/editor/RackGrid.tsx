import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { ConnectorDefinition, DeviceFacing, Rack, LayoutItemWithDevice } from '../../types'
import RackSlot from './RackSlot'
import PlacedDevice from './PlacedDevice'
import {
  buildSlots,
  getAutoSlotHeight,
  getSlotTopPx,
  RACK_DUAL_WIDTH,
  RACK_SINGLE_WIDTH,
  RACK_SLOT_HEIGHT_PX,
  RACK_RAIL_WIDTH_PX,
} from './rackGeometry'
import {
  findPositionConflict,
  getItemSlot,
  getSlotStyle,
  type ItemSlot,
  preferenceToSlot,
} from '../../lib/rackPositions'
import { findDepthConflict, isWithinBounds } from '../../lib/overlap'
import { buildRackFaceViewModel } from '../../lib/rackViewModel'
import './rackBlueprint.css'

interface RackGridProps {
  rack: Rack
  items: LayoutItemWithDevice[]
  connectorById: Map<string, ConnectorDefinition>
  facing: DeviceFacing
  zoom?: number
  showDeviceDetails?: boolean
  simplifiedView?: boolean
  lanePreferenceByItemId?: Map<string, 0 | 1>
  onDropNew: (deviceId: string, startU: number, rackUnits: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => void
  onDropMove: (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => void
  onRemove: (itemId: string) => void
  onEditNotes: (item: LayoutItemWithDevice) => void
  onPlacementHint?: (message: string | null) => void
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function describeSlot(slot: ItemSlot, rackWidth: Rack['width']): string {
  if (rackWidth === 'single') {
    if (slot.outer === null) return 'full width'
    return slot.outer === 0 ? 'left half' : 'right half'
  }
  if (slot.inner === null) return slot.outer === 0 ? 'left bay' : 'right bay'
  const bayLabel = slot.outer === 0 ? 'left bay' : 'right bay'
  const halfLabel = slot.inner === 0 ? 'left half' : 'right half'
  return `${bayLabel} / ${halfLabel}`
}

export default function RackGrid({
  rack,
  items,
  connectorById,
  facing,
  zoom = 1,
  showDeviceDetails = true,
  simplifiedView = false,
  onDropNew,
  onDropMove,
  onRemove,
  onEditNotes,
  onPlacementHint,
}: RackGridProps) {
  const {
    activeItems,
    activeSlotByItemId: slotAssignments,
    ghostItems: oppositePreviewItems,
    ghostSlotByItemId: oppositeSlotAssignments,
  } = useMemo(
    () => buildRackFaceViewModel(items, facing, rack.width),
    [facing, items, rack.width],
  )
  const oppositeFacingItems = items.filter((item) => item.facing !== facing)
  const isDualRack = rack.width === 'dual'
  const laneCount = isDualRack ? 2 : 1
  const rackRef = useRef<HTMLDivElement | null>(null)
  const [slotHeight, setSlotHeight] = useState(RACK_SLOT_HEIGHT_PX)
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  const baseRackWidth = isDualRack ? RACK_DUAL_WIDTH : RACK_SINGLE_WIDTH
  const rackWidth = `calc((${baseRackWidth}) * ${safeZoom})`

  useEffect(() => {
    const node = rackRef.current
    if (!node) return

    const updateHeight = (nextWidth: number) => {
      const nextHeight = getAutoSlotHeight(nextWidth, laneCount)
      setSlotHeight((prev) => (prev === nextHeight ? prev : nextHeight))
    }

    updateHeight(node.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateHeight(entry.contentRect.width)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [laneCount])

  const rackStyle = {
    width: rackWidth,
    '--rack-slot-height': `${slotHeight}px`,
    '--rack-rail-width': `${RACK_RAIL_WIDTH_PX}px`,
  } as CSSProperties

  const oppositeDepthSlotAssignments = new Map(
    oppositeFacingItems.map((item) => [item.id, getItemSlot(item, rack.width)]),
  )

  const getPlacementIssue = (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ): string | null => {
    const targetSlot = preferenceToSlot(rack.width, isHalfRack && !forceFullWidth, preferredLane, preferredSubLane)
    const normalizedSlotU = toFiniteNumber(slotU)
    const normalizedRackUnits = toFiniteNumber(rackUnits)
    if (
      normalizedSlotU === null
      || normalizedRackUnits === null
      || !isWithinBounds(normalizedSlotU, normalizedRackUnits, rack.rack_units)
    ) {
      return `Out of rack bounds: U${slotU} with ${rackUnits}U in a ${rack.rack_units}U rack.`
    }

    const overlap = findPositionConflict(
      normalizedSlotU,
      normalizedRackUnits,
      targetSlot,
      activeItems,
      rack.width,
      excludeItemId,
    )
    if (overlap) {
      const endU = overlap.startU + overlap.rackUnits - 1
      const conflictEndU = overlap.conflictingStartU + overlap.conflictingRackUnits - 1
      return `Same-side overlap in ${describeSlot(targetSlot, rack.width)}: U${overlap.startU}-U${endU} conflicts with ${overlap.conflictingItemName} at U${overlap.conflictingStartU}-U${conflictEndU}.`
    }

    const depthConflict = findDepthConflict(
      normalizedSlotU,
      normalizedRackUnits,
      facing,
      depthMm,
      rackEarOffsetMm,
      items,
      rack.depth_mm,
      excludeItemId,
      targetSlot,
      rack.width,
      oppositeDepthSlotAssignments,
    )
    if (depthConflict) {
      return `Depth conflict: ${depthConflict.currentDepthMm}mm + ${depthConflict.oppositeDepthMm}mm = ${depthConflict.combinedDepthMm}mm exceeds rack depth ${depthConflict.rackDepthMm}mm (${depthConflict.conflictingItemName}).`
    }

    return null
  }

  const canPlaceAtSlot = (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ): boolean => {
    return getPlacementIssue(
      slotU,
      rackUnits,
      isHalfRack,
      forceFullWidth,
      depthMm,
      rackEarOffsetMm,
      excludeItemId,
      preferredLane,
      preferredSubLane,
    ) === null
  }

  const slots = buildSlots(rack.rack_units)

  return (
    <div className="rack-blueprint-container">
      <div className="rack-u-labels">
        {slots.map((u) => (
          <div key={`label-${u}`} className="rack-u-label-row" style={{ height: slotHeight }}>
            <span className="rack-u-label-text">{u}</span>
            <div className="rack-u-label-line" />
          </div>
        ))}
      </div>

      <div className="rack-blueprint-wrapper">
        <div className="rack-casing-top"></div>
        <div ref={rackRef} className="rack-blueprint" style={rackStyle}>
          <div className="rack-blueprint-header">
            {rack.name} — {rack.rack_units}U — {facing === 'front' ? 'Front' : 'Rear'} View
          </div>

          <div className="rack-blueprint-body relative">
            <div className="rack-blueprint-rails">
              <div className="rack-blueprint-rail rack-blueprint-rail-left" />
              <div className="rack-blueprint-rail rack-blueprint-rail-right" />
              {laneCount === 2 && <div className="rack-blueprint-divider" />}
            </div>

            {slots.map((u) => (
              <RackSlot
                key={u}
                slotU={u}
                totalRackUnits={rack.rack_units}
                facing={facing}
                items={activeItems}
                laneCount={laneCount}
                slotHeight={slotHeight}
                canPlaceAtSlot={canPlaceAtSlot}
                getPlacementIssue={getPlacementIssue}
                onPlacementHint={onPlacementHint}
                onDropNew={onDropNew}
                onDropMove={onDropMove}
              />
            ))}

            <div className="rack-device-layer">
              {oppositePreviewItems.map((item) => {
                const topPx = getSlotTopPx(rack.rack_units, item.start_u, item.device.rack_units, slotHeight)
                const slot = oppositeSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
                const { left: laneLeft, width: laneWidth } = getSlotStyle(slot, rack.width, facing)

                return (
                  <div
                    key={`opposite-${item.id}`}
                    className="rack-opposite-preview-wrap"
                    style={{
                      zIndex: 5,
                      top: `${topPx}px`,
                      left: laneLeft,
                      width: laneWidth,
                    }}
                  >
                    <PlacedDevice
                      item={item}
                      facing={facing}
                      slotHeight={slotHeight}
                      showDeviceDetails={showDeviceDetails}
                      simplifiedView={simplifiedView}
                      interactive={false}
                      connectorById={connectorById}
                      onRemove={onRemove}
                      onEditNotes={onEditNotes}
                    />
                  </div>
                )
              })}

              {activeItems.map((item) => {
                const topPx = getSlotTopPx(rack.rack_units, item.start_u, item.device.rack_units, slotHeight)
                const slot = slotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
                const { left: laneLeft, width: laneWidth } = getSlotStyle(slot, rack.width, facing)

                return (
                  <div
                    key={item.id}
                    className="rack-device-wrap"
                    style={{
                      zIndex: 10,
                      top: `${topPx}px`,
                      left: laneLeft,
                      width: laneWidth,
                    }}
                  >
                    <PlacedDevice
                      item={item}
                      facing={facing}
                      slotHeight={slotHeight}
                      showDeviceDetails={showDeviceDetails}
                      simplifiedView={simplifiedView}
                      interactive
                      connectorById={connectorById}
                      onRemove={onRemove}
                      onEditNotes={onEditNotes}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="rack-casing-bottom"></div>
        <div className="rack-casters">
          <div className="rack-caster"></div>
          <div className="rack-caster"></div>
        </div>
      </div>
    </div>
  )
}
