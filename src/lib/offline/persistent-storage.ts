/**
 * Asks the browser to keep this origin's storage (IndexedDB with the offline
 * festival) instead of evicting it under storage pressure. Best effort: the
 * browser may decline or not support it, and the download works either way.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
};
