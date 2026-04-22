/**
 * Lightweight, browser-only telemetry for errors caught by ErrorBoundary.
 *
 * Persists the last N errors to sessionStorage so support can inspect them
 * via `window.__sectorProErrors` without requiring a backend round-trip.
 */

export interface BoundaryErrorRecord {
  boundary: string;
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  silent: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'sector-pro:boundary-errors';
const MAX_RECORDS = 10;

declare global {
  interface Window {
    __sectorProErrors?: BoundaryErrorRecord[];
  }
}

function loadRecords(): BoundaryErrorRecord[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is BoundaryErrorRecord =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as BoundaryErrorRecord).message === 'string',
    );
  } catch {
    return [];
  }
}

function saveRecords(records: BoundaryErrorRecord[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // sessionStorage may be full or unavailable — ignore
  }
}

export function recordBoundaryError(record: BoundaryErrorRecord): void {
  const records = loadRecords();
  records.push(record);
  while (records.length > MAX_RECORDS) records.shift();
  saveRecords(records);

  if (typeof window !== 'undefined') {
    window.__sectorProErrors = records;
  }
}

export function getBoundaryErrors(): BoundaryErrorRecord[] {
  return loadRecords();
}

export function clearBoundaryErrors(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.__sectorProErrors = [];
  }
}
