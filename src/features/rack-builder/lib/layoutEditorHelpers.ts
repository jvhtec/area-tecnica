import { getDeviceImageUrl } from '../hooks/useDevices'
import type { ItemSlot } from './rackPositions'
import { selectFacingImagePath } from './rackViewModel'
import type { DeviceFacing, LayoutItemWithDevice, RackWidth } from '../types'

export function getTopU(item: LayoutItemWithDevice): number {
  return item.start_u + item.device.rack_units - 1
}

/**
 * Maps a visual mobile column index to the logical (preferredLane, preferredSubLane)
 * pair, accounting for rear-view mirroring.
 */
export function visualColToLanePreference(
  colIndex: number,
  rackWidth: RackWidth,
  facing: DeviceFacing,
  isHalfRack: boolean,
): { preferredLane: 0 | 1 | undefined; preferredSubLane: 0 | 1 | undefined } {
  const mirror = facing === 'rear'
  if (rackWidth === 'single') {
    if (!isHalfRack) return { preferredLane: undefined, preferredSubLane: undefined }
    const logicalLane = (mirror ? 1 - colIndex : colIndex) as 0 | 1
    return { preferredLane: logicalLane, preferredSubLane: undefined }
  }
  // Dual rack — 4 visual columns
  const visualLane = colIndex >= 2 ? 1 : 0
  const visualSub = colIndex % 2
  if (!isHalfRack) {
    const logicalLane = (mirror ? 1 - visualLane : visualLane) as 0 | 1
    return { preferredLane: logicalLane, preferredSubLane: undefined }
  }
  const logicalLane = (mirror ? 1 - visualLane : visualLane) as 0 | 1
  const logicalSub = (mirror ? 1 - visualSub : visualSub) as 0 | 1
  return { preferredLane: logicalLane, preferredSubLane: logicalSub }
}

export function computeMobileColumnRange(
  leftCssPct: string,
  widthCssPct: string,
  rackWidth: RackWidth,
): { startCol: number; endCol: number; spanCols: number } {
  const leftPct = parseFloat(leftCssPct)
  const widthPct = parseFloat(widthCssPct)
  const totalColumns = rackWidth === 'dual' ? 4 : 2
  const colWidth = 100 / totalColumns
  const startCol = Math.round(leftPct / colWidth)
  const spanCols = Math.round(widthPct / colWidth)
  const endCol = startCol + spanCols - 1
  return { startCol, endCol, spanCols }
}

export function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function resolvePlacementImageUrl(item: LayoutItemWithDevice, facing: DeviceFacing): string | null {
  return getDeviceImageUrl(selectFacingImagePath(item, facing))
}

export function describeSlot(slot: ItemSlot, rackWidth: RackWidth): string {
  if (rackWidth === 'single') {
    if (slot.outer === null) return 'full width'
    return slot.outer === 0 ? 'left half' : 'right half'
  }
  if (slot.inner === null) return slot.outer === 0 ? 'left bay' : 'right bay'
  const bayLabel = slot.outer === 0 ? 'left bay' : 'right bay'
  const halfLabel = slot.inner === 0 ? 'left half' : 'right half'
  return `${bayLabel} / ${halfLabel}`
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error && typeof error.message === 'string' ? error.message : ''
    const maybeDetails = 'details' in error && typeof error.details === 'string' ? error.details : ''
    const maybeHint = 'hint' in error && typeof error.hint === 'string' ? error.hint : ''
    const parts = [maybeMessage, maybeDetails, maybeHint].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  return 'Unknown backend error.'
}

export const PANEL_LIBRARY_CATEGORY_ID = '__panel_layouts__'
export const PANEL_LIBRARY_CATEGORY_NAME = 'Panel Layouts'
export const PANEL_LIBRARY_BRAND = 'Panel Layouts'

export function panelTemplateDeviceId(panelLayoutId: string): string {
  return `panel:${panelLayoutId}`
}

export function parsePanelTemplateId(deviceId: string): string | null {
  if (!deviceId.startsWith('panel:')) return null
  return deviceId.slice('panel:'.length)
}

export type RackViewMode = DeviceFacing | 'left' | 'right'

export const VIEW_MODE_OPTIONS: Array<{ value: RackViewMode; label: string; shortLabel: string }> = [
  { value: 'front', label: 'Front', shortLabel: 'Fr' },
  { value: 'rear', label: 'Rear', shortLabel: 'Re' },
  { value: 'left', label: 'Left', shortLabel: 'Lt' },
  { value: 'right', label: 'Right', shortLabel: 'Rt' },
]

export const LAYOUT_EDITOR_ZOOM_STORAGE_KEY = 'layout-editor-zoom-percent'
export const MIN_ZOOM_PERCENT = 60
export const MAX_ZOOM_PERCENT = 180
export const DEFAULT_ZOOM_PERCENT = 100
export const ZOOM_STEP_PERCENT = 10

export function normalizeZoomPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM_PERCENT
  const stepped = Math.round(value / ZOOM_STEP_PERCENT) * ZOOM_STEP_PERCENT
  return Math.min(MAX_ZOOM_PERCENT, Math.max(MIN_ZOOM_PERCENT, stepped))
}

export function getInitialZoomPercent(): number {
  try {
    const storedValue = localStorage.getItem(LAYOUT_EDITOR_ZOOM_STORAGE_KEY)
    if (storedValue === null) return DEFAULT_ZOOM_PERCENT
    return normalizeZoomPercent(Number(storedValue))
  } catch {
    return DEFAULT_ZOOM_PERCENT
  }
}

export function isSideViewMode(mode: RackViewMode): mode is 'left' | 'right' {
  return mode === 'left' || mode === 'right'
}
