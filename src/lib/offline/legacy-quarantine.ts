import { QUEUE_STORE } from "./offline-db";

export type LegacyQueueStatus =
  | { status: "none" }
  | { status: "retained"; count: number }
  | { status: "unavailable" };

/** Read metadata only. Legacy queue records have no trustworthy author, so
 * neither the current login nor snapshot.downloadedBy can authorize replay.
 * Keep the entire legacy database untouched for an owner/support review. */
export const getLegacyQueueStatus = async (): Promise<LegacyQueueStatus> => {
  if (typeof indexedDB === "undefined") return { status: "unavailable" };
  return new Promise((resolve) => {
    let absent = false;
    let settled = false;
    const finish = (status: LegacyQueueStatus) => { settled = true; resolve(status); };
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open("sector-pro-offline"); }
    catch { finish({ status: "unavailable" }); return; }
    request.onupgradeneeded = () => {
      // Opening an absent database would create one. Abort that creation.
      absent = true;
      request.transaction?.abort();
    };
    request.onerror = () => finish({ status: absent ? "none" : "unavailable" });
    request.onblocked = () => finish({ status: "unavailable" });
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) { db.close(); finish({ status: "none" }); return; }
      try {
        const transaction = db.transaction(QUEUE_STORE, "readonly");
        const countRequest = transaction.objectStore(QUEUE_STORE).count();
        transaction.oncomplete = () => {
          db.close();
          const count = countRequest.result;
          finish(count > 0 ? { status: "retained", count } : { status: "none" });
        };
        transaction.onabort = () => { db.close(); finish({ status: "unavailable" }); };
      } catch { db.close(); finish({ status: "unavailable" }); }
    };
  });
};
