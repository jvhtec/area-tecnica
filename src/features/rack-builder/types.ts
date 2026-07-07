export type RackWidth = 'single' | 'dual'
export type DeviceFacing = 'front' | 'rear'
export type DrawingState = 'preliminary' | 'rev' | 'as_built'
export type ConnectorMounting = 'front' | 'rear' | 'both'
export type ConnectorCategory = 'audio' | 'data' | 'power' | 'multipin' | 'other'

export interface Rack {
  id: string
  name: string
  rack_units: number
  depth_mm: number
  width: RackWidth
  created_at: string
  updated_at: string
}

export interface DeviceCategory {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Device {
  id: string
  brand: string
  model: string
  rack_units: number
  depth_mm: number
  weight_kg: number
  power_w: number
  is_half_rack: boolean
  category_id: string
  fav: boolean
  invert_image_in_dark_mode: boolean
  category?: DeviceCategory | null
  front_image_path: string | null
  rear_image_path: string | null
  created_at: string
  updated_at: string
}

export interface ConnectorDefinition {
  id: string
  name: string
  category: ConnectorCategory
  image_path: string
  is_d_size: boolean
  grid_width: number
  grid_height: number
  mounting: ConnectorMounting
  notes: string
  weight_kg: number
}

export interface Connector extends ConnectorDefinition {
  created_at: string
  updated_at: string
}

export interface PanelLayoutRow {
  id: string
  panel_layout_id: string
  row_index: number
  hole_count: 4 | 6 | 8 | 12 | 16
  active_column_map: number[]
  created_at: string
  updated_at: string
}

export interface PanelLayoutPort {
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

export interface PanelLayout {
  id: string
  project_id: string
  name: string
  drawing_state: DrawingState
  revision_number: number
  height_ru: number
  depth_mm: number
  facing: DeviceFacing
  has_lacing_bar: boolean
  notes: string | null
  weight_kg: number
  created_at: string
  updated_at: string
  rows?: PanelLayoutRow[]
  ports?: PanelLayoutPort[]
}

export interface Project {
  id: string
  name: string
  owner: string | null
  drawing_state: DrawingState
  revision_number: number
  created_at: string
  updated_at: string
}

export interface ProjectSummary extends Project {
  layout_count: number
}

export interface Layout {
  id: string
  project_id: string
  rack_id: string
  name: string
  drawing_state: DrawingState
  revision_number: number
  created_at: string
  updated_at: string
}

export interface LayoutItem {
  id: string
  layout_id: string
  device_id: string | null
  panel_layout_id: string | null
  asset_kind: 'device' | 'panel_layout'
  start_u: number
  facing: DeviceFacing
  preferred_lane: 0 | 1 | null
  preferred_sub_lane: 0 | 1 | null
  force_full_width: boolean
  rack_ear_offset_mm: number
  custom_name: string | null
  notes: string | null
}

export interface LayoutItemWithDevice extends LayoutItem {
  device: Device
  panel_layout?: PanelLayout | null
}
