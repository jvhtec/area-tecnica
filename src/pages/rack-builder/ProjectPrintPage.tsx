import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '@/features/rack-builder/components/ui/Button'
import LayoutPrintSheet from '@/features/rack-builder/components/print/LayoutPrintSheet'
import RackBomSheet, { getBomPageCount } from '@/features/rack-builder/components/print/RackBomSheet'
import ProjectPrintCover from '@/features/rack-builder/components/print/ProjectPrintCover'
import ProjectPrintIndex from '@/features/rack-builder/components/print/ProjectPrintIndex'
import PanelPrintSheet from '@/features/rack-builder/components/print/PanelPrintSheet'
import { getDeviceImageUrl } from '@/features/rack-builder/hooks/useDevices'
import { useConnectors } from '@/features/rack-builder/hooks/useConnectors'
import { useProjectPrintData, type PrintLayoutModel } from '@/features/rack-builder/hooks/useProjectPrintData'
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

interface LayoutPageEntry {
  startPage: number
  mainPages: number
  simplifiedPages: number
  bomPages: number
}

interface PagePlan {
  layouts: LayoutPageEntry[]
  panelStartPage: number
  pageCount: number
}

function buildPagePlan(
  layoutModels: PrintLayoutModel[],
  panelCount: number,
  includeSimplified: boolean,
  includeBom: boolean,
): PagePlan {
  const layouts: LayoutPageEntry[] = []
  let cursor = 3 // pages 1=cover, 2=index, layouts start at 3

  for (const model of layoutModels) {
    const bomPages = includeBom
      ? getBomPageCount(new Set(model.items.map((i) => i.device.id)).size)
      : 0
    const simplifiedPages = includeSimplified ? 1 : 0

    layouts.push({
      startPage: cursor,
      mainPages: 1,
      simplifiedPages,
      bomPages,
    })

    cursor += 1 + simplifiedPages + bomPages
  }

  return {
    layouts,
    panelStartPage: cursor,
    pageCount: cursor - 1 + panelCount,
  }
}

