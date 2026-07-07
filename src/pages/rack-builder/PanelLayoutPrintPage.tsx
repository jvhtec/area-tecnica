import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '@/features/rack-builder/components/ui/Button'
import type { DeviceFacing } from '@/features/rack-builder/types'
import { usePanelLayoutPrintData } from '@/features/rack-builder/hooks/usePanelLayoutPrintData'
import PanelPrintSheet from '@/features/rack-builder/components/print/PanelPrintSheet'
import { exportPrintSheetsToPdf } from '@/features/rack-builder/lib/printPdfExport'
import '@/features/rack-builder/components/print/layoutPrint.css'

export default function PanelLayoutPrintPage() {
  const { projectId, panelLayoutId } = useParams<{ projectId: string; panelLayoutId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const { project, panel, loading, error } = usePanelLayoutPrintData(projectId, panelLayoutId)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [generatedAt] = useState(() => new Date())
  const exportRootRef = useRef<HTMLDivElement | null>(null)

  const facing = useMemo<DeviceFacing>(() => {
    const queryFacing = searchParams.get('facing')
    if (queryFacing === 'front' || queryFacing === 'rear') return queryFacing
    return panel?.facing ?? 'front'
  }, [panel?.facing, searchParams])

  const setFacing = (value: DeviceFacing) => {
    const next = new URLSearchParams(searchParams)
    next.set('facing', value)
    setSearchParams(next)
  }

  const handleExportPdf = async () => {
    if (!exportRootRef.current || !project || !panel) return

    setExportingPdf(true)
    setExportError(null)
    setExportStatus('Preparing export...')

    try {
      await exportPrintSheetsToPdf({
        rootElement: exportRootRef.current,
        fileName: `${project.name}-${panel.name}-${facing}.pdf`,
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
  }

  if (loading) return <div className="layout-print-loading"><p>Preparing panel PDF preview...</p></div>

  if (error || !panel || !project) {
    return (
      <div className="layout-print-error">
        <p>{error ?? 'Panel layout not found.'}</p>
        <Button variant="secondary" onClick={() => navigate('/rack-builder/projects')}>
          Back to projects
        </Button>
      </div>
    )
  }

  return (
    <div ref={exportRootRef} className="layout-print-page">
      <header className="layout-print-toolbar">
        <div className="layout-print-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/rack-builder/editor/project/${projectId}/panels/${panel.id}`)}>
            Back
          </Button>
          <Button variant={facing === 'front' ? 'primary' : 'secondary'} onClick={() => setFacing('front')}>
            Front
          </Button>
          <Button variant={facing === 'rear' ? 'primary' : 'secondary'} onClick={() => setFacing('rear')}>
            Rear
          </Button>
          <Button onClick={() => void handleExportPdf()} disabled={exportingPdf || loading}>
            {exportingPdf ? 'Exporting...' : exportError ? 'Retry Export PDF' : 'Export PDF'}
          </Button>
        </div>
        <p className="layout-print-toolbar-meta">
          {project.name} | {panel.name} | {panel.height_ru}U
        </p>
        {exportStatus && <p className="layout-print-toolbar-status">{exportStatus}</p>}
        {exportError && <p className="layout-print-toolbar-error">{exportError}</p>}
      </header>

      <main className="layout-print-stage">
        <PanelPrintSheet
          panel={panel}
          facing={facing}
          generatedAt={generatedAt}
          projectOwner={project.owner}
          pageNumber={1}
          pageCount={1}
        />
      </main>
    </div>
  )
}
