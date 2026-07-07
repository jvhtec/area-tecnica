import PanelLayoutCanvas from './PanelLayoutCanvas'
import { isMountingAllowed } from '../../lib/panelGrid'
import { DRAWING_STATE_OPTIONS } from '../../lib/drawingState'
import { CATEGORY_DOT, DarkInput, DarkLabel, DarkSelect, PortColorPicker } from './PanelLayoutEditorPrimitives'
import type { ConnectorDefinition, DeviceFacing, DrawingState, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../../types'

interface RowCapacity {
  row_index: number
  hole_count: number
  occupied_holes: number
}

interface PanelLayoutMobileViewProps {
  navigate: (path: string) => void
  projectId: string
  panel: PanelLayout
  facing: DeviceFacing
  setFacing: (value: DeviceFacing) => void
  ports: PanelLayoutPort[]
  saveActive: boolean
  saving: boolean
  dirty: boolean
  handleSave: () => Promise<void>
  error: string | null
  setError: (value: string | null) => void
  selectedConnectorId: string | null
  setSelectedConnectorId: (id: string | null) => void
  mobileZoom: number
  setMobileZoom: (updater: (prev: number) => number) => void
  rows: PanelLayoutRow[]
  rowCapacityByIndex: Map<number, RowCapacity>
  connectorById: Map<string, ConnectorDefinition>
  hasLacingBar: boolean
  setHasLacingBar: (value: boolean) => void
  selectedPortId: string | null
  setSelectedPortId: (id: string | null) => void
  placeConnector: (rowIndex: number, forcedConnectorId?: string) => void
  handleRowDrop: (rowIndex: number, transferId: string, isPortMove: boolean) => void
  canDropInRow: (rowIndex: number, transferId: string, isPortMove: boolean) => boolean
  selectedPort: PanelLayoutPort | null
  mobileSheet: 'connectors' | 'properties' | 'port-edit' | null
  setMobileSheet: (sheet: 'connectors' | 'properties' | 'port-edit' | null) => void
  removeSelectedPort: () => void
  grouped: Array<{ category: string; items: ConnectorDefinition[] }>
  updateSelectedPortLabel: (label: string) => void
  updateSelectedPortColor: (color: string | null) => void
  name: string
  setName: (value: string) => void
  setDirty: (value: boolean) => void
  drawingState: DrawingState
  setDrawingState: (value: DrawingState) => void
  notes: string
  setNotes: (value: string) => void
}

export default function PanelLayoutMobileView({
  navigate,
  projectId,
  panel,
  facing,
  setFacing,
  ports,
  saveActive,
  saving,
  dirty,
  handleSave,
  error,
  setError,
  selectedConnectorId,
  setSelectedConnectorId,
  mobileZoom,
  setMobileZoom,
  rows,
  rowCapacityByIndex,
  connectorById,
  hasLacingBar,
  setHasLacingBar,
  selectedPortId,
  setSelectedPortId,
  placeConnector,
  handleRowDrop,
  canDropInRow,
  selectedPort,
  mobileSheet,
  setMobileSheet,
  removeSelectedPort,
  grouped,
  updateSelectedPortLabel,
  updateSelectedPortColor,
  name,
  setName,
  setDirty,
  drawingState,
  setDrawingState,
  notes,
  setNotes,
}: PanelLayoutMobileViewProps) {
  const selectedPortConnector = selectedPort
    ? connectorById.get(selectedPort.connector_id) ?? null
    : null

  const zoomPercent = Math.round(mobileZoom * 100)
  const zoomOutDisabled = mobileZoom <= 0.6
  const zoomInDisabled = mobileZoom >= 1.8
  const zoomResetDisabled = mobileZoom === 1

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 overflow-hidden">
      {/* Mobile header */}
      <header
        className="flex items-center justify-between px-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shrink-0 z-30"
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(`/rack-builder/editor/project/${projectId}/panels`)}
          className="text-gray-600 dark:text-slate-300 text-sm font-semibold"
        >
          &larr; Back
        </button>
        <div className="flex flex-col items-center min-w-0 px-2">
          <h1 className="text-sm font-bold truncate max-w-[150px] dark:text-white">{panel.name}</h1>
          <span className="text-[10px] text-gray-500 dark:text-slate-500">{panel.height_ru}U · {facing} · {ports.length} connectors</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={!saveActive}
            className={`text-sm font-semibold px-2 ${saveActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-slate-600'}`}
          >
            {saving ? '…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-950/60 border-b border-red-900/40 px-4 py-2 text-xs text-red-400 shrink-0">
          {error}
          <button className="ml-2 text-red-500" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Placement mode indicator (fixed, above canvas) */}
      {selectedConnectorId && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs text-amber-300 truncate">
              <strong>{connectorById.get(selectedConnectorId)?.name}</strong> — tap a row to place
            </span>
          </div>
          <button
            onClick={() => setSelectedConnectorId(null)}
            className="ml-2 shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Canvas area */}
      <main
        className="flex-1 overflow-auto"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0a0f1a 70%)',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="p-4 flex flex-col items-center gap-3">
          <div className="w-full max-w-lg flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setMobileZoom((prev) => Math.max(0.6, +(prev - 0.1).toFixed(2)))}
              disabled={zoomOutDisabled}
              aria-disabled={zoomOutDisabled}
              className={`min-h-9 min-w-9 rounded-md border px-2 text-sm font-bold transition ${
                zoomOutDisabled
                  ? 'cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-600'
                  : 'border-slate-700 bg-slate-900/70 text-slate-200'
              }`}
              aria-label="Zoom out panel"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setMobileZoom(() => 1)}
              disabled={zoomResetDisabled}
              aria-disabled={zoomResetDisabled}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold transition ${
                zoomResetDisabled
                  ? 'cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-600'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300'
              }`}
              aria-label="Reset panel zoom"
            >
              Zoom {zoomPercent}%
            </button>
            <button
              type="button"
              onClick={() => setMobileZoom((prev) => Math.min(1.8, +(prev + 0.1).toFixed(2)))}
              disabled={zoomInDisabled}
              aria-disabled={zoomInDisabled}
              className={`min-h-9 min-w-9 rounded-md border px-2 text-sm font-bold transition ${
                zoomInDisabled
                  ? 'cursor-not-allowed border-slate-800 bg-slate-900/30 text-slate-600'
                  : 'border-slate-700 bg-slate-900/70 text-slate-200'
              }`}
              aria-label="Zoom in panel"
            >
              +
            </button>
          </div>

          {/* Row usage summary */}
          <div className="w-full max-w-lg flex flex-wrap gap-1.5 justify-center">
            {rows.map((row) => {
              const capacity = rowCapacityByIndex.get(row.row_index)
              const pct = capacity ? Math.round((capacity.occupied_holes / capacity.hole_count) * 100) : 0
              return (
                <div key={row.id} className="rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1">
                  <span className="text-[9px] font-mono text-slate-500">U{row.row_index + 1}</span>
                  <span className="ml-1 text-[9px] text-slate-400">{pct}%</span>
                </div>
              )
            })}
          </div>

          <div className="w-full self-stretch overflow-x-auto -mx-4 px-4">
            <div
              className="mx-auto"
              style={{
                width: `${mobileZoom * 100}%`,
              }}
            >
              <PanelLayoutCanvas
                connectorById={connectorById}
                heightRu={panel.height_ru}
                rows={rows}
                ports={ports}
                facing={facing}
                hasLacingBar={hasLacingBar}
                selectedPortId={selectedPortId}
                onRowClick={(rowIndex) => placeConnector(rowIndex)}
                onRowDrop={handleRowDrop}
                canDropInRow={canDropInRow}
                onPortClick={(portId) => {
                  setSelectedPortId(portId === selectedPortId ? null : portId)
                  setSelectedConnectorId(null)
                }}
                interactive
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-600 max-w-xs text-center">
            Select a connector below, then tap a row to place. Tap placed connectors to edit.
          </p>
        </div>
      </main>

      {/* Inline port action bar (floats above footer when a port is selected) */}
      {selectedPort && !mobileSheet && (
        <div
          className="fixed inset-x-0 z-40 px-4 pb-2 pointer-events-none"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <div className="pointer-events-auto mx-auto max-w-lg rounded-xl border border-amber-500/30 bg-slate-900/95 shadow-2xl shadow-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-200 truncate">
                  {selectedPortConnector?.name ?? 'Connector'}
                </p>
                <p className="text-[10px] text-slate-500">
                  Row {selectedPort.row_index + 1} · {selectedPort.span_w}×{selectedPort.span_h}
                  {selectedPort.label ? ` · "${selectedPort.label}"` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setMobileSheet('port-edit')
                }}
                className="shrink-0 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 uppercase"
              >
                Edit
              </button>
              <button
                onClick={() => removeSelectedPort()}
                className="shrink-0 rounded-md border border-red-900/50 bg-red-950/60 px-3 py-1.5 text-[10px] font-bold text-red-400 uppercase"
              >
                Remove
              </button>
              <button
                onClick={() => setSelectedPortId(null)}
                className="shrink-0 text-slate-500 px-1"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile footer */}
      <footer
        className="bg-slate-900 border-t border-slate-800 flex items-center justify-around shrink-0 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => setMobileSheet('connectors')}
          className={`flex flex-col items-center gap-1 px-6 py-2 ${selectedConnectorId ? 'text-amber-400' : 'text-slate-400'}`}
        >
          <span className="text-lg">▦</span>
          <span className="text-[10px] font-bold uppercase">Connectors</span>
        </button>

        <button
          onClick={() => setMobileSheet('properties')}
          className="flex flex-col items-center gap-1 px-6 py-2 text-slate-400"
        >
          <span className="text-lg">⚙</span>
          <span className="text-[10px] font-bold uppercase">Settings</span>
        </button>
      </footer>

      {/* Bottom sheet drawer */}
      {mobileSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end overflow-hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSheet(null)} />
          <div
            className="relative bg-slate-900 rounded-t-2xl shadow-2xl flex flex-col"
            style={{
              maxHeight: '80svh',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-slate-700" />
            </div>

            {/* Sheet header */}
            <div className="px-4 pb-3 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-sm uppercase tracking-widest text-slate-400">
                {mobileSheet === 'connectors'
                  ? 'Add Connector'
                  : mobileSheet === 'port-edit'
                  ? 'Edit Connector'
                  : 'Panel Settings'}
              </h2>
              <button onClick={() => setMobileSheet(null)} className="p-2 text-slate-300 -mr-2">✕</button>
            </div>

            {/* Sheet content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* ── Connector Library ── */}
              {mobileSheet === 'connectors' && (
                <div className="space-y-4">
                  {grouped.map((group) => (
                    <section key={group.category}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: CATEGORY_DOT[group.category] ?? '#6b7280' }}
                        />
                        <h3 className="text-[9px] font-bold uppercase tracking-widest"
                          style={{ color: CATEGORY_DOT[group.category] ?? '#6b7280' }}>
                          {group.category}
                        </h3>
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map((connector) => {
                          const isSelected = selectedConnectorId === connector.id
                          const isAllowed = isMountingAllowed(connector.mounting, facing)
                          return (
                            <button
                              key={connector.id}
                              type="button"
                              onClick={() => {
                                setSelectedConnectorId(connector.id)
                                setSelectedPortId(null)
                                setMobileSheet(null)
                              }}
                              disabled={!isAllowed}
                              className={`w-full rounded-lg border px-3 py-2.5 text-left transition min-h-11 ${
                                isSelected
                                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                                  : isAllowed
                                  ? 'border-slate-700/50 bg-slate-800/40 text-slate-300 active:bg-slate-800'
                                  : 'border-slate-800 bg-slate-900/30 text-slate-600'
                              }`}
                            >
                              <p className="text-xs font-medium leading-tight">{connector.name}</p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {connector.grid_width}×{connector.grid_height} grid · {connector.mounting}
                                {!isAllowed ? <span className="text-red-500/70"> · {facing} not supported</span> : null}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {/* ── Port Edit ── */}
              {mobileSheet === 'port-edit' && selectedPort && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs font-medium text-slate-200">
                      {selectedPortConnector?.name ?? 'Unknown'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {selectedPort.span_w}×{selectedPort.span_h} grid · Row {selectedPort.row_index + 1}
                    </p>
                  </div>
                  <DarkInput
                    label="Label override"
                    value={selectedPort.label ?? ''}
                    onChange={updateSelectedPortLabel}
                    placeholder={selectedPortConnector?.name ?? 'Label'}
                  />
                  <PortColorPicker
                    value={selectedPort.color}
                    onChange={updateSelectedPortColor}
                    onReset={() => updateSelectedPortColor(null)}
                    resetClassName="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => { removeSelectedPort(); setMobileSheet(null) }}
                    className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2.5 text-xs font-semibold text-red-400 min-h-11"
                  >
                    Remove Connector
                  </button>
                </div>
              )}

              {/* ── Properties ── */}
              {mobileSheet === 'properties' && (
                <div className="space-y-5">
                  <DarkInput label="Name" value={name} onChange={(v) => { setName(v); setDirty(true) }} />
                  <DarkSelect
                    label="Drawing State"
                    value={drawingState}
                    onChange={(v) => { setDrawingState(v as DrawingState); setDirty(true) }}
                    options={DRAWING_STATE_OPTIONS}
                  />
                  <DarkSelect
                    label="Facing"
                    value={facing}
                    onChange={(v) => { setFacing(v as DeviceFacing); setDirty(true) }}
                    options={[
                      { value: 'front', label: 'Front' },
                      { value: 'rear', label: 'Rear' },
                    ]}
                  />
                  <label className="flex cursor-pointer items-center gap-3 min-h-11">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={hasLacingBar}
                        onChange={(e) => { setHasLacingBar(e.target.checked); setDirty(true) }}
                      />
                      <div className="h-5 w-9 rounded-full border border-slate-700 bg-slate-800 transition peer-checked:border-amber-500/60 peer-checked:bg-amber-500/20" />
                      <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-slate-500 transition peer-checked:translate-x-4 peer-checked:bg-amber-400" />
                    </div>
                    <span className="text-xs text-slate-300">Show lacing bar</span>
                  </label>
                  <div>
                    <DarkLabel>Notes</DarkLabel>
                    <textarea
                      className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/60 transition resize-none"
                      rows={3}
                      value={notes}
                      onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
                      placeholder="Optional notes…"
                    />
                  </div>

                  {/* Row capacities */}
                  <div className="border-t border-slate-800 pt-4 space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Row Usage</h3>
                    {rows.map((row) => {
                      const capacity = rowCapacityByIndex.get(row.row_index)
                      return (
                        <div key={row.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/30 p-2">
                          <span className="text-[10px] font-mono text-slate-500 w-6">U{row.row_index + 1}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500/60 transition-all"
                              style={{ width: `${capacity ? Math.round((capacity.occupied_holes / capacity.hole_count) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 w-12 text-right">
                            {capacity ? `${capacity.occupied_holes}/${capacity.hole_count}` : `${row.hole_count}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Print link */}
                  <button
                    onClick={() => navigate(`/rack-builder/editor/project/${projectId}/panels/${panel.id}/print`)}
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-slate-300 min-h-11"
                  >
                    Export PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
