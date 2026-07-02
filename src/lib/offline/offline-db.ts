/**
 * Minimal IndexedDB key-value layer for offline festival data.
 *
 * Falls back to an in-memory store when IndexedDB is unavailable
 * (unit tests under Node, private browsing edge cases). The in-memory
 * fallback keeps the same API so callers never need to branch.
 */

export const SNAPSHOT_STORE = "festival-snapshots";
export const QUEUE_STORE = "festival-pending-changes";

export type OfflineStoreName = typeof SNAPSHOT_STORE | typeof QUEUE_STORE;

const DB_NAME = "sector-pro-offline";
const DB_VERSION = 1;

const STORE_KEY_PATHS: Record<OfflineStoreName, string> = {
  [SNAPSHOT_STORE]: "jobId",
  [QUEUE_STORE]: "id",
};

const hasIndexedDb = () => typeof indexedDB !== "undefined";

let dbPromise: Promise<IDBDatabase> | null = null;

const memoryStores: Record<OfflineStoreName, Map<string, unknown>> = {
  [SNAPSHOT_STORE]: new Map(),
  [QUEUE_STORE]: new Map(),
};

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        (Object.keys(STORE_KEY_PATHS) as OfflineStoreName[]).forEach((store) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: STORE_KEY_PATHS[store] });
          }
        });
      };

      request.onsuccess = () => {
        const db = request.result;
        // If the connection is closed elsewhere (e.g. version change from
        // another tab), reopen lazily on next access.
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("No se pudo abrir la base de datos offline"));
      };
    });
  }

  return dbPromise;
};

const runTransaction = async <T>(
  store: OfflineStoreName,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const request = operation(transaction.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Error en la base de datos offline"));
  });
};

const getRecordKey = (store: OfflineStoreName, value: unknown): string => {
  const key = (value as Record<string, unknown>)[STORE_KEY_PATHS[store]];
  if (typeof key !== "string" || !key) {
    throw new Error(`Registro offline sin clave "${STORE_KEY_PATHS[store]}"`);
  }
  return key;
};

// Structured clone keeps the in-memory fallback behaviour consistent with
// IndexedDB (stored values are detached from caller mutations).
const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const offlineDb = {
  async get<T>(store: OfflineStoreName, key: string): Promise<T | null> {
    if (!hasIndexedDb()) {
      const value = memoryStores[store].get(key);
      return value === undefined ? null : cloneValue(value as T);
    }
    const result = await runTransaction<T | undefined>(store, "readonly", (os) => os.get(key) as IDBRequest<T | undefined>);
    return result ?? null;
  },

  async getAll<T>(store: OfflineStoreName): Promise<T[]> {
    if (!hasIndexedDb()) {
      return Array.from(memoryStores[store].values()).map((value) => cloneValue(value as T));
    }
    return runTransaction<T[]>(store, "readonly", (os) => os.getAll() as IDBRequest<T[]>);
  },

  async put(store: OfflineStoreName, value: unknown): Promise<void> {
    if (!hasIndexedDb()) {
      memoryStores[store].set(getRecordKey(store, value), cloneValue(value));
      return;
    }
    await runTransaction(store, "readwrite", (os) => os.put(value));
  },

  async remove(store: OfflineStoreName, key: string): Promise<void> {
    if (!hasIndexedDb()) {
      memoryStores[store].delete(key);
      return;
    }
    await runTransaction(store, "readwrite", (os) => os.delete(key));
  },
};

/** Test-only helper: wipes the in-memory fallback stores. */
export const __resetOfflineDbForTests = () => {
  memoryStores[SNAPSHOT_STORE].clear();
  memoryStores[QUEUE_STORE].clear();
};
