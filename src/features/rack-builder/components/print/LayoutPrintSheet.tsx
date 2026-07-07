import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import RackPrintView from './RackPrintView'
import PrintCartouche from './PrintCartouche'
import { useConnectors } from '../../hooks/useConnectors'
import type { Layout, LayoutItemWithDevice, Rack } from '../../types'
import { formatDrawingState, formatRevisionLabel } from '../../lib/drawingState'

interface LayoutPrintSheetProps {
  layout: Layout
  rack: Rack
  items: LayoutItemWithDevice[]
  generatedAt: Date
  projectOwner?: string | null
  totalWeightKg: number
  totalPowerW: number
  scaleLabel: string
  pageNumber: number
  pageCount: number
  scale?: number
  useAutoFitScale?: boolean
  simplifiedView?: boolean
  drawingFrameRef?: RefObject<HTMLDivElement | null>
  drawingContentRef?: RefObject<HTMLDivElement | null>
  sheetClassName?: string
}

export default function LayoutPrintSheet({
  layout,
  rack,
  items,
  generatedAt,
  projectOwner,
  totalWeightKg,
  totalPowerW,
  scaleLabel,
  pageNumber,
  pageCount,
  scale = 1,
  useAutoFitScale = false,
  simplifiedView = false,
  drawingFrameRef,
  drawingContentRef,
  sheetClassName,
}: LayoutPrintSheetProps) {
  const internalFrameRef = useRef<HTMLDivElement | null>(null)
  const internalContentRef = useRef<HTMLDivElement | null>(null)
  const [autoScale, setAutoScale] = useState(1)

  const frameRef = drawingFrameRef ?? internalFrameRef
  const contentRef = drawingContentRef ?? internalContentRef

  const recalculateScale = useCallback(() => {
    if (!useAutoFitScale) return

    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return

    const frameWidth = frame.clientWidth
    const frameHeight = frame.clientHeight
    const contentWidth = content.scrollWidth
    const contentHeight = content.scrollHeight

    if (frameWidth <= 0 || frameHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      setAutoScale(1)
      return
    }

    const nextScale = Math.min(frameWidth / contentWidth, frameHeight / contentHeight, 1)
    setAutoScale((previous) => (Math.abs(previous - nextScale) < 0.001 ? previous : nextScale))
  }, [contentRef, frameRef, useAutoFitScale])

  useEffect(() => {
    if (!useAutoFitScale) return

    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return

    const frameId = window.requestAnimationFrame(() => recalculateScale())
    const observer = new ResizeObserver(() => recalculateScale())
    observer.observe(frame)
    observer.observe(content)

    const handleBeforePrint = () => recalculateScale()
    window.addEventListener('beforeprint', handleBeforePrint)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('beforeprint', handleBeforePrint)
    }
  }, [contentRef, frameRef, recalculateScale, useAutoFitScale])

  useEffect(() => {
    if (!useAutoFitScale) return
    const frameId = window.requestAnimationFrame(() => recalculateScale())
    return () => window.cancelAnimationFrame(frameId)
  }, [items, rack.id, recalculateScale, useAutoFitScale])

  const { connectorById } = useConnectors()

  const effectiveScale = useAutoFitScale ? autoScale : scale

  const effectiveScaleLabel = useMemo(() => {
    if (useAutoFitScale) return `Fit (shared) ${effectiveScale.toFixed(2)}x`
    return scaleLabel
  }, [effectiveScale, scaleLabel, useAutoFitScale])

  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt)
  const generatedBy = projectOwner ? `${projectOwner} — ${generatedAtLabel}` : generatedAtLabel

  return (
    <section className={`layout-print-sheet ${sheetClassName ?? ''}`.trim()} aria-label={`A3 drawing sheet for ${layout.name}`}>
      <div className="layout-print-sheet-inner">
        <div ref={frameRef} className="layout-print-drawing-frame">
          <div className="layout-print-drawing-scale" style={{ transform: `scale(${effectiveScale})` }}>
            <div ref={contentRef} className="layout-print-drawing-row">
              <RackPrintView rack={rack} items={items} facing="front" connectorById={connectorById} showDeviceDetails simplifiedView={simplifiedView} />
              <RackPrintView rack={rack} items={items} facing="rear" connectorById={connectorById} showDeviceDetails simplifiedView={simplifiedView} />
            </div>
          </div>
        </div>

        <PrintCartouche
          title={simplifiedView ? 'Rack Layout — Simplified View' : 'Rack Layout Drawing'}
          jobName={layout.name}
          pageNumber={pageNumber}
          pageCount={pageCount}
          extraFields={[
            { label: 'Rack', value: rack.name },
            { label: 'Rack Spec', value: `${rack.rack_units}U | ${rack.width} | ${rack.depth_mm}mm` },
            { label: 'Total Weight', value: `${totalWeightKg.toFixed(2)} kg` },
            { label: 'Total Power', value: `${totalPowerW} W` },
            { label: 'State', value: formatDrawingState(layout.drawing_state) },
            { label: 'Revision', value: formatRevisionLabel(layout.drawing_state, layout.revision_number) },
            { label: 'Scale', value: effectiveScaleLabel },
            { label: 'Generated', value: generatedBy },
          ]}
        />
      </div>
    </section>
  )
}
