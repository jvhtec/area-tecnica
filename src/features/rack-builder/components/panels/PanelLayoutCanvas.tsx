import { useCallback, useEffect, useMemo, useRef, type LegacyRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { useHaptic } from '../../contexts/HapticContext'
import { buildRowCellGeometry, getActiveColumns, getPunchedAreaRatio } from '../../lib/panelGrid'
import type { ConnectorDefinition, DeviceFacing, PanelLayoutPort, PanelLayoutRow } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import {
  CONNECTOR_ITEM_TYPE,
  PLACED_PORT_TYPE,
  type ConnectorDragItem,
  type PlacedPortDragItem,
} from './panelDndTypes'

interface PanelLayoutCanvasProps {
  connectorById: Map<string, ConnectorDefinition>
  heightRu: number
  rows: PanelLayoutRow[]
  ports: PanelLayoutPort[]
  facing: DeviceFacing
  hasLacingBar?: boolean
  selectedPortId?: string | null
  onRowClick?: (rowIndex: number) => void
  onRowDrop?: (rowIndex: number, transferId: string, isPortMove: boolean) => void
  canDropInRow?: (rowIndex: number, transferId: string, isPortMove: boolean) => boolean
  onPortClick?: (portId: string) => void
  showGuides?: boolean
  interactive?: boolean
  showScaleMarker?: boolean
  className?: string
}

const PANEL_EAR_WIDTH_PCT = 6.5
const INNER_WIDTH_PCT = 100 - PANEL_EAR_WIDTH_PCT * 2

// ─── Shared port visual ─────────────────────────────────────────────────────

function PortVisual({ port, connectorById }: { port: PanelLayoutPort; connectorById: Map<string, ConnectorDefinition> }) {
  const connector = connectorById.get(port.connector_id)
  const label = port.label?.trim() || connector?.name || 'Connector'
  const iconUrl = getDeviceImageUrl(connector?.image_path ?? null, 'rack-builder-connector-images')

  return (
    <>
      <div className="pointer-events-none absolute -top-5 left-1/2 z-30 w-max max-w-[calc(100%+2rem)] -translate-x-1/2 rounded border border-slate-600/80 bg-black/80 px-2 py-0.5">
        <span className="block truncate text-[10px] font-semibold text-slate-100">{label}</span>
      </div>
      {iconUrl ? (
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <img
            src={iconUrl}
            alt={label}
            className="h-full w-full object-contain p-1"
            draggable={false}
            crossOrigin="anonymous"
          />
        </div>
      ) : null}
    </>
  )
}

function portStyle(leftPct: number, yPct: number, widthPct: number, heightPct: number, active: boolean, opacity = 1, color?: string | null): React.CSSProperties {
  const bg = color
    ? `linear-gradient(to bottom, ${color}dd, ${color}cc)`
    : 'linear-gradient(to bottom, rgba(15,23,42,0.92), rgba(2,6,23,0.96))'
  return {
    left: `${leftPct}%`,
    top: `${yPct}%`,
    width: `${widthPct}%`,
    height: `${Math.max(6, heightPct)}%`,
    opacity,
    borderColor: active ? '#fbbf24' : 'rgba(226,232,240,0.7)',
    boxShadow: active
      ? '0 0 0 2px rgba(251,191,36,0.45), 0 8px 14px rgba(0,0,0,0.55)'
      : '0 6px 12px rgba(0,0,0,0.55)',
    background: bg,
  }
}

// ─── DraggablePort (interactive, requires DndProvider) ──────────────────────

interface DraggablePortProps {
  connectorById: Map<string, ConnectorDefinition>
  port: PanelLayoutPort
  leftPct: number
  yPct: number
  widthPct: number
  heightPct: number
  active: boolean
  onPortClick?: (portId: string) => void
}

function DraggablePort({
  connectorById,
  port,
  leftPct,
  yPct,
  widthPct,
  heightPct,
  active,
  onPortClick,
}: DraggablePortProps) {
  const connector = connectorById.get(port.connector_id)
  const label = port.label?.trim() || connector?.name || 'Connector'
  const { trigger } = useHaptic()
  const wasDraggingRef = useRef(false)

  const [{ isDragging }, dragRef] = useDrag<PlacedPortDragItem, unknown, { isDragging: boolean }>({
    type: PLACED_PORT_TYPE,
    item: {
      type: PLACED_PORT_TYPE,
      portId: port.id,
      connectorId: port.connector_id,
      gridWidth: port.span_w,
      gridHeight: port.span_h,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  useEffect(() => {
    if (isDragging && !wasDraggingRef.current) trigger('nudge')
    wasDraggingRef.current = isDragging
  }, [isDragging, trigger])

  return (
    <button
      ref={dragRef as unknown as LegacyRef<HTMLButtonElement>}
      type="button"
      onClick={() => onPortClick?.(port.id)}
      className="absolute z-20 rounded-md border transition-all cursor-grab active:cursor-grabbing hover:brightness-110"
      style={{
        ...portStyle(leftPct, yPct, widthPct, heightPct, active, isDragging ? 0.4 : 1, port.color),
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      title={`${label} — drag to move`}
    >
      <PortVisual port={port} connectorById={connectorById} />
    </button>
  )
}

// ─── StaticPort (non-interactive, no DndProvider needed) ────────────────────

function StaticPort({
  connectorById,
  port,
  leftPct,
  yPct,
  widthPct,
  heightPct,
  active,
}: {
  connectorById: Map<string, ConnectorDefinition>
  port: PanelLayoutPort
  leftPct: number
  yPct: number
  widthPct: number
  heightPct: number
  active: boolean
}) {
  return (
    <div
      className="absolute z-20 rounded-md border"
      style={portStyle(leftPct, yPct, widthPct, heightPct, active, 1, port.color)}
    >
      <PortVisual port={port} connectorById={connectorById} />
    </div>
  )
}

// ─── Shared row visual ──────────────────────────────────────────────────────

interface RowVisualProps {
  rowIndex: number
  rowHeightPct: number
  idStripRatio: number
  punchedAreaRatio: number
  punchedLeftPct: number
  holeCount: number
  showGuides: boolean
}

function RowVisual({
  rowIndex,
  rowHeightPct,
  idStripRatio,
  punchedAreaRatio,
  punchedLeftPct,
  holeCount,
  showGuides,
}: RowVisualProps) {
  const idStripHeightPct = rowHeightPct * idStripRatio

  return (
    <>
      {/* ID strip */}
      <div
        className="absolute inset-x-0 top-0 flex items-center px-2"
        style={{
          height: `${idStripHeightPct}%`,
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-[7px] font-mono tracking-[0.2em] uppercase text-white/25">
          U{rowIndex + 1}
        </span>
        <span className="ml-2 text-[7px] font-mono text-white/20">{holeCount} holes</span>
      </div>

      {/* Punched area outline */}
      <div
        className="pointer-events-none absolute bottom-0 top-[23%] border border-dashed border-white/10 bg-white/[0.015]"
        style={{
          left: `${punchedLeftPct}%`,
          width: `${punchedAreaRatio * 100}%`,
        }}
      />

      {/* Grid guides */}
      {showGuides && Array.from({ length: 16 }).map((_, col) => (
        <span
          key={`guide-${col}`}
          className="absolute inset-y-0 border-r"
          style={{
            left: `${(col / 16) * 100}%`,
            borderColor: 'rgba(255,255,255,0.03)',
          }}
        />
      ))}
    </>
  )
}

// ─── DroppableRow (interactive, requires DndProvider) ────────────────────────

interface DroppableRowProps extends RowVisualProps {
  interactive: boolean
  onRowClick?: (rowIndex: number) => void
  onRowDrop?: (rowIndex: number, transferId: string, isPortMove: boolean) => void
  canDropInRow?: (rowIndex: number, transferId: string, isPortMove: boolean) => boolean
}

function DroppableRow({
  rowIndex,
  rowHeightPct,
  idStripRatio,
  punchedAreaRatio,
  punchedLeftPct,
  holeCount,
  showGuides,
  interactive,
  onRowClick,
  onRowDrop,
  canDropInRow,
}: DroppableRowProps) {
  const rowTopPct = rowIndex * rowHeightPct
  const { trigger } = useHaptic()
  const prevDropStateRef = useRef<'none' | 'valid' | 'invalid'>('none')

  const canDropFn = useCallback(
    (item: ConnectorDragItem | PlacedPortDragItem) => {
      if (!interactive || !canDropInRow) return false
      const isPortMove = item.type === PLACED_PORT_TYPE
      const transferId = isPortMove
        ? (item as PlacedPortDragItem).portId
        : (item as ConnectorDragItem).connectorId
      return canDropInRow(rowIndex, transferId, isPortMove)
    },
    [canDropInRow, interactive, rowIndex],
  )

  const dropFn = useCallback(
    (item: ConnectorDragItem | PlacedPortDragItem) => {
      if (!interactive || !onRowDrop) return
      trigger('success')
      const isPortMove = item.type === PLACED_PORT_TYPE
      const transferId = isPortMove
        ? (item as PlacedPortDragItem).portId
        : (item as ConnectorDragItem).connectorId
      onRowDrop(rowIndex, transferId, isPortMove)
    },
    [interactive, onRowDrop, rowIndex, trigger],
  )

  const [{ isOver, canDrop }, dropRef] = useDrop<
    ConnectorDragItem | PlacedPortDragItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: [CONNECTOR_ITEM_TYPE, PLACED_PORT_TYPE],
    canDrop: canDropFn,
    drop: dropFn,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })

  useEffect(() => {
    const newState = !isOver ? 'none' : canDrop ? 'valid' : 'invalid'
    if (newState !== prevDropStateRef.current) {
      if (newState === 'valid') trigger('nudge')
      else if (newState === 'invalid') trigger('error')
    }
    prevDropStateRef.current = newState
  }, [isOver, canDrop, trigger])

  const validDrop = isOver && canDrop
  const invalidDrop = isOver && !canDrop

  return (
    <div
      className="absolute inset-x-0"
      style={{
        top: `${rowTopPct}%`,
        height: `${rowHeightPct}%`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <RowVisual
        rowIndex={rowIndex}
        rowHeightPct={rowHeightPct}
        idStripRatio={idStripRatio}
        punchedAreaRatio={punchedAreaRatio}
        punchedLeftPct={punchedLeftPct}
        holeCount={holeCount}
        showGuides={showGuides}
      />

      {/* Drop zone (connector field area) */}
      <div
        ref={dropRef as unknown as React.LegacyRef<HTMLDivElement>}
        className="absolute inset-x-0 rounded-sm transition cursor-pointer"
        role={interactive && onRowClick ? 'button' : undefined}
        tabIndex={interactive && onRowClick ? 0 : undefined}
        aria-disabled={invalidDrop}
        onClick={() => {
          if (!interactive || !onRowClick) return
          onRowClick(rowIndex)
        }}
        onKeyDown={(e) => {
          if (!interactive || !onRowClick) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onRowClick(rowIndex)
          }
        }}
        style={{
          top: '0%',
          height: '100%',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: validDrop
            ? 'rgba(34,197,94,0.8)'
            : invalidDrop
            ? 'rgba(248,113,113,0.85)'
            : 'transparent',
          background: validDrop
            ? 'linear-gradient(to bottom, rgba(34,197,94,0.18), rgba(21,128,61,0.10))'
            : invalidDrop
            ? 'linear-gradient(to bottom, rgba(248,113,113,0.18), rgba(127,29,29,0.10))'
            : 'transparent',
          boxShadow: validDrop
            ? 'inset 0 0 0 1px rgba(74,222,128,0.4)'
            : invalidDrop
            ? 'inset 0 0 0 1px rgba(248,113,113,0.5)'
            : 'none',
        }}
        title={
          invalidDrop
            ? 'Cannot place connector on this row'
            : `Row ${rowIndex + 1} — drop connectors here`
        }
      />
    </div>
  )
}

// ─── StaticRow (non-interactive, no DndProvider needed) ─────────────────────

function StaticRow({
  rowIndex,
  rowHeightPct,
  idStripRatio,
  punchedAreaRatio,
  punchedLeftPct,
  holeCount,
  showGuides,
}: RowVisualProps) {
  const rowTopPct = rowIndex * rowHeightPct

  return (
    <div
      className="absolute inset-x-0"
      style={{
        top: `${rowTopPct}%`,
        height: `${rowHeightPct}%`,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <RowVisual
        rowIndex={rowIndex}
        rowHeightPct={rowHeightPct}
        idStripRatio={idStripRatio}
        punchedAreaRatio={punchedAreaRatio}
        punchedLeftPct={punchedLeftPct}
        holeCount={holeCount}
        showGuides={showGuides}
      />
    </div>
  )
}

// ─── Main Canvas ────────────────────────────────────────────────────────────

export default function PanelLayoutCanvas({
  connectorById,
  heightRu,
  rows,
  ports,
  facing,
  hasLacingBar = false,
  selectedPortId = null,
  onRowClick,
  onRowDrop,
  canDropInRow,
  onPortClick,
  showGuides = true,
  interactive = true,
  showScaleMarker = true,
  className = '',
}: PanelLayoutCanvasProps) {
  const safeHeightRu = Math.max(1, heightRu)
  const rowHeightPct = 100 / safeHeightRu
  const idStripRatio = 0.23
  const connectorTopOffsetPct = 1.2
  const connectorBottomOffsetPct = 1.8
  const orderedRows = [...rows].sort((a, b) => a.row_index - b.row_index)
  const rowByIndex = useMemo(() => new Map(orderedRows.map((row) => [row.row_index, row])), [orderedRows])

  const rowCellMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof buildRowCellGeometry>>()
    for (let rowIndex = 0; rowIndex < safeHeightRu; rowIndex += 1) {
      const row = rowByIndex.get(rowIndex)
      const holeCount = row?.hole_count ?? 16
      const activeColumns = row?.active_column_map.length
        ? row.active_column_map
        : getActiveColumns(holeCount)
      map.set(rowIndex, buildRowCellGeometry(holeCount, activeColumns, facing))
    }
    return map
  }, [facing, rowByIndex, safeHeightRu])

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/40 p-3 shadow-2xl ${className}`.trim()}>
      {showScaleMarker && (
        <div className="mb-3 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <span className="h-px w-14 bg-slate-700" />
          19 in
          <span className="h-px w-14 bg-slate-700" />
        </div>
      )}

      <div className="relative mx-auto w-full max-h-full" style={{ aspectRatio: `${19 / (1.75 * safeHeightRu)}` }}>
        {/* Left ear */}
        <div className="absolute inset-y-0 left-0 z-10" style={{ width: `${PANEL_EAR_WIDTH_PCT}%` }}>
          <div className="absolute inset-0 rounded-l-lg border-y border-l border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-800" />
          {Array.from({ length: safeHeightRu }).map((_, r) => (
            <div key={`left-slots-${r}`} className="absolute inset-x-0" style={{ top: `${r * rowHeightPct}%`, height: `${rowHeightPct}%` }}>
              <div className="absolute left-[25%] top-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
              <div className="absolute left-[25%] bottom-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
            </div>
          ))}
        </div>

        {/* Right ear */}
        <div className="absolute inset-y-0 right-0 z-10" style={{ width: `${PANEL_EAR_WIDTH_PCT}%` }}>
          <div className="absolute inset-0 rounded-r-lg border-y border-r border-slate-700 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-800" />
          {Array.from({ length: safeHeightRu }).map((_, r) => (
            <div key={`right-slots-${r}`} className="absolute inset-x-0" style={{ top: `${r * rowHeightPct}%`, height: `${rowHeightPct}%` }}>
              <div className="absolute right-[25%] top-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
              <div className="absolute right-[25%] bottom-[12%] h-[15%] w-[50%] rounded-full border border-black bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]" />
            </div>
          ))}
        </div>

        {/* Inner panel area */}
        <div
          className="absolute inset-y-0 overflow-hidden border-y border-slate-700 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950"
          style={{
            left: `${PANEL_EAR_WIDTH_PCT}%`,
            width: `${INNER_WIDTH_PCT}%`,
          }}
        >
          {/* Rows — use DroppableRow when interactive (DndProvider present), StaticRow otherwise */}
          {Array.from({ length: safeHeightRu }).map((_, rowIndex) => {
            const row = rowByIndex.get(rowIndex)
            const punchedAreaRatio = getPunchedAreaRatio(row?.hole_count ?? 16)
            const punchedLeftPct = ((1 - punchedAreaRatio) / 2) * 100
            const rowProps: RowVisualProps = {
              rowIndex,
              rowHeightPct,
              idStripRatio,
              punchedAreaRatio,
              punchedLeftPct,
              holeCount: row?.hole_count ?? 16,
              showGuides,
            }

            if (interactive) {
              return (
                <DroppableRow
                  key={`row-${rowIndex}`}
                  {...rowProps}
                  interactive={interactive}
                  onRowClick={onRowClick}
                  onRowDrop={onRowDrop}
                  canDropInRow={canDropInRow}
                />
              )
            }

            return <StaticRow key={`row-${rowIndex}`} {...rowProps} />
          })}

          {/* Lacing bar */}
          {hasLacingBar && (
            <div
              className="absolute inset-x-0 border-y border-slate-500 bg-slate-700/50"
              style={{
                top: `${Math.max(5, 100 - rowHeightPct * 0.35)}%`,
                height: '4px',
              }}
            />
          )}

          {/* Placed ports — use DraggablePort when interactive, StaticPort otherwise */}
          {ports.map((port) => {
            const rowCells = rowCellMap.get(port.row_index) ?? []
            const startCell = rowCells.find((cell) => cell.holeIndex === port.hole_index)
            const endCell = rowCells.find((cell) => cell.holeIndex === (port.hole_index + port.span_w - 1))
            if (!startCell || !endCell) return null

            const leftPct = Math.min(startCell.leftPct, endCell.leftPct)
            const rightPct = Math.max(startCell.leftPct + startCell.widthPct, endCell.leftPct + endCell.widthPct)
            const widthPct = rightPct - leftPct
            const yPct = port.row_index * rowHeightPct + rowHeightPct * idStripRatio + connectorTopOffsetPct
            const heightPct = port.span_h * rowHeightPct - rowHeightPct * idStripRatio - connectorBottomOffsetPct
            const active = selectedPortId === port.id

            if (interactive) {
              return (
                <DraggablePort
                  key={port.id}
                  connectorById={connectorById}
                  port={port}
                  leftPct={leftPct}
                  yPct={yPct}
                  widthPct={widthPct}
                  heightPct={heightPct}
                  active={active}
                  onPortClick={onPortClick}
                />
              )
            }

            return (
              <StaticPort
                key={port.id}
                connectorById={connectorById}
                port={port}
                leftPct={leftPct}
                yPct={yPct}
                widthPct={widthPct}
                heightPct={heightPct}
                active={active}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
