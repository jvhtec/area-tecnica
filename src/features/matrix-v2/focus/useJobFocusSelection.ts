import { useCallback, useEffect, useState } from 'react';
import { focusJobIdFromSearch, searchWithFocusJob } from '@/features/matrix-v2/focus/focusParam';

export type FocusStatus = 'invited' | 'confirmed';

/**
 * Which job the matrix is focused on, and the status new assignments get while
 * it is. Lives at page level so the toolbar, the job bar and the grid agree;
 * the choice follows `?trabajo=` so a focused view can be shared or reloaded.
 * The status starts at Invitado every session: confirming straight away is a
 * deliberate switch, never a remembered default.
 */
export function useJobFocusSelection() {
  const [jobId, setJobId] = useState<string | null>(() =>
    (typeof window === 'undefined' ? null : focusJobIdFromSearch(window.location.search)));
  const [status, setStatus] = useState<FocusStatus>('invited');

  useEffect(() => {
    const sync = () => setJobId(focusJobIdFromSearch(window.location.search));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  // Esc leaves focus, unless it is closing something else: a popover, the
  // inspector or a dialog. Registered in the capture phase, ahead of Radix's own
  // handler, so the layer that Esc closes is still in the document to be seen.
  const focused = jobId !== null;
  useEffect(() => {
    if (!focused) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]')) return;
      // While cells are selected, Esc drops the selection first (the batch bar is on screen).
      if (document.querySelector('[data-batch-bar]')) return;
      setJobId(null);
      if (typeof window === 'undefined') return;
      const search = searchWithFocusJob(window.location.search, null);
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [focused]);

  const focusJob = useCallback((next: string | null) => {
    setJobId(next);
    if (typeof window === 'undefined') return;
    const search = searchWithFocusJob(window.location.search, next);
    if (search !== window.location.search) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
    }
  }, []);

  return { focusJobId: jobId, focusStatus: status, setFocusStatus: setStatus, focusJob };
}
