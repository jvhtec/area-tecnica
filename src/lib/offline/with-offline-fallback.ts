import { isBrowserOnline } from "./offline-events";
import { assertFestivalAccess } from "./festival-access";
import { capturePrivateDataScope } from "@/lib/private-data-scope";
import { isAuthorizationFailure, isFestivalCacheRevoked, revokeFestivalCache } from "./offline-revocation";

/**
 * How long an online fetch may take before the snapshot is served instead.
 * navigator.onLine regularly reports true on connections that cannot
 * actually move data (festival sites, captive portals, one signal bar), so
 * offline-capable reads must never wait on the network indefinitely.
 */
export const ONLINE_FETCH_TIMEOUT_MS = 4000;

const TIMEOUT = Symbol("online-timeout");

/** Only a missing transport response permits cached private data as fallback.
 * PostgREST serializes fetch TypeErrors into a plain object with an empty code.
 * HTTP/SQL errors and cancellation must retain their original meaning.
 */
export const isTransportFailure = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  if ("status" in error && Number(error.status) > 0) return false;
  if ("context" in error && error.context && typeof error.context === "object"
    && "status" in error.context && Number(error.context.status) > 0) return false;
  if ("code" in error && error.code !== "" && error.code != null) return false;
  if ("name" in error && error.name === "AbortError") return false;
  return "message" in error && typeof error.message === "string"
    && /^(?:TypeError: )?(?:Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|Network request failed)$/i.test(error.message);
};

export interface OfflineFallbackResult<T> {
  data: T;
  /** true when the data came from the offline snapshot */
  fromOffline: boolean;
}

/**
 * Runs an online fetch with a snapshot fallback:
 *  - browser reports offline  -> snapshot immediately (throw if none)
 *  - transport failure       -> snapshot if available, else rethrow
 *  - HTTP/SQL/authorization errors or cancellation -> rethrow without cache
 *  - online fetch exceeds the timeout -> snapshot if available, otherwise
 *    keep waiting for the network
 *
 * The offline reader returns null when no snapshot exists.
 */
export const fetchWithOfflineFallback = async <T>(options: {
  jobId: string;
  online: () => Promise<T>;
  offline: () => Promise<T | null>;
  timeoutMs?: number;
}): Promise<OfflineFallbackResult<T>> => {
  const { jobId, online, offline, timeoutMs = ONLINE_FETCH_TIMEOUT_MS } = options;
  const scope = capturePrivateDataScope();
  const readCached = async () => {
    scope.assertCurrent();
    if (isFestivalCacheRevoked(jobId, scope)) return null;
    const data = await offline();
    scope.assertCurrent();
    return isFestivalCacheRevoked(jobId, scope) ? null : data;
  };

  if (!isBrowserOnline()) {
    const offlineData = await readCached();
    if (offlineData !== null) {
      return { data: offlineData, fromOffline: true };
    }
    throw new Error("Sin conexión y sin copia offline de este festival");
  }

  // Keep observing the server after a timeout returns cached data. A late
  // denial must withdraw that data instead of being silently swallowed.
  const onlinePromise = Promise.resolve().then(() => {
    scope.assertCurrent();
    // The access probe observes its own late denial even if the data request
    // fails first or the timeout has already served the offline snapshot.
    return Promise.all([online(), assertFestivalAccess(jobId, scope)]).then(([data]) => data);
  }).then(
    (data) => ({ kind: "data" as const, data }),
    async (error: unknown) => {
      if (isAuthorizationFailure(error)) await revokeFestivalCache(jobId, scope);
      return { kind: "error" as const, error };
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
  });

  try {
    let winner = await Promise.race([onlinePromise, timeoutPromise]);
    if (winner === TIMEOUT) {
      const offlineData = await readCached();
      if (offlineData !== null) return { data: offlineData, fromOffline: true };
      winner = await onlinePromise;
    }
    if (winner.kind === "error") {
      if (!isTransportFailure(winner.error)) throw winner.error;
      const offlineData = await readCached();
      if (offlineData !== null) return { data: offlineData, fromOffline: true };
      throw winner.error;
    }
    scope.assertCurrent();
    return { data: winner.data, fromOffline: false };
  } finally {
    clearTimeout(timer);
  }
};
