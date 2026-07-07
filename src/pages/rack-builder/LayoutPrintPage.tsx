import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '@/features/rack-builder/components/ui/Button'
import LayoutPrintSheet from '@/features/rack-builder/components/print/LayoutPrintSheet'
import RackBomSheet, { getBomPageCount } from '@/features/rack-builder/components/print/RackBomSheet'
import { getDeviceImageUrl } from '@/features/rack-builder/hooks/useDevices'
import { useConnectors } from '@/features/rack-builder/hooks/useConnectors'
import { useLayoutPrintData } from '@/features/rack-builder/hooks/useLayoutPrintData'
import { exportPrintSheetsToPdf } from '@/features/rack-builder/lib/printPdfExport'
import '@/features/rack-builder/components/print/layoutPrint.css'

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = url
  })
}

export default function LayoutPrintPage() {
  const { projectId, layoutId } = useParams<{ projectId: string; layoutId: string }>()
  const navigate = useNavigate()

  const { connectorById } = useConnectors()
  const { layout, rack, project, items, loading, error } = useLayoutPrintData(projectId, layoutId, connectorById)
  const [imagesReady, setImagesReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [includeSimplified, setIncludeSimplified] = useState(false)
  const [includeBom, setIncludeBom] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())
  const exportRootRef = useRef<HTMLDivElement | null>(null)

  const drawingFrameRef = useRef<HTMLDivElement | null>(null)
  const drawingContentRef = useRef<HTMLDivElement | null>(null)

  const scaleLabel = useMemo(() => `Fit (shared) ${scale.toFixed(2)}x`, [scale])
  const rackTotals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        weightKg: acc.weightKg + item.device.weight_kg,
        powerW: acc.powerW + item.device.power_w,
      }),
      { weightKg: 0, powerW: 0 },
    )
  }, [items])

  const uniqueDeviceCount = useMemo(() => new Set(items.map((i) => i.device.id)).size, [items])

  const imageUrls = useMemo(() => {
    const urls = new Set<string>()
    for (const item of items) {
      const frontUrl = getDeviceImageUrl(item.device.front_image_path)
      const rearUrl = getDeviceImageUrl(item.device.rear_image_path)
      if (frontUrl) urls.add(frontUrl)
      if (rearUrl) urls.add(rearUrl)
    }
    return Array.from(urls)
  }, [items])

  const recalculateScale = useCallback(() => {
    const frame = drawingFrameRef.current
    const content = drawingContentRef.current
    if (!frame || !content) return

    const frameWidth = frame.clientWidth
    const frameHeight = frame.clientHeight
    const contentWidth = content.scrollWidth
    const contentHeight = content.scrollHeight

    if (frameWidth <= 0 || frameHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
      setScale(1)
      return
    }

    const nextScale = Math.min(frameWidth / contentWidth, frameHeight / contentHeight, 1)
    setScale((previous) => (Math.abs(previous - nextScale) < 0.001 ? previous : nextScale))
  }, [])

  useEffect(() => {
    let cancelled = false
    const resetTimeoutId = window.setTimeout(() => {
      setImagesReady(false)
    }, 0)

    if (imageUrls.length === 0) {
      const readyTimeoutId = window.setTimeout(() => {
        setImagesReady(true)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(resetTimeoutId)
        window.clearTimeout(readyTimeoutId)
      }
    }

    void Promise.allSettled(imageUrls.map((url) => preloadImage(url))).then(() => {
      if (!cancelled) setImagesReady(true)
    })

    return () => {
      cancelled = true
      window.clearTimeout(resetTimeoutId)
    }
  }, [imageUrls])

  useEffect(() => {
    const frame = drawingFrameRef.current
    const content = drawingContentRef.current
    if (!frame || !content) return

    const frameId = window.requestAnimationFrame(() => recalculateScale())
    const observer = new window.ResizeObserver(() => recalculateScale())
    observer.observe(frame)
    observer.observe(content)

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frameId)
    }
  }, [recalculateScale, rack?.id])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => recalculateScale())
    return () => window.cancelAnimationFrame(frameId)
  }, [recalculateScale, items, imagesReady])

  const handleExportPdf = useCallback(async () => {
    if (!exportRootRef.current || !layout || !rack) return

    setExportingPdf(true)
    setExportError(null)
    setExportStatus('Preparing export...')

    try {
      await exportPrintSheetsToPdf({
        rootElement: exportRootRef.current,
        fileName: `${project?.name ?? 'project'}-${layout.name}.pdf`,
        format: 'a3',
        orientation: 'landscape',
        qualityMode: 'balanced',
        onProgress: (progress) => setExportStatus(progress.message),
      })
      setExportStatus('PDF download started.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export PDF.'
      setExportError(message)
      setExportStatus(null)
    } finally {
      setExportingPdf(false)
    }
  }, [layout, project?.name, rack])

  if (error) {
    return (
      <div className="layout-print-error">
        <p>{error}</p>
        <Button variant="secondary" onClick={() => navigate('/rack-builder/projects')}>
          Back to projects
        </Button>
      </div>
    )
  }

  if (loading || !layout || !rack) {
    return (
      <div className="layout-print-loading">
        <p>Preparing A3 PDF preview...</p>
      </div>
    )
  }

  return (
    <div ref={exportRootRef} className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/rack-builder/editor/project/${projectId}?layout=${layoutId}`)}>
            Back
          </Button>
          <Button onClick={() => void handleExportPdf()} disabled={exportingPdf || loading || !imagesReady}>
            {exportingPdf ? 'Exporting...' : exportError ? 'Retry Export PDF' : 'Export PDF'}
          </Button>
          <label className="layout-print-toolbar-label">
            <input
              type="checkbox"
              checked={includeSimplified}
              onChange={(e) => setIncludeSimplified(e.target.checked)}
            />
            Include simplified view
          </label>
          <label className="layout-print-toolbar-label">
            <input
              type="checkbox"
              checked={includeBom}
              onChange={(e) => setIncludeBom(e.target.checked)}
            />
            Include BOM
          </label>
        </div>
        <p className="layout-print-toolbar-meta">
          {layout.name} | {rack.name} | {rackTotals.weightKg.toFixed(2)} kg | {rackTotals.powerW} W | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
        {exportStatus && <p className="layout-print-toolbar-status">{exportStatus}</p>}
        {exportError && <p className="layout-print-toolbar-error">{exportError}</p>}
      </header>

      <main className={`layout-print-stage ${includeSimplified || includeBom ? 'layout-print-stage--project' : ''}`}>
        {(() => {
          const bomPages = includeBom ? getBomPageCount(uniqueDeviceCount) : 0
          const totalPages = 1 + (includeSimplified ? 1 : 0) + bomPages
          let nextPage = 1
          return (
            <>
              <LayoutPrintSheet
                layout={layout}
                rack={rack}
                items={items}
                generatedAt={generatedAt}
                projectOwner={project?.owner}
                totalWeightKg={rackTotals.weightKg}
                totalPowerW={rackTotals.powerW}
                scaleLabel={scaleLabel}
                pageNumber={nextPage++}
                pageCount={totalPages}
                scale={scale}
                drawingFrameRef={drawingFrameRef}
                drawingContentRef={drawingContentRef}
                sheetClassName={includeSimplified || includeBom ? 'layout-print-page-break' : undefined}
              />
              {includeSimplified && (
                <LayoutPrintSheet
                  layout={layout}
                  rack={rack}
                  items={items}
                  generatedAt={generatedAt}
                  projectOwner={project?.owner}
                  totalWeightKg={rackTotals.weightKg}
                  totalPowerW={rackTotals.powerW}
                  scaleLabel={scaleLabel}
                  pageNumber={nextPage++}
                  pageCount={totalPages}
                  useAutoFitScale
                  simplifiedView
                  sheetClassName={includeBom ? 'layout-print-page-break' : undefined}
                />
              )}
              {includeBom && (
                <RackBomSheet
                  layout={layout}
                  rack={rack}
                  items={items}
                  generatedAt={generatedAt}
                  projectOwner={project?.owner}
                  totalWeightKg={rackTotals.weightKg}
                  totalPowerW={rackTotals.powerW}
                  startPageNumber={nextPage}
                  pageCount={totalPages}
                />
              )}
            </>
          )
        })()}
      </main>
    </div>
  )
}
