import type { LegacyRef, ReactNode } from 'react'
import { useDrag } from 'react-dnd'
import { getActiveColumns } from '@/features/rack-builder/lib/panelGrid'
import type { ConnectorDefinition, DrawingState, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '@/features/rack-builder/types'
import { CONNECTOR_ITEM_TYPE, type ConnectorDragItem } from './panelDndTypes'

export const AUTO_HOLE_COUNT = 16
export const DEFAULT_PORT_COLOR = '#0f172a'

export interface DraftState {
  name: string
  drawingState: DrawingState
  facing: DeviceFacing
  hasLacingBar: boolean
  notes: string
  rows: Array<Pick<PanelLayoutRow, 'row_index' | 'hole_count' | 'active_column_map'>>
  ports: Array<Pick<PanelLayoutPort, 'id' | 'connector_id' | 'row_index' | 'hole_index' | 'span_w' | 'span_h' | 'label' | 'color'>>
}

export function normalizeRowsToAutoGrid(
  panelId: string,
  heightRu: number,
  rows: Array<Partial<PanelLayoutRow>>,
  createdAt: string,
  updatedAt: string,
): PanelLayoutRow[] {
  const byIndex = new Map<number, Partial<PanelLayoutRow>>()
  for (const row of rows) {
    if (typeof row.row_index === 'number') byIndex.set(row.row_index, row)
  }

  return Array.from({ length: Math.max(1, heightRu) }, (_, rowIndex) => {
    const existing = byIndex.get(rowIndex)
    const holeCount = (existing?.hole_count ?? AUTO_HOLE_COUNT) as 4 | 6 | 8 | 12 | 16
    return {
      id: existing?.id ?? `auto-row-${rowIndex}`,
      panel_layout_id: panelId,
      row_index: rowIndex,
      hole_count: holeCount,
      active_column_map: existing?.active_column_map?.length ? existing.active_column_map : getActiveColumns(holeCount),
      created_at: existing?.created_at ?? createdAt,
      updated_at: existing?.updated_at ?? updatedAt,
    }
  })
}

// ─── Dark workspace form primitives ──────────────────────────────────────────

export function DarkLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-400 md:text-sm">
      {children}
    </span>
  )
}

export function DarkInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <DarkLabel>{label}</DarkLabel>
      <input
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60 md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export function DarkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <DarkLabel>{label}</DarkLabel>
      <select
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-100 transition focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/60 md:text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

export function PortColorPicker({
  value,
  onChange,
  onReset,
  resetClassName,
}: {
  value: string | null
  onChange: (color: string) => void
  onReset: () => void
  resetClassName?: string
}) {
  return (
    <div>
      <DarkLabel>Port color</DarkLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? DEFAULT_PORT_COLOR}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-transparent"
        />
        {value && (
          <button
            type="button"
            onClick={onReset}
            className={resetClassName ?? 'rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400 hover:text-slate-200'}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Category accent colors (chip only, not full bg) ─────────────────────────
export const CATEGORY_DOT: Record<string, string> = {
  audio: '#f59e0b',
  data: '#06b6d4',
  power: '#3b82f6',
  multipin: '#a78bfa',
  other: '#6b7280',
}

// ─── DraggableConnectorButton ────────────────────────────────────────────────

export function DraggableConnectorButton({
  connector,
  selected,
  allowed,
  onSelect,
}: {
  connector: ConnectorDefinition
  selected: boolean
  allowed: boolean
  onSelect: () => void
}) {
  const [{ isDragging }, dragRef] = useDrag<ConnectorDragItem, unknown, { isDragging: boolean }>({
    type: CONNECTOR_ITEM_TYPE,
    item: {
      type: CONNECTOR_ITEM_TYPE,
      connectorId: connector.id,
      gridWidth: connector.grid_width,
      gridHeight: connector.grid_height,
    },
    canDrag: allowed,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  return (
    <button
      ref={dragRef as unknown as LegacyRef<HTMLButtonElement>}
      type="button"
      onClick={onSelect}
      className={`w-full select-none rounded-lg border px-5 py-3.5 text-left transition ${
        selected
          ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
          : allowed
          ? 'border-slate-700/50 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
          : 'border-slate-800 bg-slate-900/30 text-slate-600'
      }`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <p className="text-base font-semibold leading-tight">{connector.name}</p>
      <p className="mt-1.5 text-sm text-slate-500">
        {connector.grid_width}×{connector.grid_height} grid
        {!allowed ? <span className="text-red-500/70"> · not allowed</span> : null}
      </p>
    </button>
  )
}
