import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useConnectors } from '@/features/rack-builder/hooks/useConnectors'
import {
  autoDistributeAllRows,
  isMountingAllowed,
  rowHasCapacity,
  summarizeRowCapacities,
} from '@/features/rack-builder/lib/panelGrid'
import { usePanelLayouts } from '@/features/rack-builder/hooks/usePanelLayouts'
import { DRAWING_STATE_OPTIONS } from '@/features/rack-builder/lib/drawingState'
import type { DeviceFacing, DrawingState, PanelLayoutPort, PanelLayoutRow } from '@/features/rack-builder/types'
import PanelLayoutCanvas from '@/features/rack-builder/components/panels/PanelLayoutCanvas'
import PanelLayoutMobileView from '@/features/rack-builder/components/panels/PanelLayoutMobileView'
import {
  CATEGORY_DOT,
  DarkInput,
  DarkLabel,
  DarkSelect,
  DraggableConnectorButton,
  normalizeRowsToAutoGrid,
  PortColorPicker,
  type DraftState,
} from '@/features/rack-builder/components/panels/PanelLayoutEditorPrimitives'

const DRAFT_STORAGE_PREFIX = 'panel-layout-draft'

// ─── Main Editor ─────────────────────────────────────────────────────────────

function PanelLayoutEditorInner({ isMobile, isPortrait, isTouchDevice }: { isMobile: boolean; isPortrait: boolean; isTouchDevice: boolean }) {
  const isMobileLike = isMobile || isTouchDevice
  const { projectId, panelLayoutId } = useParams<{ projectId: string; panelLayoutId: string }>()
  const navigate = useNavigate()
  const {
    panelLayouts,
    loading,
    savePanelLayout,
  } = usePanelLayouts(projectId)
  const { connectorById, grouped } = useConnectors()
  const panel = useMemo(
    () => panelLayouts.find((entry) => entry.id === panelLayoutId) ?? null,
    [panelLayoutId, panelLayouts],
  )

  // Mobile sheet state
  const [mobileSheet, setMobileSheet] = useState<'connectors' | 'properties' | 'port-edit' | null>(null)

  const [name, setName] = useState('')
  const [drawingState, setDrawingState] = useState<DrawingState>('preliminary')
  const [facing, setFacing] = useState<DeviceFacing>('front')
  const [hasLacingBar, setHasLacingBar] = useState(false)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<PanelLayoutRow[]>([])
  const [ports, setPorts] = useState<PanelLayoutPort[]>([])
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null)
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [mobileZoom, setMobileZoom] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const hydratedDraft = useRef(false)
  const prevPanelIdRef = useRef<string | null>(null)

  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${projectId ?? 'none'}:${panelLayoutId ?? 'none'}`

  useEffect(() => {
    if (!panel) return
    // Reset hydration flag when switching to a different panel
    if (prevPanelIdRef.current !== null && prevPanelIdRef.current !== panel.id) {
      hydratedDraft.current = false
      setDirty(false)
    }
    prevPanelIdRef.current = panel.id
    if (!hydratedDraft.current) {
      const draftRaw = localStorage.getItem(draftStorageKey)
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as DraftState
          setName(draft.name)
          setDrawingState(draft.drawingState ?? panel.drawing_state)
          setFacing(draft.facing)
          setHasLacingBar(draft.hasLacingBar)
          setNotes(draft.notes)
          setRows(
            normalizeRowsToAutoGrid(
              panel.id,
              panel.height_ru,
              draft.rows.map((row, index) => ({
                id: `draft-row-${index}`,
                panel_layout_id: panel.id,
                row_index: row.row_index,
                hole_count: row.hole_count,
                active_column_map: row.active_column_map,
                created_at: panel.created_at,
                updated_at: panel.updated_at,
              })),
              panel.created_at,
              panel.updated_at,
            ),
          )
          setPorts(
            draft.ports.map((port) => ({
              id: port.id,
              panel_layout_id: panel.id,
              connector_id: port.connector_id,
              row_index: port.row_index,
              hole_index: port.hole_index,
              span_w: port.span_w,
              span_h: port.span_h,
              label: port.label ?? null,
              color: port.color ?? null,
              created_at: panel.created_at,
              updated_at: panel.updated_at,
            })),
          )
          setDirty(true)
          hydratedDraft.current = true
          return
        } catch {
          localStorage.removeItem(draftStorageKey)
        }
      }
      hydratedDraft.current = true
    }

    if (!dirty) {
      setName(panel.name)
      setDrawingState(panel.drawing_state)
      setFacing(panel.facing)
      setHasLacingBar(panel.has_lacing_bar)
      setNotes(panel.notes ?? '')
      setRows(
        normalizeRowsToAutoGrid(
          panel.id,
          panel.height_ru,
          [...(panel.rows ?? [])].sort((a, b) => a.row_index - b.row_index),
          panel.created_at,
          panel.updated_at,
        ),
      )
      setPorts([...(panel.ports ?? [])])
    }
  }, [dirty, draftStorageKey, panel])

  useEffect(() => {
    if (!panel || !dirty) return
    const timeoutId = window.setTimeout(() => {
      const draft: DraftState = {
        name,
        drawingState,
        facing,
        hasLacingBar,
        notes,
        rows: rows.map((row) => ({
          row_index: row.row_index,
          hole_count: row.hole_count,
          active_column_map: row.active_column_map,
        })),
        ports: ports.map((port) => ({
          id: port.id,
          connector_id: port.connector_id,
          row_index: port.row_index,
          hole_index: port.hole_index,
          span_w: port.span_w,
          span_h: port.span_h,
          label: port.label,
          color: port.color,
        })),
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(draft))
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [dirty, draftStorageKey, drawingState, facing, hasLacingBar, name, notes, panel, ports, rows])

  const selectedConnector = selectedConnectorId ? connectorById.get(selectedConnectorId) ?? null : null
  const selectedPort = selectedPortId ? ports.find((port) => port.id === selectedPortId) ?? null : null
  const rowCapacities = useMemo(() => summarizeRowCapacities(rows, ports), [rows, ports])
  const rowCapacityByIndex = useMemo(
    () => new Map(rowCapacities.map((entry) => [entry.row_index, entry])),
    [rowCapacities],
  )

  /** Check if a row can accept a connector/port during drag hover. */
  const canDropInRow = (
    rowIndex: number,
    transferId: string,
    isPortMove: boolean,
  ): boolean => {
    if (!panel) return false

    if (isPortMove) {
      const movingPort = ports.find((port) => port.id === transferId)
      if (!movingPort) return false
      // Allow drop on same row (reorder) or on a row with capacity
      if (movingPort.row_index === rowIndex) return true
      return rowHasCapacity(rowIndex, movingPort.span_w, movingPort.span_h, rows, ports, movingPort.id)
    }

    const connector = connectorById.get(transferId)
    if (!connector) return false
    if (!isMountingAllowed(connector.mounting, facing)) return false
    return rowHasCapacity(rowIndex, connector.grid_width, connector.grid_height, rows, ports)
  }

  /** Place a new connector on a row and auto-distribute. */
  const placeConnector = (rowIndex: number, forcedConnectorId?: string) => {
    if (!panel) return
    const connector = forcedConnectorId
      ? connectorById.get(forcedConnectorId) ?? null
      : selectedConnector
    if (!connector) return
    if (forcedConnectorId) setSelectedConnectorId(forcedConnectorId)
    if (!isMountingAllowed(connector.mounting, facing)) {
      setError(`"${connector.name}" cannot be mounted on ${facing} panels.`)
      return
    }
    if (!rowHasCapacity(rowIndex, connector.grid_width, connector.grid_height, rows, ports)) {
      setError('No free space available for this connector footprint on the selected row.')
      return
    }

    const newPort: PanelLayoutPort = {
      id: `draft-port-${crypto.randomUUID()}`,
      panel_layout_id: panel.id,
      connector_id: connector.id,
      row_index: rowIndex,
      hole_index: 0, // placeholder — auto-distribute will set the real position
      span_w: connector.grid_width,
      span_h: connector.grid_height,
      label: null,
      color: null,
      created_at: panel.created_at,
      updated_at: panel.updated_at,
    }

    const newPorts = [...ports, newPort]
    const distributed = autoDistributeAllRows(newPorts, rows)
    setPorts(distributed)
    setSelectedPortId(newPort.id)
    setError(null)
    setDirty(true)
  }

  /** Move an already-placed port to a new row (or reorder within same row). */
  const movePort = (portId: string, rowIndex: number) => {
    if (!panel) return
    const existing = ports.find((p) => p.id === portId)
    if (!existing) return

    const connector = connectorById.get(existing.connector_id)
    if (connector && !isMountingAllowed(connector.mounting, facing)) {
      setError(`"${connector.name}" cannot be mounted on ${facing} panels.`)
      return
    }

    if (existing.row_index === rowIndex) {
      // Same row — no-op for now (order is maintained by auto-distribute)
      return
    }

    // Check capacity on target row
    if (!rowHasCapacity(rowIndex, existing.span_w, existing.span_h, rows, ports, existing.id)) {
      setError('No free space available at this row for the selected connector footprint.')
      return
    }

    const moved: PanelLayoutPort = { ...existing, row_index: rowIndex }
    const newPorts = ports.map((p) => (p.id === portId ? moved : p))
    const distributed = autoDistributeAllRows(newPorts, rows)
    setPorts(distributed)
    setSelectedPortId(portId)
    setError(null)
    setDirty(true)
  }

  /** Called by canvas on drop — distinguishes library drop vs. port move. */
  const handleRowDrop = (rowIndex: number, transferId: string, isPortMove: boolean) => {
    if (isPortMove) {
      movePort(transferId, rowIndex)
    } else {
      placeConnector(rowIndex, transferId)
    }
  }

  const updateSelectedPortLabel = (label: string) => {
    if (!selectedPort) return
    setPorts((current) => current.map((port) => (
      port.id === selectedPort.id
        ? { ...port, label: label || null }
        : port
    )))
    setDirty(true)
  }

  const updateSelectedPortColor = (color: string | null) => {
    if (!selectedPort) return
    setPorts((current) => current.map((port) => (
      port.id === selectedPort.id
        ? { ...port, color }
        : port
    )))
    setDirty(true)
  }

  const removeSelectedPort = () => {
    if (!selectedPort) return
    const remaining = ports.filter((port) => port.id !== selectedPort.id)
    const distributed = autoDistributeAllRows(remaining, rows)
    setPorts(distributed)
    setSelectedPortId(null)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!panel) return

    // Validate all placed ports are compatible with the current facing
    const invalidPorts = ports.filter((port) => {
      const connector = connectorById.get(port.connector_id)
      return connector && !isMountingAllowed(connector.mounting, facing)
    })
    if (invalidPorts.length > 0) {
      const names = invalidPorts
        .map((p) => connectorById.get(p.connector_id)?.name ?? p.connector_id)
        .join(', ')
      setError(`Cannot save: the following connectors are not allowed on ${facing} panels: ${names}. Remove or change facing first.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await savePanelLayout(
        panel.id,
        { name: name.trim(), drawing_state: drawingState, facing, has_lacing_bar: hasLacingBar, notes: notes.trim() || null },
        rows.map((row) => ({
          row_index: row.row_index,
          hole_count: row.hole_count,
          active_column_map: row.active_column_map,
        })),
        ports.map((port) => ({
          connector_id: port.connector_id,
          row_index: port.row_index,
          hole_index: port.hole_index,
          span_w: port.span_w,
          span_h: port.span_h,
          label: port.label ?? null,
          color: port.color ?? null,
        })),
      )
      localStorage.removeItem(draftStorageKey)
      setDirty(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save panel layout.')
    } finally {
      setSaving(false)
    }
  }

  if (isMobileLike && isPortrait) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950 text-slate-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="text-6xl" style={{ transform: 'rotate(90deg)' }}>📱</div>
        <div className="text-center px-8">
          <p className="text-lg font-bold text-slate-100 mb-2">Rotate your device</p>
          <p className="text-sm text-slate-400">
            The panel layout editor requires landscape orientation.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500" />
          Loading panel editor…
        </div>
      </div>
    )
  }

  if (!panel || !projectId) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-red-400">Panel layout not found.</p>
        <button
          className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
          onClick={() => navigate('/rack-builder/projects')}
        >
          Back to projects
        </button>
      </div>
    )
  }

  // save button state
  const saveLabel = saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'
  const saveActive = !saving && !!name.trim() && dirty

  // ─── Mobile Layout ──────────────────────────────────────────────────────────
  if (isMobileLike) {
    return (
      <PanelLayoutMobileView
        navigate={navigate}
        projectId={projectId}
        panel={panel}
        facing={facing}
        setFacing={setFacing}
        ports={ports}
        saveActive={saveActive}
        saving={saving}
        dirty={dirty}
        handleSave={handleSave}
        error={error}
        setError={setError}
        selectedConnectorId={selectedConnectorId}
        setSelectedConnectorId={setSelectedConnectorId}
        mobileZoom={mobileZoom}
        setMobileZoom={setMobileZoom}
        rows={rows}
        rowCapacityByIndex={rowCapacityByIndex}
        connectorById={connectorById}
        hasLacingBar={hasLacingBar}
        setHasLacingBar={setHasLacingBar}
        selectedPortId={selectedPortId}
        setSelectedPortId={setSelectedPortId}
        placeConnector={placeConnector}
        handleRowDrop={handleRowDrop}
        canDropInRow={canDropInRow}
        selectedPort={selectedPort}
        mobileSheet={mobileSheet}
        setMobileSheet={setMobileSheet}
        removeSelectedPort={removeSelectedPort}
        grouped={grouped}
        updateSelectedPortLabel={updateSelectedPortLabel}
        updateSelectedPortColor={updateSelectedPortColor}
        name={name}
        setName={setName}
        setDirty={setDirty}
        drawingState={drawingState}
        setDrawingState={setDrawingState}
        notes={notes}
        setNotes={setNotes}
      />
    )
  }

  // ─── Desktop Layout ──────────────────────────────────────────────────────────
  return (
    // Full workspace: theme-aware background, full-height layout
    <div className="flex h-full min-h-screen flex-col gap-0 bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-slate-100 -m-4 md:-m-6 md:text-[17px]">

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 px-8 py-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(`/rack-builder/editor/project/${projectId}/panels`)}
            className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-5 py-2.5 text-base font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Panels
          </button>
          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-slate-100 md:text-2xl">{panel.name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-500">{panel.height_ru}U • {rows.length} rows • {ports.length} connectors</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {error && (
            <p className="max-w-md truncate text-base text-red-400">{error}</p>
          )}
          <button
            onClick={() => navigate(`/rack-builder/editor/project/${projectId}/panels/${panel.id}/print`)}
            className="rounded-md border border-slate-700 bg-slate-800 px-5 py-2.5 text-base font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            Export PDF
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!saveActive}
            className={`rounded-md px-6 py-2.5 text-base font-semibold transition ${
              saveActive
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      {/* ── Three-column workspace ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: Connector Library */}
        <aside className="flex w-[22rem] shrink-0 flex-col border-r border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Connector Library</h2>
            <p className="mt-1 text-sm text-slate-600">Click to select, or drag onto a row</p>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {grouped.map((group) => (
              <section key={group.category}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: CATEGORY_DOT[group.category] ?? '#6b7280' }}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: CATEGORY_DOT[group.category] ?? '#6b7280' }}>
                    {group.category}
                  </h3>
                </div>
                <div className="space-y-1">
                  {group.items.map((connector) => {
                    const isSelected = selectedConnectorId === connector.id
                    const isAllowed = isMountingAllowed(connector.mounting, facing)
                    return (
                      <DraggableConnectorButton
                        key={connector.id}
                        connector={connector}
                        selected={isSelected}
                        allowed={isAllowed}
                        onSelect={() => setSelectedConnectorId(connector.id)}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </aside>

        {/* Center: Canvas workspace */}
        <main className="flex flex-1 flex-col items-center justify-start gap-8 overflow-auto px-3 py-8 md:px-4"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0a0f1a 70%)' }}>

          {selectedConnectorId && (
            <div className="flex items-center gap-3 rounded-full border border-amber-500/30 bg-amber-500/10 px-6 py-2.5 text-base text-amber-300">
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="7" />
              </svg>
              <strong>{connectorById.get(selectedConnectorId)?.name}</strong> selected — click a row or drag to place
              <button
                className="ml-2 text-amber-400/60 hover:text-amber-300 transition"
                onClick={() => setSelectedConnectorId(null)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="w-full max-w-none">
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
              onPortClick={setSelectedPortId}
              interactive
            />
          </div>

          <p className="max-w-xl text-center text-sm text-slate-500">
            Drop connectors onto a row and spacing adjusts automatically. Drag placed connectors between rows to reorder.
          </p>
        </main>

        {/* Right panel: Properties */}
        <aside className="flex w-[27rem] shrink-0 flex-col border-l border-slate-800 bg-slate-900/80 overflow-y-auto">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Panel Properties</h2>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {/* Core props */}
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

            <label className="flex cursor-pointer items-center gap-3">
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
              <span className="text-sm text-slate-300">Show lacing bar</span>
            </label>

            <div>
              <DarkLabel>Notes</DarkLabel>
              <textarea
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-base text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                rows={3}
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true) }}
                placeholder="Optional notes…"
              />
            </div>

            {/* Auto grid status */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Auto Spacing</h3>
              <p className="text-sm text-slate-500">
                Connectors are automatically spaced evenly within each row. Drop connectors onto a row to place them.
              </p>
              {rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                  <p className="mb-2 text-sm font-mono uppercase tracking-widest text-slate-500">U{row.row_index + 1}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {(() => {
                      const capacity = rowCapacityByIndex.get(row.row_index)
                      if (!capacity) return `${row.hole_count} slots`
                      return `${capacity.occupied_holes}/${capacity.hole_count} used · ${capacity.free_holes} free`
                    })()}
                  </p>
                </div>
              ))}
            </div>

            {/* Selected connector */}
            {selectedPort ? (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500/80">Selected Connector</h3>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                  <p className="text-base font-medium text-slate-200">
                    {connectorById.get(selectedPort.connector_id)?.name ?? 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedPort.span_w}×{selectedPort.span_h} grid · row {selectedPort.row_index + 1}
                  </p>
                  <DarkInput
                    label="Label override"
                    value={selectedPort.label ?? ''}
                    onChange={updateSelectedPortLabel}
                    placeholder={connectorById.get(selectedPort.connector_id)?.name ?? 'Label'}
                  />
                  <PortColorPicker
                    value={selectedPort.color}
                    onChange={updateSelectedPortColor}
                    onReset={() => updateSelectedPortColor(null)}
                  />
                  <button
                    type="button"
                    onClick={removeSelectedPort}
                    className="w-full rounded-md border border-red-900/50 bg-red-950/40 px-3 py-3 text-base font-semibold text-red-400 transition hover:bg-red-950/70 hover:text-red-300"
                  >
                    Remove Connector
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-800 pt-4">
                <p className="text-sm text-slate-600">Click a placed connector to edit its label or remove it.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── DndProvider wrapper ─────────────────────────────────────────────────────

export default function PanelLayoutEditorPage() {
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768)
  const [isTouchLikeDevice, setIsTouchLikeDevice] = useState<boolean>(
    () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
  )
  const [isPortrait, setIsPortrait] = useState<boolean>(
    () => window.matchMedia('(orientation: portrait)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)')
    const updateTouchLike = () => {
      setIsTouchLikeDevice(coarsePointerQuery.matches || navigator.maxTouchPoints > 0)
    }
    updateTouchLike()
    coarsePointerQuery.addEventListener('change', updateTouchLike)
    return () => coarsePointerQuery.removeEventListener('change', updateTouchLike)
  }, [])

  const dndBackend = isTouchLikeDevice ? TouchBackend : HTML5Backend
  const dndOptions = isTouchLikeDevice
    ? {
        enableMouseEvents: true,
        delayTouchStart: 120,
        touchSlop: 8,
        ignoreContextMenu: true,
      }
    : undefined

  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <PanelLayoutEditorInner isMobile={isMobile} isPortrait={isPortrait} isTouchDevice={isTouchLikeDevice} />
    </DndProvider>
  )
}
