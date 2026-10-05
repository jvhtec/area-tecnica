import type { InspectorTarget } from '@/features/matrix-v2/inspector/environment';

/** The cell element for a technician and day; the grid renders only the visible window, so it can be gone. */
export const findMatrixCellElement = (technicianId: string, dateKey: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const id = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(technicianId) : technicianId;
  return document.querySelector<HTMLElement>(`[data-matrix-cell][data-technician-id="${id}"][data-date-key="${dateKey}"]`);
};

export const resolveInspectorAnchor = (target: InspectorTarget): HTMLElement | null =>
  target.anchor?.isConnected ? target.anchor : findMatrixCellElement(target.technicianId, target.dateKey);
