import type { DrawingState } from '../types'

export const DRAWING_STATE_OPTIONS: Array<{ value: DrawingState; label: string }> = [
  { value: 'preliminary', label: 'Preliminary' },
  { value: 'rev', label: 'Rev' },
  { value: 'as_built', label: 'As built' },
]

export function formatDrawingState(state: DrawingState): string {
  return DRAWING_STATE_OPTIONS.find((option) => option.value === state)?.label ?? state
}

export function formatRevisionLabel(state: DrawingState, revision: number): string {
  if (state !== 'rev') return '—'
  return `R${Math.max(0, revision)}`
}
