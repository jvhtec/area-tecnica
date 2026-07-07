import { useConnectors } from '../../hooks/useConnectors'
import type { DeviceFacing, PanelLayout, PanelLayoutPort } from '../../types'
import { formatDrawingState, formatRevisionLabel } from '../../lib/drawingState'
import PanelLayoutCanvas from '../panels/PanelLayoutCanvas'
import PrintCartouche from './PrintCartouche'

interface PanelPrintSheetProps {
  panel: PanelLayout
  facing: DeviceFacing
  generatedAt: Date
  projectOwner?: string | null
  pageNumber: number
  pageCount: number
  sheetClassName?: string
}

function connectorName(port: PanelLayoutPort, connectorById: Map<string, { name: string }>): string {
  const connector = connectorById.get(port.connector_id)
  return port.label?.trim() || connector?.name || port.connector_id
}

function connectorType(port: PanelLayoutPort, connectorById: Map<string, { name: string }>): string {
  const connector = connectorById.get(port.connector_id)
  return connector?.name || `Unknown (${port.connector_id})`
}

export default function PanelPrintSheet({
  panel,
  facing,
  generatedAt,
  projectOwner,
  pageNumber,
  pageCount,
  sheetClassName,
}: PanelPrintSheetProps) {
  const { connectorById } = useConnectors()
  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt)

  const ports = [...(panel.ports ?? [])].sort((a, b) =>
    a.row_index !== b.row_index ? a.row_index - b.row_index : a.hole_index - b.hole_index,
  )

  return (
    <section className={`layout-print-sheet ${sheetClassName ?? ''}`.trim()} aria-label={`Panel drawing for ${panel.name}`}>
      <div className="layout-print-sheet-inner">
        <div className="layout-print-drawing-frame">
          <div className="panel-print-content">
            <h2 className="panel-print-heading">
              {panel.name} &mdash; {panel.height_ru}U &mdash; {facing === 'front' ? 'Front' : 'Rear'}
            </h2>

            <div className="panel-print-canvas-area">
              <div style={{ width: panel.height_ru <= 2 ? '80%' : '90%' }}>
                <PanelLayoutCanvas
                  connectorById={connectorById}
                  heightRu={panel.height_ru}
                  rows={panel.rows ?? []}
                  ports={ports}
                  facing={facing}
                  hasLacingBar={panel.has_lacing_bar}
                  showGuides={false}
                  interactive={false}
                  showScaleMarker={false}
                />
              </div>
            </div>

            {ports.length > 0 && (
              <div className="panel-print-connector-wrap">
                <table className="panel-print-connector-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Row</th>
                      <th>Hole</th>
                      <th>Type</th>
                      <th>Label</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ports.map((port, idx) => (
                      <tr key={port.id}>
                        <td>{idx + 1}</td>
                        <td>U{port.row_index + 1}</td>
                        <td>{port.hole_index + 1}</td>
                        <td>{connectorType(port, connectorById)}</td>
                        <td>{connectorName(port, connectorById)}</td>
                        <td>{port.span_w}&times;{port.span_h}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="panel-print-footnote">
              19-inch panel width represented across drawing frame.
            </p>
          </div>
        </div>

        <PrintCartouche
          title="Panel Layout"
          jobName={panel.name}
          pageNumber={pageNumber}
          pageCount={pageCount}
          extraFields={[
            { label: 'Panel Spec', value: `${panel.height_ru}U | ${facing}` },
            { label: 'Rows', value: String((panel.rows ?? []).length) },
            { label: 'Connectors', value: String(ports.length) },
            { label: 'State', value: formatDrawingState(panel.drawing_state) },
            { label: 'Revision', value: formatRevisionLabel(panel.drawing_state, panel.revision_number) },
            { label: 'Weight', value: `${panel.weight_kg.toFixed(2)} kg` },
            { label: 'Lacing Bar', value: panel.has_lacing_bar ? 'Enabled' : 'Disabled' },
            { label: 'Generated', value: projectOwner ? `${projectOwner} — ${generatedAtLabel}` : generatedAtLabel },
          ]}
        />
      </div>
    </section>
  )
}
