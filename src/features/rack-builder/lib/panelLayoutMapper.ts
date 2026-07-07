import { normalizeActiveColumnMap, toHoleCount } from './panelGrid'
import type { PanelLayout, PanelLayoutPort, PanelLayoutRow } from '../types'

export interface PanelLayoutRowRecord {
  id: string
  panel_layout_id: string
  row_index: number
  hole_count: number
  active_column_map: unknown
  created_at: string
  updated_at: string
}

export interface PanelLayoutPortRecord {
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
}

export interface PanelLayoutRecord extends Omit<PanelLayout, 'rows' | 'ports' | 'height_ru'> {
  height_ru: number
  rows?: PanelLayoutRowRecord[]
  ports?: PanelLayoutPortRecord[]
}

export function mapPanelLayoutRow(row: PanelLayoutRowRecord): PanelLayoutRow {
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
}

export function mapPanelLayoutPort(record: PanelLayoutPortRecord): PanelLayoutPort {
  return {
    id: record.id,
    panel_layout_id: record.panel_layout_id,
    connector_id: record.connector_id,
    row_index: record.row_index,
    hole_index: record.hole_index,
    span_w: record.span_w,
    span_h: record.span_h,
    label: record.label,
    color: record.color ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

export function mapPanelLayout(record: PanelLayoutRecord): PanelLayout {
  return {
    id: record.id,
    project_id: record.project_id,
    name: record.name,
    drawing_state: record.drawing_state,
    revision_number: record.revision_number,
    height_ru: record.height_ru,
    depth_mm: Number(record.depth_mm ?? 80),
    facing: record.facing,
    has_lacing_bar: record.has_lacing_bar,
    notes: record.notes,
    weight_kg: Number(record.weight_kg ?? 0),
    created_at: record.created_at,
    updated_at: record.updated_at,
    rows: (record.rows ?? []).map(mapPanelLayoutRow).sort((a, b) => a.row_index - b.row_index),
    ports: (record.ports ?? []).map(mapPanelLayoutPort),
  }
}
