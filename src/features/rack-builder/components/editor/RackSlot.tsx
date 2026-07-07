import { useCallback, useEffect, useRef, type RefCallback } from 'react'
import { useHaptic } from '../../contexts/HapticContext'
import { useDrop } from 'react-dnd'
import {
  DEVICE_TYPE,
  PLACED_DEVICE_TYPE,
  type DeviceDragItem,
  type PlacedDeviceDragItem,
} from './DraggableDevice'
import type { XYCoord } from 'dnd-core'
import type { DeviceFacing, LayoutItemWithDevice } from '../../types'
import { isWithinBounds } from '../../lib/overlap'
import { RACK_SLOT_HEIGHT_PX, RACK_RAIL_WIDTH_PX } from './rackGeometry'

const SLOT_HEIGHT = RACK_SLOT_HEIGHT_PX

interface RackSlotProps {
  slotU: number
  totalRackUnits: number
  facing: DeviceFacing
  items: LayoutItemWithDevice[]
  laneCount?: 1 | 2
  slotHeight?: number
  canPlaceAtSlot?: (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => boolean
  getPlacementIssue?: (
    slotU: number,
    rackUnits: number,
    isHalfRack: boolean,
    forceFullWidth: boolean,
    depthMm: number,
    rackEarOffsetMm: number,
    excludeItemId?: string,
    preferredLane?: 0 | 1,
    preferredSubLane?: 0 | 1,
  ) => string | null
  onPlacementHint?: (message: string | null) => void
  onDropNew: (deviceId: string, startU: number, rackUnits: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => void
  onDropMove: (itemId: string, newStartU: number, preferredLane?: 0 | 1, preferredSubLane?: 0 | 1) => void
}

export default function RackSlot({
  slotU,
  totalRackUnits,
  facing,
  items,
  laneCount = 1,
  slotHeight = SLOT_HEIGHT,
  canPlaceAtSlot,
  getPlacementIssue,
  onPlacementHint,
  onDropNew,
  onDropMove,
}: RackSlotProps) {
  const slotRef = useRef<HTMLDivElement | null>(null)
  const wasOverRef = useRef(false)
  const prevDropStateRef = useRef<'none' | 'valid' | 'invalid'>('none')
  const { trigger } = useHaptic()

  /**
   * Detect which preferred lane/sub-lane the user is hovering over.
   * Returns { preferredLane, preferredSubLane } based on drag item type and rack config.
   */
  const getPreferredPosition = useCallback(
    (point: XYCoord | null, isHalfRack: boolean): { preferredLane: 0 | 1 | undefined; preferredSubLane: 0 | 1 | undefined } => {
      if (!point || !slotRef.current) return { preferredLane: undefined, preferredSubLane: undefined }

      const bounds = slotRef.current.getBoundingClientRect()
      const laneAreaLeft = bounds.left + RACK_RAIL_WIDTH_PX
      const laneAreaWidth = bounds.width - RACK_RAIL_WIDTH_PX * 2
      if (laneAreaWidth <= 0) return { preferredLane: undefined, preferredSubLane: undefined }

      const relX = point.x - laneAreaLeft
      const fraction = Math.max(0, Math.min(1, relX / laneAreaWidth))

      if (laneCount === 1) {
        if (!isHalfRack) return { preferredLane: undefined, preferredSubLane: undefined }
        // Single rack + half-rack: detect left (0) or right (1) half
        const visualLane = fraction >= 0.5 ? 1 : 0
        const preferredLane = facing === 'rear' ? ((1 - visualLane) as 0 | 1) : (visualLane as 0 | 1)
        return { preferredLane, preferredSubLane: undefined }
      }

      // Dual rack
      if (!isHalfRack) {
        // Detect which column (0 = left, 1 = right)
        const visualLane = fraction >= 0.5 ? 1 : 0
        const preferredLane = facing === 'rear' ? ((1 - visualLane) as 0 | 1) : (visualLane as 0 | 1)
        return { preferredLane, preferredSubLane: undefined }
      }

      // Dual rack + half-rack: detect which quarter (4 zones)
      const quarter = Math.floor(fraction * 4) as 0 | 1 | 2 | 3
      const safeQuarter = Math.min(3, quarter) as 0 | 1 | 2 | 3
      // Quarters 0,1 = column 0 (sub 0,1); Quarters 2,3 = column 1 (sub 0,1)
      const visualCol = safeQuarter >= 2 ? 1 : 0
      const visualSub = (safeQuarter % 2) as 0 | 1
      const preferredLane = facing === 'rear' ? ((1 - visualCol) as 0 | 1) : (visualCol as 0 | 1)
      const preferredSubLane = facing === 'rear' ? ((1 - visualSub) as 0 | 1) : visualSub
      return { preferredLane, preferredSubLane }
    },
    [facing, laneCount],
  )

  const [{ isOver, canDrop, dragItem, clientOffset }, dropRef] = useDrop<
    DeviceDragItem | PlacedDeviceDragItem,
    void,
    {
      isOver: boolean
      canDrop: boolean
      dragItem: DeviceDragItem | PlacedDeviceDragItem | null
      clientOffset: XYCoord | null
    }
  >({
    accept: [DEVICE_TYPE, PLACED_DEVICE_TYPE],
    canDrop: (dragItem, monitor) => {
      if (!isWithinBounds(slotU, dragItem.rackUnits, totalRackUnits)) return false
      const excludeId = dragItem.type === PLACED_DEVICE_TYPE ? dragItem.itemId : undefined
      const { preferredLane, preferredSubLane } = getPreferredPosition(
        monitor.getClientOffset(),
        dragItem.isHalfRack && !dragItem.forceFullWidth,
      )
      if (canPlaceAtSlot) {
        return canPlaceAtSlot(
          slotU,
          dragItem.rackUnits,
          dragItem.isHalfRack,
          dragItem.forceFullWidth,
          dragItem.depthMm,
          dragItem.rackEarOffsetMm,
          excludeId,
          preferredLane,
          preferredSubLane,
        )
      }
      return !items
        .filter((item) => item.facing === facing && item.id !== excludeId)
        .some((item) => {
          const existingTop = item.start_u + item.device.rack_units - 1
          const droppedTop = slotU + dragItem.rackUnits - 1
          return slotU <= existingTop && droppedTop >= item.start_u
        })
    },
    drop: (dragItem, monitor) => {
      const { preferredLane, preferredSubLane } = getPreferredPosition(
        monitor.getClientOffset(),
        dragItem.isHalfRack && !dragItem.forceFullWidth,
      )
      trigger('success')
      if (dragItem.type === PLACED_DEVICE_TYPE) {
        onDropMove(dragItem.itemId, slotU, preferredLane, preferredSubLane)
      } else {
        onDropNew(dragItem.deviceId, slotU, dragItem.rackUnits, preferredLane, preferredSubLane)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      dragItem: (monitor.getItem() as DeviceDragItem | PlacedDeviceDragItem | null) ?? null,
      clientOffset: monitor.getClientOffset(),
    }),
  })

  useEffect(() => {
    const newState = !isOver ? 'none' : canDrop ? 'valid' : 'invalid'
    if (newState !== prevDropStateRef.current) {
      if (newState === 'valid') trigger('nudge')
      else if (newState === 'invalid') trigger('error')
      prevDropStateRef.current = newState
    }
  }, [isOver, canDrop, trigger])

  useEffect(() => {
    if (!onPlacementHint) return

    if (!isOver) {
      if (wasOverRef.current) {
        onPlacementHint(null)
        wasOverRef.current = false
      }
      return
    }

    wasOverRef.current = true

    if (canDrop) {
      onPlacementHint(null)
      return
    }

    if (!dragItem) {
      onPlacementHint('Placement blocked at this slot.')
      return
    }

    const excludeId = dragItem.type === PLACED_DEVICE_TYPE ? dragItem.itemId : undefined
    const { preferredLane, preferredSubLane } = getPreferredPosition(
      clientOffset,
      dragItem.isHalfRack && !dragItem.forceFullWidth,
    )
    const issue = getPlacementIssue?.(
      slotU,
      dragItem.rackUnits,
      dragItem.isHalfRack,
      dragItem.forceFullWidth,
      dragItem.depthMm,
      dragItem.rackEarOffsetMm,
      excludeId,
      preferredLane,
      preferredSubLane,
    )
    onPlacementHint(issue ?? 'Placement blocked at this slot.')
  }, [canDrop, clientOffset, dragItem, getPlacementIssue, getPreferredPosition, isOver, onPlacementHint, slotU])

  const setRefs: RefCallback<HTMLDivElement> = useCallback((node) => {
    slotRef.current = node
    dropRef(node)
  }, [dropRef])

  let stateClass = ''
  if (isOver && canDrop) stateClass = 'rack-slot-drop-ok'
  else if (isOver && !canDrop) stateClass = 'rack-slot-drop-bad'

  return (
    <div
      ref={setRefs}
      className={`rack-slot-row ${stateClass}`}
      style={{ height: `${slotHeight}px` }}
    >
      <div className="rack-slot-track" />
    </div>
  )
}
