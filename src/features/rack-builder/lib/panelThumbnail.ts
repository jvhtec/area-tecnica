import type { ConnectorDefinition, DeviceFacing, PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'
import { getActiveColumns } from './panelGrid'
import { getDeviceImageUrl } from '../hooks/useDevices'

const TOTAL_COLUMNS = 16
const MAX_COLUMN_INDEX = TOTAL_COLUMNS - 1

const CATEGORY_COLORS: Record<string, string> = {
  power: '#2563eb',
  data: '#0891b2',
  multipin: '#7c3aed',
  audio: '#374151',
  other: '#374151',
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getPortGeometry(
  port: PanelLayoutPort,
  row: PanelLayoutRow,
  cellWidth: number,
  rowHeight: number,
  facing: DeviceFacing,
) {
  const activeMap = row.active_column_map.length > 0 ? row.active_column_map : getActiveColumns(row.hole_count)
  const startIndex = Math.max(0, Math.min(activeMap.length - 1, port.hole_index))
  const endIndex = Math.max(0, Math.min(activeMap.length - 1, port.hole_index + port.span_w - 1))
  const rawStartCol = activeMap[startIndex] ?? 0
  const rawEndCol = activeMap[endIndex] ?? rawStartCol
  const startCol = Math.min(rawStartCol, rawEndCol)
  const endCol = Math.max(rawStartCol, rawEndCol)
  const width = (endCol - startCol + 1) * cellWidth
  const mirroredStart = facing === 'rear' ? MAX_COLUMN_INDEX - endCol : startCol
  const x = mirroredStart * cellWidth
  const y = port.row_index * rowHeight
  const height = port.span_h * rowHeight
  return { x, y, width, height }
}

export function buildPanelThumbnailSvg(
  panel: PanelLayout,
  facing: DeviceFacing,
  connectorById: Map<string, ConnectorDefinition>,
): string {
  const rows = [...(panel.rows ?? [])].sort((a, b) => a.row_index - b.row_index)
  const ports = [...(panel.ports ?? [])]
  const width = 960
  const rowHeight = 88
  const stripHeight = 20
  const innerPad = 24
  const innerWidth = width - innerPad * 2
  const cellWidth = innerWidth / 16
  const bodyHeight = Math.max(1, panel.height_ru) * rowHeight
  const height = bodyHeight + 36
  const bodyTop = 18

  const rowStripes = Array.from({ length: panel.height_ru }, (_, rowIndex) => {
    const y = bodyTop + rowIndex * rowHeight
    return `<g>
      <rect x="${innerPad}" y="${y}" width="${innerWidth}" height="${rowHeight}" fill="${rowIndex % 2 === 0 ? '#0f172a' : '#111827'}" />
      <rect x="${innerPad}" y="${y}" width="${innerWidth}" height="${stripHeight}" fill="#1f2937" />
    </g>`
  }).join('')

  const lacingBar = panel.has_lacing_bar
    ? `<rect x="${innerPad}" y="${bodyTop + bodyHeight - 10}" width="${innerWidth}" height="6" fill="#334155" />`
    : ''

  const renderedPorts = ports.map((port) => {
    const row = rows.find((entry) => entry.row_index === port.row_index)
    if (!row) return ''
    const { x, y, width: portWidth, height: portHeight } = getPortGeometry(port, row, cellWidth, rowHeight, facing)
    const connector = connectorById.get(port.connector_id)
    const fill = port.color ?? CATEGORY_COLORS[connector?.category ?? 'other'] ?? '#374151'
    const label = port.label?.trim() || connector?.name || `Unknown (${port.connector_id})`
    const imageUrl = getDeviceImageUrl(connector?.image_path ?? null, 'rack-builder-connector-images')
    const bodyX = innerPad + x + 2
    const bodyY = bodyTop + y + stripHeight + 3
    const bodyWidth = Math.max(10, portWidth - 4)
    const bodyHeight = Math.max(10, portHeight - stripHeight - 6)
    const labelWidth = Math.max(20, bodyWidth)
    const labelHeight = 8
    const labelY = bodyY - labelHeight - 2
    const imageMarkup = imageUrl
      ? `<image href="${escapeXml(imageUrl)}" x="${bodyX + 2}" y="${bodyY + 2}" width="${Math.max(6, bodyWidth - 4)}" height="${Math.max(6, bodyHeight - 4)}" preserveAspectRatio="xMidYMid meet" />`
      : ''
    return `<g>
      <rect x="${bodyX}" y="${bodyY}" width="${bodyWidth}" height="${bodyHeight}" rx="4" fill="${fill}" stroke="#e2e8f0" stroke-width="1.5" />
      <rect x="${bodyX}" y="${labelY}" width="${labelWidth}" height="${labelHeight}" rx="3" fill="rgba(2,6,23,0.75)" />
      <text x="${bodyX + labelWidth / 2}" y="${labelY + labelHeight - 2}" text-anchor="middle" font-size="6.5" font-family="Inter, Arial, sans-serif" fill="#e2e8f0">${escapeXml(label)}</text>
      ${imageMarkup}
    </g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#020617"/>
    <rect x="14" y="${bodyTop}" width="${width - 28}" height="${bodyHeight}" rx="6" fill="#0b1220" stroke="#1e293b" stroke-width="2"/>
    ${rowStripes}
    ${lacingBar}
    ${renderedPorts}
    <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="10" font-family="Inter, Arial, sans-serif" fill="#94a3b8">
      ${escapeXml(panel.name)} • ${panel.height_ru}U • ${facing === 'front' ? 'Front' : 'Rear'}
    </text>
  </svg>`
}

export function buildPanelThumbnailDataUrl(
  panel: PanelLayout,
  facing: DeviceFacing,
  connectorById: Map<string, ConnectorDefinition>,
): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(buildPanelThumbnailSvg(panel, facing, connectorById))}`
}
