import { useMemo, type CSSProperties } from 'react'
import type { ConnectorDefinition, DeviceFacing, LayoutItemWithDevice, Rack } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import { buildSlots, getSlotTopPx } from '../editor/rackGeometry'
import { getRackPanelAspect } from '../../lib/rackVisual'
import { getItemSlot, getSlotStyle } from '../../lib/rackPositions'
import { buildRackFaceViewModel, resolveVisibleImageSide, selectFacingImagePath } from '../../lib/rackViewModel'
import { buildPanelThumbnailSvg } from '../../lib/panelThumbnail'
import AutoScaleText from '../shared/AutoScaleText'

function SimplifiedDeviceContent({ item }: { item: LayoutItemWithDevice }) {
  const isCompact = item.device.rack_units <= 1
  const minNoteFontPx = isCompact ? 7.5 : 9.5
  const maxNoteFontPx = isCompact ? 10.5 : 14

  return (
    <div className={`print-rack-device-simplified-layout ${isCompact ? 'print-rack-device-simplified-layout--compact' : ''}`}>
      <span className="print-rack-device-simplified-brand">{item.device.brand}</span>
      <span className="print-rack-device-simplified-model">{item.device.model}</span>
      {item.notes && (
        <AutoScaleText
          className="print-rack-device-simplified-notes"
          text={item.notes}
          minFontPx={minNoteFontPx}
          maxFontPx={maxNoteFontPx}
        />
      )}
      <span className="print-rack-device-simplified-name">{item.custom_name?.trim() || ''}</span>
    </div>
  )
}

const PRINT_RAIL_WIDTH_PX = 10
const PRINT_SINGLE_WIDTH_PX = 420
const PRINT_DUAL_WIDTH_PX = 690
const PRINT_CASING_HEIGHT_PX = 16
const PRINT_HEADER_HEIGHT_PX = 28

function getPrintSlotHeight(rackWidth: 'single' | 'dual'): number {
  const totalPx = rackWidth === 'dual' ? PRINT_DUAL_WIDTH_PX : PRINT_SINGLE_WIDTH_PX
  const laneCount = rackWidth === 'dual' ? 2 : 1
  const lanePx = totalPx / laneCount
  return Math.round(lanePx / getRackPanelAspect(1))
}

interface RackPrintViewProps {
  rack: Rack
  items: LayoutItemWithDevice[]
  facing: DeviceFacing
  connectorById: Map<string, ConnectorDefinition>
  showDeviceDetails?: boolean
  simplifiedView?: boolean
}

