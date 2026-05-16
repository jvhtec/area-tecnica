import type { PanelKey } from './types';

export const PANEL_KEYS: PanelKey[] = ['overview', 'crew', 'logistics', 'pending', 'calendar'];
export const DEFAULT_PANEL_ORDER: PanelKey[] = [...PANEL_KEYS];
export const DEFAULT_PANEL_DURATIONS: Record<PanelKey, number> = {
  overview: 12,
  crew: 12,
  logistics: 12,
  pending: 12,
  calendar: 12,
};
export const DEFAULT_ROTATION_FALLBACK_SECONDS = 12;
export const DEFAULT_HIGHLIGHT_TTL_SECONDS = 300;
export const DEFAULT_TICKER_SECONDS = 20;

export function normalisePanelOrder(order?: string[] | null): PanelKey[] {
  if (!Array.isArray(order)) return [...DEFAULT_PANEL_ORDER];
  const seen = new Set<PanelKey>();
  const filtered: PanelKey[] = [];
  for (const value of order) {
    const key = (typeof value === 'string' ? value.toLowerCase() : '') as PanelKey;
    if ((PANEL_KEYS as readonly string[]).includes(key) && !seen.has(key)) {
      filtered.push(key);
      seen.add(key);
    }
  }
  if (!filtered.length) return [...DEFAULT_PANEL_ORDER];
  PANEL_KEYS.forEach((key) => {
    if (!seen.has(key)) {
      filtered.push(key);
      seen.add(key);
    }
  });
  return filtered;
}

export function coerceSeconds(value: unknown, fallback: number, min = 1, max = 600): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(Math.max(num, min), max);
  return Math.round(clamped);
}

