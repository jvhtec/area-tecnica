/**
 * Lightweight notification channel so every component showing offline
 * festival state (controls, banners, artist table) refreshes when the
 * snapshot or the pending-change queue mutates.
 */

export const OFFLINE_FESTIVAL_CHANGED_EVENT = "offline-festival-changed";

export interface OfflineFestivalChangedDetail {
  jobId: string;
}

export const notifyOfflineFestivalChanged = (jobId: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OfflineFestivalChangedDetail>(OFFLINE_FESTIVAL_CHANGED_EVENT, { detail: { jobId } }),
  );
};

export const subscribeOfflineFestivalChanged = (
  jobId: string,
  callback: () => void,
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<OfflineFestivalChangedDetail>).detail;
    if (!detail || detail.jobId === jobId) {
      callback();
    }
  };

  window.addEventListener(OFFLINE_FESTIVAL_CHANGED_EVENT, handler);
  return () => window.removeEventListener(OFFLINE_FESTIVAL_CHANGED_EVENT, handler);
};

export const isBrowserOnline = (): boolean => {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }
  return navigator.onLine;
};
