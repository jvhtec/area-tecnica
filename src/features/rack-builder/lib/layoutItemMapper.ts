import { connectorWeightKg } from './panelGrid'
import { buildPanelThumbnailDataUrl } from './panelThumbnail'
import type { ConnectorDefinition, Device, DeviceFacing, LayoutItemWithDevice, PanelLayout } from '../types'

export interface LayoutItemRow {
  id: string
  layout_id: string
  device_id: string | null
  panel_layout_id: string | null
  start_u: number
  facing: string
  preferred_lane?: number | null
  preferred_sub_lane?: number | null
  force_full_width?: boolean | null
  rack_ear_offset_mm?: number | null
  custom_name?: string | null
  notes: string | null
  device: Record<string, unknown> | null
  panel_layout?: {
    id: string
    project_id: string
    name: string
    drawing_state: 'preliminary' | 'rev' | 'as_built'
    revision_number: number
    height_ru: number
    depth_mm: number
    facing: DeviceFacing
    has_lacing_bar: boolean
    notes: string | null
    weight_kg: number
    created_at: string
    updated_at: string
    rows?: Array<{
      id: string
      panel_layout_id: string
      row_index: number
      hole_count: number
      active_column_map: unknown
      created_at: string
      updated_at: string
    }>
    ports?: Array<{
      id: string
      panel_layout_id: string
      connector_id: string
      row_index: number
      hole_index: number
      span_w: number
      span_h: number
      label: string | null
      color: string | null
      created_at: string
      updated_at: string
    }>
  } | null
}

export const LAYOUT_ITEM_SELECT =
  '*, device:rack_builder_devices(*), panel_layout:rack_builder_panel_layouts(*, rows:rack_builder_panel_layout_rows(*), ports:rack_builder_panel_layout_ports(*))'

function toHoleCount(value: number): 4 | 6 | 8 | 12 | 16 {
  const rounded = Math.round(value)
  if (rounded === 4 || rounded === 6 || rounded === 8 || rounded === 12 || rounded === 16) return rounded
  return 16
}

function normalizeActiveColumnMap(value: unknown, holeCount: number): number[] {
  if (!Array.isArray(value)) return []
  const numeric = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry < 16)
  if (numeric.length !== holeCount) return []
  const unique = new Set(numeric)
  if (unique.size !== numeric.length) return []
  return numeric
}

function mapPanelLayout(raw: NonNullable<LayoutItemRow['panel_layout']>): PanelLayout {
  const rows = (raw.rows ?? []).map((row) => {
    const holeCount = toHoleCount(row.hole_count)
    return {
      id: row.id,
      panel_layout_id: row.panel_layout_id,
      row_index: row.row_index,
      hole_count: holeCount,
      active_column_map: normalizeActiveColumnMap(row.active_column_map, holeCount),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })
  const ports = (raw.ports ?? []).map((port) => ({
    id: port.id,
    panel_layout_id: port.panel_layout_id,
    connector_id: port.connector_id,
    row_index: port.row_index,
    hole_index: port.hole_index,
    span_w: port.span_w,
    span_h: port.span_h,
    label: port.label,
    color: port.color ?? null,
    created_at: port.created_at,
    updated_at: port.updated_at,
  }))
  return {
    id: raw.id,
    project_id: raw.project_id,
    name: raw.name,
    drawing_state: raw.drawing_state,
    revision_number: raw.revision_number,
    height_ru: raw.height_ru,
    depth_mm: Number(raw.depth_mm ?? 80),
    facing: raw.facing,
    has_lacing_bar: raw.has_lacing_bar,
    notes: raw.notes,
    weight_kg: Number(raw.weight_kg ?? 0),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    rows,
    ports,
  }
}

function buildVirtualPanelDevice(panelLayout: PanelLayout, connectorById: Map<string, ConnectorDefinition>): Device {
  const connectorMass = connectorWeightKg(panelLayout.ports ?? [], connectorById)
  return {
    id: `panel:${panelLayout.id}`,
    brand: 'Panel Layout',
    model: panelLayout.name,
    rack_units: panelLayout.height_ru,
    depth_mm: panelLayout.depth_mm,
    weight_kg: Number(panelLayout.weight_kg ?? 0) + connectorMass,
    power_w: 0,
    is_half_rack: false,
    category_id: '__panel_layout__',
    fav: false,
    invert_image_in_dark_mode: false,
    front_image_path: buildPanelThumbnailDataUrl(panelLayout, 'front', connectorById),
    rear_image_path: buildPanelThumbnailDataUrl(panelLayout, 'rear', connectorById),
    created_at: panelLayout.created_at,
    updated_at: panelLayout.updated_at,
    category: null,
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function normalizeDevice(rawDevice: Record<string, unknown> | null): LayoutItemWithDevice['device'] {
  const source = rawDevice ?? {}
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
  const asNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null)
  return {
    id: asString(source.id),
    brand: asString(source.brand),
    model: asString(source.model),
    rack_units: toNumber(source.rack_units, 1),
    depth_mm: toNumber(source.depth_mm, 0),
    weight_kg: toNumber(source.weight_kg, 0),
    power_w: toNumber(source.power_w, 0),
    is_half_rack: source.is_half_rack === true,
    category_id: asString(source.category_id),
    fav: source.fav === true,
    invert_image_in_dark_mode: source.invert_image_in_dark_mode === true,
    category: (source.category as LayoutItemWithDevice['device']['category']) ?? null,
    front_image_path: asNullableString(source.front_image_path),
    rear_image_path: asNullableString(source.rear_image_path),
    created_at: asString(source.created_at),
    updated_at: asString(source.updated_at),
  }
}

export function mapLayoutItemRows(rows: LayoutItemRow[], connectorById: Map<string, ConnectorDefinition>): LayoutItemWithDevice[] {
  return rows.map((row) => {
    const panelLayout = row.panel_layout ? mapPanelLayout(row.panel_layout) : null
    const rawDevice = row.device as Record<string, unknown> | null
    const device = panelLayout
      ? buildVirtualPanelDevice(panelLayout, connectorById)
      : normalizeDevice(rawDevice)
    return {
      id: row.id,
      layout_id: row.layout_id,
      device_id: row.device_id,
      panel_layout_id: row.panel_layout_id,
      asset_kind: panelLayout ? 'panel_layout' : 'device',
      start_u: row.start_u,
      facing: row.facing as DeviceFacing,
      preferred_lane: row.preferred_lane === 0 || row.preferred_lane === 1 ? row.preferred_lane : null,
      preferred_sub_lane: row.preferred_sub_lane === 0 || row.preferred_sub_lane === 1 ? row.preferred_sub_lane : null,
      force_full_width: row.force_full_width === true,
      rack_ear_offset_mm: toNumber(row.rack_ear_offset_mm, 0),
      custom_name: row.custom_name ?? null,
      notes: row.notes,
      device,
      panel_layout: panelLayout,
    }
  })
}
