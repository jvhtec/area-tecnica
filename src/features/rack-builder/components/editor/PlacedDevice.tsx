import type { LegacyRef } from 'react'
import { useDrag } from 'react-dnd'
import { PLACED_DEVICE_TYPE, type PlacedDeviceDragItem } from './DraggableDevice'
import type { ConnectorDefinition, DeviceFacing, LayoutItemWithDevice } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import { RACK_SLOT_HEIGHT_PX } from './rackGeometry'
import PanelLayoutCanvas from '../panels/PanelLayoutCanvas'
import { resolveVisibleImageSide, selectFacingImagePath } from '../../lib/rackViewModel'
import AutoScaleText from '../shared/AutoScaleText'

const SLOT_HEIGHT = RACK_SLOT_HEIGHT_PX

interface PlacedDeviceProps {
  item: LayoutItemWithDevice
  facing: DeviceFacing
  slotHeight?: number
  showDeviceDetails?: boolean
  simplifiedView?: boolean
  interactive?: boolean
  connectorById?: Map<string, ConnectorDefinition>
  onRemove: (itemId: string) => void
  onEditNotes: (item: LayoutItemWithDevice) => void
}

export default function PlacedDevice({
  item,
  facing,
  slotHeight = SLOT_HEIGHT,
  showDeviceDetails = true,
  simplifiedView = false,
  interactive = true,
  connectorById,
  onRemove,
  onEditNotes,
}: PlacedDeviceProps) {
  const label = item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`
  const [{ isDragging }, dragRef] = useDrag<PlacedDeviceDragItem, unknown, { isDragging: boolean }>({
    type: PLACED_DEVICE_TYPE,
    canDrag: interactive,
    item: {
      type: PLACED_DEVICE_TYPE,
      itemId: item.id,
      deviceId: item.device_id ?? item.device.id,
      rackUnits: item.device.rack_units,
      isHalfRack: item.device.is_half_rack,
      forceFullWidth: item.force_full_width,
      depthMm: item.device.depth_mm,
      rackEarOffsetMm: item.rack_ear_offset_mm,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  const panelLayout = item.asset_kind === 'panel_layout' ? item.panel_layout ?? null : null
  const hasPanelPreview = !!panelLayout && !!connectorById
  const imagePath = selectFacingImagePath(item, facing)
  const visibleSide = resolveVisibleImageSide(item.facing, facing)
  const imageUrl = getDeviceImageUrl(imagePath)
  const imageSrc = imageUrl ?? undefined
  const hasRawImage = imageSrc !== undefined
  const hasVisual = hasPanelPreview || hasRawImage

  const height = item.device.rack_units * slotHeight

  if (simplifiedView) {
    return (
      <div
        ref={dragRef as unknown as LegacyRef<HTMLDivElement>}
        className={`rack-device rack-device--simplified ${isDragging ? 'rack-device--dragging' : ''}`}
        style={{
          height: `${height}px`,
          cursor: interactive ? undefined : 'default',
          pointerEvents: interactive ? undefined : 'none',
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {hasPanelPreview ? (
          <div className="rack-device-media">
            <PanelLayoutCanvas
              connectorById={connectorById}
              heightRu={panelLayout.height_ru}
              rows={panelLayout.rows ?? []}
              ports={panelLayout.ports ?? []}
              facing={visibleSide}
              hasLacingBar={panelLayout.has_lacing_bar}
              showGuides={false}
              interactive={false}
              showScaleMarker={false}
              className="h-full w-full border-0 bg-transparent p-0 shadow-none"
            />
          </div>
        ) : (
          <>
            <div className="rack-device-wire" />
            <span className="rack-device-screw lt" />
            <span className="rack-device-screw rt" />
            <span className="rack-device-screw lb" />
            <span className="rack-device-screw rb" />
          </>
        )}

        <div className="rack-device-simplified-layout">
          <span className="rack-device-simplified-brand">{item.device.brand}</span>
          <span className="rack-device-simplified-model">{item.device.model}</span>
          {item.notes && (
            <AutoScaleText className="rack-device-simplified-notes" text={item.notes} />
          )}
          <span className="rack-device-simplified-name">{item.custom_name?.trim() || ''}</span>
        </div>

        {interactive && (
          <div className="rack-device-actions">
            <button
              onClick={(e) => { e.stopPropagation(); onEditNotes(item) }}
              className="rack-device-action"
              title="Notes"
            >
              N
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
              className="rack-device-action"
              title="Remove"
            >
              &times;
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={dragRef as unknown as LegacyRef<HTMLDivElement>}
      className={`rack-device ${hasRawImage ? 'rack-device--has-image' : ''} ${isDragging ? 'rack-device--dragging' : ''}`}
      style={{
        height: `${height}px`,
        cursor: interactive ? undefined : 'default',
        pointerEvents: interactive ? undefined : 'none',
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="rack-device-media">
        {hasPanelPreview ? (
          <PanelLayoutCanvas
            connectorById={connectorById}
            heightRu={panelLayout.height_ru}
            rows={panelLayout.rows ?? []}
            ports={panelLayout.ports ?? []}
            facing={visibleSide}
            hasLacingBar={panelLayout.has_lacing_bar}
            showGuides={false}
            interactive={false}
            showScaleMarker={false}
            className="h-full w-full border-0 bg-transparent p-0 shadow-none"
          />
        ) : hasRawImage ? (
          <img
            src={imageSrc}
            alt={label}
            draggable={false}
            className={item.device.invert_image_in_dark_mode ? 'rack-device-image--invert-in-dark' : undefined}
          />
        ) : (
          <div className="rack-device-fallback">No Image</div>
        )}
      </div>

      {!hasVisual && (
        <>
          <div className="rack-device-wire" />
          <span className="rack-device-screw lt" />
          <span className="rack-device-screw rt" />
          <span className="rack-device-screw lb" />
          <span className="rack-device-screw rb" />
        </>
      )}

      {showDeviceDetails && <div className="rack-device-gradient" />}

      {interactive && (
        <div className="rack-device-actions">
          <button
            onClick={(e) => { e.stopPropagation(); onEditNotes(item) }}
            className="rack-device-action"
            title="Notes"
          >
            N
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
            className="rack-device-action"
            title="Remove"
          >
            &times;
          </button>
        </div>
      )}

      {showDeviceDetails && (
        <div className="rack-device-meta">
          <div className="rack-device-title">
            {label}
          </div>
          {item.custom_name && <div className="rack-device-note">{item.device.brand} {item.device.model}</div>}
          {item.notes && <div className="rack-device-note">{item.notes}</div>}
        </div>
      )}
    </div>
  )
}
