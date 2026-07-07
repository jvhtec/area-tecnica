import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { LayoutItemWithDevice, Rack } from '../../types'
import { getItemSlot } from '../../lib/rackPositions'
import { effectiveDepthMm, hasDepthConflict } from '../../lib/overlap'
import {
  buildSlots,
  getAutoSlotHeight,
  getSlotTopPx,
  RACK_SINGLE_WIDTH,
  RACK_SLOT_HEIGHT_PX,
} from './rackGeometry'
import './rackBlueprint.css'

interface RackSideDepthViewProps {
  rack: Rack
  items: LayoutItemWithDevice[]
  side: 'left' | 'right'
  zoom?: number
  showDeviceDetails?: boolean
  compact?: boolean
}

interface DepthSegment {
  id: string
  lane: 0 | 1
  startU: number
  rackUnits: number
  depthPct: number
  offsetPct: number
  facing: 'front' | 'rear'
  emphasis: 'near' | 'far'
  label: string
  hasConflict: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function RackSideDepthView({
  rack,
  items,
  side,
  zoom = 1,
  showDeviceDetails = true,
  compact = false,
}: RackSideDepthViewProps) {
  const rackRef = useRef<HTMLDivElement | null>(null)
  const laneIndexes = useMemo(() => {
    if (rack.width !== 'dual') return [0] as const
    return [side === 'left' ? 0 : 1] as const
  }, [rack.width, side])
  const laneCountForSizing = 1
  const [slotHeight, setSlotHeight] = useState(RACK_SLOT_HEIGHT_PX)

  useEffect(() => {
    const node = rackRef.current
    if (!node) return

    const updateHeight = (nextWidth: number) => {
      const nextHeight = getAutoSlotHeight(nextWidth, laneCountForSizing)
      setSlotHeight((prev) => (prev === nextHeight ? prev : nextHeight))
    }

    updateHeight(node.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateHeight(entry.contentRect.width)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [laneCountForSizing])

  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  const rackWidth = compact ? '100%' : `calc((${RACK_SINGLE_WIDTH}) * ${safeZoom})`
  const rackStyle = {
    width: rackWidth,
    '--rack-slot-height': `${slotHeight}px`,
  } as CSSProperties

  const slots = useMemo(() => buildSlots(rack.rack_units), [rack.rack_units])
  const slotByItemId = useMemo(
    () => new Map(items.map((item) => [item.id, getItemSlot(item, rack.width)])),
    [items, rack.width],
  )

  const segments = useMemo(() => {
    const ratioBase = rack.depth_mm > 0 ? 100 / rack.depth_mm : 0
    const nearFacing: 'front' | 'rear' = side === 'left' ? 'front' : 'rear'

    return items.map((item): DepthSegment => {
      const slot = slotByItemId.get(item.id) ?? getItemSlot(item, rack.width)
      const lane: 0 | 1 = rack.width === 'dual' ? ((slot.outer ?? 0) as 0 | 1) : 0
      const effectiveDepth = effectiveDepthMm(item.device.depth_mm, item.rack_ear_offset_mm)
      const depthPctRaw = ratioBase > 0 ? effectiveDepth * ratioBase : 100
      const depthPct = effectiveDepth === 0 ? 0 : clamp(depthPctRaw, 5, 100)
      const frontOffset = side === 'left' ? 0 : 100 - depthPct
      const rearOffset = side === 'left' ? 100 - depthPct : 0
      const offsetPct = item.facing === 'front' ? frontOffset : rearOffset

      return {
        id: item.id,
        lane,
        startU: item.start_u,
        rackUnits: item.device.rack_units,
        depthPct,
        offsetPct,
        facing: item.facing,
        emphasis: item.facing === nearFacing ? 'near' : 'far',
        label: item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`,
        hasConflict: hasDepthConflict(
          item.start_u,
          item.device.rack_units,
          item.facing,
          item.device.depth_mm,
          item.rack_ear_offset_mm,
          items,
          rack.depth_mm,
          item.id,
          slot,
          rack.width,
          slotByItemId,
        ),
      }
    })
  }, [items, rack.depth_mm, rack.width, side, slotByItemId])

  const nearLabel = side === 'left' ? 'Front' : 'Rear'
  const farLabel = side === 'left' ? 'Rear' : 'Front'

  return (
    <div className={`rack-blueprint-container ${compact ? 'rack-blueprint-container--compact' : ''}`}>
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
            {rack.name} — {rack.rack_units}U — {side === 'left' ? 'Left' : 'Right'} Side View
          </div>

          <div className="rack-blueprint-body rack-side-body">
            <div className="rack-side-legend">
              <span>{nearLabel}</span>
              <span>{farLabel}</span>
            </div>

            <div className="rack-side-lanes">
              {laneIndexes.map((laneIndex) => {
                const laneSegments = segments.filter((segment) => segment.lane === laneIndex)

                return (
                  <div key={`side-lane-${laneIndex}`} className="rack-side-lane">
                    {rack.width === 'dual' && <div className="rack-side-lane-label">{laneIndex === 0 ? 'Left Bay' : 'Right Bay'}</div>}

                    {slots.map((u) => (
                      <div
                        key={`slot-${laneIndex}-${u}`}
                        className="rack-side-slot-guide"
                        style={{ height: `${slotHeight}px` }}
                      />
                    ))}

                    <div className="rack-depth-layer">
                      {laneSegments.map((segment) => {
                        const top = getSlotTopPx(rack.rack_units, segment.startU, segment.rackUnits, slotHeight)

                        return (
                          <div
                            key={`segment-${segment.id}`}
                            className={`rack-depth-item rack-depth-item--${segment.facing} rack-depth-item--${segment.emphasis} ${segment.hasConflict ? 'rack-depth-item--conflict' : ''}`}
                            style={{
                              top: `${top}px`,
                              height: `${segment.rackUnits * slotHeight}px`,
                              left: `${segment.offsetPct}%`,
                              width: `${segment.depthPct}%`,
                            }}
                            title={segment.hasConflict ? `${segment.label} (Depth conflict)` : segment.label}
                          >
                            {showDeviceDetails && <span className="rack-depth-item-label">{segment.label}</span>}
                          </div>
                        )
                      })}
                    </div>
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