export default function ProjectPrintPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const { connectorById } = useConnectors()
  const { project, layoutModels, panelModels, loading, error } = useProjectPrintData(projectId, connectorById)
  const [imagesReady, setImagesReady] = useState(false)
  const [includeSimplified, setIncludeSimplified] = useState(false)
  const [includeBom, setIncludeBom] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())
  const exportRootRef = useRef<HTMLDivElement | null>(null)

  const imageUrls = useMemo(() => {
    const urls = new Set<string>()
    for (const model of layoutModels) {
      for (const item of model.items) {
        const frontUrl = getDeviceImageUrl(item.device.front_image_path)
        const rearUrl = getDeviceImageUrl(item.device.rear_image_path)
        if (frontUrl) urls.add(frontUrl)
        if (rearUrl) urls.add(rearUrl)
      }
    }
    return Array.from(urls)
  }, [layoutModels])

  const pagePlan = useMemo(
    () => buildPagePlan(layoutModels, panelModels.length, includeSimplified, includeBom),
    [layoutModels, panelModels.length, includeSimplified, includeBom],
  )

  const layoutIndexRows = layoutModels.map((model, index) => ({
    layoutName: model.layout.name,
    rackName: model.rack.name,
    rackSpec: `${model.rack.rack_units}U | ${model.rack.width} | ${model.rack.depth_mm}mm`,
    totalPowerW: model.totalPowerW,
    totalWeightKg: model.totalWeightKg,
    pageNumber: pagePlan.layouts[index]?.startPage ?? 3,
  }))

  const panelIndexRows = panelModels.map((panel, index) => ({
    layoutName: panel.name,
    rackName: `${panel.height_ru}U panel`,
    rackSpec: panel.facing,
    totalPowerW: 0,
    totalWeightKg: panel.weight_kg,
    pageNumber: pagePlan.panelStartPage + index,
  }))

  const indexRows = [...layoutIndexRows, ...panelIndexRows]

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

  const handleExportPdf = useCallback(async () => {
    if (!exportRootRef.current || !project) return

    setExportingPdf(true)
    setExportError(null)
    setExportStatus('Preparing export...')

    try {
      await exportPrintSheetsToPdf({
        rootElement: exportRootRef.current,
        fileName: `${project.name}-project.pdf`,
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
  }, [project])

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

  if (loading) {
    return (
      <div className="layout-print-loading">
        <p>Preparing project PDF preview...</p>
      </div>
    )
  }

  if (!project || (layoutModels.length === 0 && panelModels.length === 0)) {
    return (
      <div className="layout-print-error">
        <p>This project does not have any layouts or panel sheets to export.</p>
        <Button variant="secondary" onClick={() => navigate(`/rack-builder/editor/project/${projectId}`)}>
          Back to editor
        </Button>
      </div>
    )
  }

  return (
    <div ref={exportRootRef} className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => {
            if (layoutModels.length > 0) {
              navigate(`/rack-builder/editor/project/${projectId}?layout=${layoutModels[0].layout.id}`)
            } else if (panelModels.length > 0) {
              navigate(`/rack-builder/editor/project/${projectId}`)
            } else {
              navigate(`/rack-builder/editor/project/${projectId}`)
            }
          }}>
            Back
          </Button>
          <Button
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf || loading || !imagesReady || (layoutModels.length + panelModels.length === 0)}
          >
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
          {project.name} | {layoutModels.length} layouts + {panelModels.length} panels | {imagesReady ? 'Ready' : 'Loading images'}
        </p>
        {exportStatus && <p className="layout-print-toolbar-status">{exportStatus}</p>}
        {exportError && <p className="layout-print-toolbar-error">{exportError}</p>}
      </header>

      <main className="layout-print-stage layout-print-stage--project">
        <ProjectPrintCover project={project} generatedAt={generatedAt} />
        <ProjectPrintIndex
          projectName={project.name}
          rows={indexRows}
          generatedAt={generatedAt}
          pageNumber={2}
          pageCount={pagePlan.pageCount}
        />

        {layoutModels.map((model, index) => {
          const entry = pagePlan.layouts[index]
          const layoutPageNumber = entry?.startPage ?? 3
          const isLastLayout = index === layoutModels.length - 1
          const hasMoreAfterMain = includeSimplified || includeBom || !isLastLayout || panelModels.length > 0
          const hasMoreAfterSimplified = includeBom || !isLastLayout || panelModels.length > 0
          const hasMoreAfterBom = !isLastLayout || panelModels.length > 0

          const simplifiedPageNumber = layoutPageNumber + (entry?.mainPages ?? 1)
          const bomStartPage = simplifiedPageNumber + (entry?.simplifiedPages ?? 0)

          return (
            <Fragment key={model.layout.id}>
              <LayoutPrintSheet
                layout={model.layout}
                rack={model.rack}
                items={model.items}
                generatedAt={generatedAt}
                projectOwner={project.owner}
                totalWeightKg={model.totalWeightKg}
                totalPowerW={model.totalPowerW}
                scaleLabel="Fit (auto)"
                useAutoFitScale
                pageNumber={layoutPageNumber}
                pageCount={pagePlan.pageCount}
                sheetClassName={hasMoreAfterMain ? 'layout-print-page-break' : ''}
              />
              {includeSimplified && (
                <LayoutPrintSheet
                  layout={model.layout}
                  rack={model.rack}
                  items={model.items}
                  generatedAt={generatedAt}
                  projectOwner={project.owner}
                  totalWeightKg={model.totalWeightKg}
                  totalPowerW={model.totalPowerW}
                  scaleLabel="Fit (auto)"
                  useAutoFitScale
                  simplifiedView
                  pageNumber={simplifiedPageNumber}
                  pageCount={pagePlan.pageCount}
                  sheetClassName={hasMoreAfterSimplified ? 'layout-print-page-break' : ''}
                />
              )}
              {includeBom && (
                <RackBomSheet
                  layout={model.layout}
                  rack={model.rack}
                  items={model.items}
                  generatedAt={generatedAt}
                  projectOwner={project.owner}
                  totalWeightKg={model.totalWeightKg}
                  totalPowerW={model.totalPowerW}
                  startPageNumber={bomStartPage}
                  pageCount={pagePlan.pageCount}
                  breakAfterLastPage={hasMoreAfterBom}
                />
              )}
            </Fragment>
          )
        })}

        {panelModels.map((panel, index) => {
          const pageNumber = pagePlan.panelStartPage + index
          const isLast = index === panelModels.length - 1
          return (
            <PanelPrintSheet
              key={panel.id}
              panel={panel}
              facing={panel.facing}
              generatedAt={generatedAt}
              projectOwner={project.owner}
              pageNumber={pageNumber}
              pageCount={pagePlan.pageCount}
              sheetClassName={isLast ? '' : 'layout-print-page-break'}
            />
          )
        })}
      </main>
    </div>
  )
}
