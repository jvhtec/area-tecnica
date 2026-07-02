import { isBrowserOnline } from "./offline-events";

/**
 * How long an online fetch may take before the snapshot is served instead.
 * navigator.onLine regularly reports true on connections that cannot
 * actually move data (festival sites, captive portals, one signal bar), so
 * offline-capable reads must never wait on the network indefinitely.
 */
export const ONLINE_FETCH_TIMEOUT_MS = 4000;

const TIMEOUT = Symbol("online-timeout");

export interface OfflineFallbackResult<T> {
  data: T;
  /** true when the data came from the offline snapshot */
  fromOffline: boolean;
}

/**
 * Runs an online fetch with a snapshot fallback:
 *  - browser reports offline  -> snapshot immediately (throw if none)
 *  - online fetch errors      -> snapshot if available, else rethrow
 *  - online fetch exceeds the timeout -> snapshot if available, otherwise
 *    keep waiting for the network
 *
 * The offline reader returns null when no snapshot exists.
 */
export const fetchWithOfflineFallback = async <T>(options: {
  online: () => Promise<T>;
  offline: () => Promise<T | null>;
  timeoutMs?: number;
}): Promise<OfflineFallbackResult<T>> => {
  const { online, offline, timeoutMs = ONLINE_FETCH_TIMEOUT_MS } = options;

  if (!isBrowserOnline()) {
    const offlineData = await offline();
    if (offlineData !== null) {
      return { data: offlineData, fromOffline: true };
    }
    throw new Error("Sin conexión y sin copia offline de este festival");
  }

  const onlinePromise = online();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
  });

  try {
    const winner = await Promise.race([onlinePromise, timeoutPromise]);
    if (winner !== TIMEOUT) {
      return { data: winner as T, fromOffline: false };
    }

    const offlineData = await offline();
    if (offlineData !== null) {
      // Ignore the eventual outcome of the abandoned online fetch
      onlinePromise.catch(() => {});
      return { data: offlineData, fromOffline: true };
    }
    return { data: await onlinePromise, fromOffline: false };
  } catch (error) {
    const offlineData = await offline();
    if (offlineData !== null) {
      return { data: offlineData, fromOffline: true };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
