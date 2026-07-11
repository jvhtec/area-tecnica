export type MatrixLens = 'default' | 'coverage' | 'workload' | 'cost';

export const MATRIX_LENS_STORAGE_KEY = 'matrix-lens-preference';

export const MATRIX_LENS_LABELS: Record<MatrixLens, string> = {
  default: 'Normal',
  coverage: 'Cobertura',
  workload: 'Carga',
  cost: 'Coste',
};

// Height (px) of the strip rendered under the date headers for lenses that need
// a per-date summary row (coverage chips, cost totals). Shared by the container
// (header height math) and the view (row layout) so they can't drift apart.
export const LENS_HEADER_ROW_HEIGHT = 28;

export type LensTone = 'neutral' | 'ok' | 'warn' | 'high' | 'muted';

// Primitive-only badge contract crossing the OptimizedMatrixCell memo boundary:
// lenses resolve their per-cell value into this shape at the view level so the
// memoized cell never receives a new object/closure per render.
export interface CellLensBadgeData {
  label: string;
  tone: LensTone;
  title?: string;
}

export interface TechnicianLensSummaryData {
  primary: string;
  secondary?: string;
  tone?: LensTone;
}