export default function RackPrintView({
  rack,
  items,
  facing,
  connectorById,
  showDeviceDetails = true,
  simplifiedView = false,
}: RackPrintViewProps) {
  const laneCount = rack.width === 'dual' ? 2 : 1
  const slotHeight = useMemo(() => getPrintSlotHeight(rack.width), [rack.width])
  const labelOffsetPx = PRINT_CASING_HEIGHT_PX + PRINT_HEADER_HEIGHT_PX
  const slots = useMemo(() => buildSlots(rack.rack_units), [rack.rack_units])
  const {
    activeItems,
    activeSlotByItemId: activeSlotAssignments,
    ghostItems,
    ghostSlotByItemId: ghostSlotAssignments,
  } = useMemo(
    () => buildRackFaceViewModel(items, facing, rack.width),
    [facing, items, rack.width],
  )

  const rackStyle = {
    '--print-slot-height': `${slotHeight}px`,
    '--print-rail-width': `${PRINT_RAIL_WIDTH_PX}px`,
    width: `${rack.width === 'dual' ? PRINT_DUAL_WIDTH_PX : PRINT_SINGLE_WIDTH_PX}px`,
  } as CSSProperties

  function renderDeviceContent(item: LayoutItemWithDevice) {
    const label = item.custom_name?.trim() || `${item.device.brand} ${item.device.model}`
    const panelLayout = item.asset_kind === 'panel_layout' ? item.panel_layout : null
    const panelSvg = panelLayout && connectorById.size > 0
      ? buildPanelThumbnailSvg(panelLayout, resolveVisibleImageSide(item.facing, facing), connectorById)
      : null

    if (simplifiedView) {
      return (
        <>
          {panelSvg && (
            <div className="print-rack-device-media">
              <div
                style={{ width: '100%', height: '100%' }}
                dangerouslySetInnerHTML={{ __html: panelSvg }}
              />
            </div>
          )}
          <SimplifiedDeviceContent item={item} />
        </>
      )
    }

    const imageUrl = panelSvg ? null : getDeviceImageUrl(selectFacingImagePath(item, facing))

    return (
      <>
        <div className="print-rack-device-media">
          {panelSvg ? (
            <div
              style={{ width: '100%', height: '100%' }}
              dangerouslySetInnerHTML={{ __html: panelSvg }}
            />
          ) : imageUrl ? (
            <img src={imageUrl} alt={label} crossOrigin="anonymous" />
          ) : (
            <div className="print-rack-device-fallback">
              <span>{label}</span>
            </div>
          )}
        </div>

        {showDeviceDetails && (
          <div className="print-rack-device-meta">
            <p className="print-rack-device-title">
              {label}
            </p>
            {item.custom_name && <p className="print-rack-device-note">{item.device.brand} {item.device.model}</p>}
            {item.notes && <p className="print-rack-device-note">{item.notes}</p>}
          </div>
        )}
      </>
    )
  }

  return (
    <section className="print-rack-view">
      <div className="print-rack-caption">
        {rack.name} - {rack.rack_units}U - {facing === 'front' ? 'Front' : 'Rear'} View
      </div>

      <div className="print-rack-viewport">
        <div className="print-rack-u-labels" style={{ paddingTop: `${labelOffsetPx}px` }}>
          {slots.map((u) => (
            <div key={`${facing}-label-${u}`} className="print-rack-u-label-row" style={{ height: `${slotHeight}px` }}>
              <span className="print-rack-u-label">{u}</span>
              <span className="print-rack-u-line" />
            </div>
          ))}
        </div>

        <div className="print-rack-cabinet" style={rackStyle}>
          <div className="print-rack-shell print-rack-shell-top" />
          <div className="print-rack-header">
            {facing === 'front' ? 'Front' : 'Rear'}
          </div>
          <div className="print-rack-body">
            <div className="print-rack-rails">
              <div className="print-rack-rail print-rack-rail-left" />
              <div className="print-rack-rail print-rack-rail-right" />
              {laneCount === 2 && <div className="print-rack-rail print-rack-rail-divider" />}
            </div>

            {slots.map((u) => (
              <div
                key={`${facing}-slot-${u}`}
                className="print-rack-slot-row"
                style={{ height: `${slotHeight}px` }}
              />
            ))}

            <div className="print-rack-device-layer">
              {ghostItems.map((item, index) => {
                const topPx = getSlotTopPx(rack.rack_units, item.start_u, item.device.rack_units, slotHeight)
                const slot = ghostSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
                const { left: laneLeft, width: laneWidth } = getSlotStyle(slot, rack.width, facing)
                const height = item.device.rack_units * slotHeight

                return (
                  <div
                    key={item.id}
                    className="print-rack-device-wrap print-rack-device-wrap--ghost"
                    style={{
                      top: `${topPx}px`,
                      left: laneLeft,
                      width: laneWidth,
                      height: `${height}px`,
                      zIndex: 5 + index,
                    }}
                  >
                    <div className={`print-rack-device ${item.device.rack_units === 1 ? 'print-rack-device--compact' : ''} ${simplifiedView ? 'print-rack-device--simplified' : ''}`}>
                      {renderDeviceContent(item)}
                    </div>
                  </div>
                )
              })}

              {activeItems.map((item, index) => {
                const topPx = getSlotTopPx(rack.rack_units, item.start_u, item.device.rack_units, slotHeight)
                const slot = activeSlotAssignments.get(item.id) ?? getItemSlot(item, rack.width)
                const { left: laneLeft, width: laneWidth } = getSlotStyle(slot, rack.width, facing)
                const height = item.device.rack_units * slotHeight

                return (
                  <div
                    key={item.id}
                    className="print-rack-device-wrap"
                    style={{
                      top: `${topPx}px`,
                      left: laneLeft,
                      width: laneWidth,
                      height: `${height}px`,
                      zIndex: 10 + index,
                    }}
                  >
                    <div className={`print-rack-device ${item.device.rack_units === 1 ? 'print-rack-device--compact' : ''} ${simplifiedView ? 'print-rack-device--simplified' : ''}`}>
                      {renderDeviceContent(item)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="print-rack-shell print-rack-shell-bottom" />
        </div>
      </div>
    </section>
  )
}
