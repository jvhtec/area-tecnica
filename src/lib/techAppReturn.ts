/**
 * "Come back here" marker for documents opened from the tech app.
 *
 * A job document is a signed Supabase Storage URL. In the native app
 * (capacitor.config.ts allows navigation to *.supabase.co) it can load inside
 * the app's own web view, replacing the app; once the technician closes it the
 * app starts again from "/" and lands on the tech-app dashboard. Saving where
 * they were just before the hand-off lets the tech app put them back.
 *
 * The marker is written only when a document is opened, expires quickly and is
 * consumed once, so a normal launch later on never reopens an old screen.
 */

const STORAGE_KEY = 'tech-app:document-return';
export const DOCUMENT_RETURN_TTL_MS = 15 * 60 * 1000;

type ReturnMarker = { path: string; savedAt: number };

export function rememberDocumentReturn(
  location: Pick<Location, 'pathname' | 'search'> = window.location,
  now: number = Date.now(),
): void {
  if (!location.pathname.startsWith('/tech-app')) return;
  try {
    const marker: ReturnMarker = { path: `${location.pathname}${location.search}`, savedAt: now };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(marker));
  } catch {
    // Storage unavailable (private mode, blocked): nothing to restore later.
  }
}

/** Returns the saved tech-app location if it is still fresh, and clears it. */
export function consumeDocumentReturn(now: number = Date.now()): string | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const marker = JSON.parse(raw) as Partial<ReturnMarker>;
    if (typeof marker.path !== 'string' || typeof marker.savedAt !== 'number') return null;
    if (!marker.path.startsWith('/tech-app')) return null;
    if (now - marker.savedAt > DOCUMENT_RETURN_TTL_MS || now < marker.savedAt) return null;
    return marker.path;
  } catch {
    return null;
  }
}

/** Drops the marker: the technician is back in a live app, nothing to restore. */
export function clearDocumentReturn(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored or storage unavailable.
  }
}
