import { capturePrivateDataScope, type PrivateDataScope } from "@/lib/private-data-scope";

export const SNAPSHOT_STORE = "festival-snapshots";
export const QUEUE_STORE = "festival-pending-changes";
export const FILES_STORE = "festival-files";
export type OfflineStoreName = typeof SNAPSHOT_STORE | typeof QUEUE_STORE | typeof FILES_STORE;

// The legacy sector-pro-offline database has no reliable queue author. Leave
// it intact for recovery, but never read or replay it as the current account.
const DB_PREFIX = "sector-pro-offline-account-";
const STORE_KEY_PATHS: Record<OfflineStoreName, string> = {
  [SNAPSHOT_STORE]: "jobId",
  [QUEUE_STORE]: "id",
  [FILES_STORE]: "key",
};

interface StoredRecord<T> {
  key: string;
  jobId?: string;
  authorizationKey: string;
  value: T;
}

type MemoryStores = Record<OfflineStoreName, Map<string, StoredRecord<unknown>>>;
const memoryAccounts = new Map<string, MemoryStores>();
const connections = new Map<string, Promise<IDBDatabase>>();
const hasIndexedDb = () => typeof indexedDB !== "undefined";

const memoryFor = (scope: PrivateDataScope): MemoryStores => {
  let stores = memoryAccounts.get(scope.userId);
  if (!stores) {
    stores = {
      [SNAPSHOT_STORE]: new Map(),
      [QUEUE_STORE]: new Map(),
      [FILES_STORE]: new Map(),
    };
    memoryAccounts.set(scope.userId, stores);
  }
  return stores;
};

const openDb = (userId: string): Promise<IDBDatabase> => {
  const existing = connections.get(userId);
  if (existing) return existing;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`${DB_PREFIX}${encodeURIComponent(userId)}`, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      for (const store of Object.keys(STORE_KEY_PATHS)) {
        const objectStore = request.result.createObjectStore(store, { keyPath: "key" });
        if (store === FILES_STORE) {
          // Scope the index too; pruning must not expose or load old blobs.
          objectStore.createIndex("jobId", ["authorizationKey", "jobId"]);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      const forget = () => {
        if (connections.get(userId) === promise) connections.delete(userId);
      };
      db.onclose = forget;
      db.onversionchange = () => { db.close(); forget(); };
      resolve(db);
    };
    request.onerror = () => {
      connections.delete(userId);
      reject(request.error ?? new Error("No se pudo abrir la base de datos offline"));
    };
    request.onblocked = () => {
      blocked = true;
      connections.delete(userId);
      reject(new Error("La base de datos offline está bloqueada por otra pestaña"));
    };
  });
  connections.set(userId, promise);
  return promise;
};

const runTransaction = async <T>(
  scope: PrivateDataScope,
  store: OfflineStoreName,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  scope.assertCurrent();
  const db = await openDb(scope.userId);
  scope.assertCurrent();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    let result: T;
    const abort = () => {
      // A completed transaction can precede delivery of its complete event.
      // In that case oncomplete still rejects the stale scope below.
      try { transaction.abort(); } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "InvalidStateError") throw error;
      }
    };
    const cleanup = () => scope.signal.removeEventListener("abort", abort);
    transaction.oncomplete = () => {
      cleanup();
      try { scope.assertCurrent(); resolve(result); } catch (error) { reject(error); }
    };
    transaction.onabort = () => {
      cleanup();
      reject(transaction.error ?? new Error("La operación offline se ha cancelado"));
    };
    // Request success is provisional. An abort, including one from an account
    // change, must reject instead of reporting a write that never committed.
    scope.signal.addEventListener("abort", abort, { once: true });
    try {
      const request = operation(transaction.objectStore(store));
      request.onsuccess = () => { result = request.result; };
    } catch (error) {
      cleanup();
      transaction.abort();
      reject(error);
    }
  });
};

const getRecordKey = (store: OfflineStoreName, value: unknown): string => {
  const key = (value as Record<string, unknown>)[STORE_KEY_PATHS[store]];
  if (typeof key !== "string" || !key) {
    throw new Error(`Registro offline sin clave "${STORE_KEY_PATHS[store]}"`);
  }
  return key;
};

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === "function") return structuredClone(value);
  // Older WebViews without structuredClone still need detached records and
  // actual binary files; JSON round-tripping turns a Blob into an empty object.
  if (value instanceof Blob) return value.slice(0, value.size, value.type) as T;
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, cloneValue(field)])) as T;
  }
  return value;
};
const visible = (scope: PrivateDataScope, store: OfflineStoreName, record: StoredRecord<unknown>) =>
  store === QUEUE_STORE || record.authorizationKey === scope.authorizationKey;

/** Capture once before asynchronous work; bound calls cannot cross identities. */
const forScope = (scope: PrivateDataScope) => ({
  async get<T>(store: OfflineStoreName, key: string): Promise<T | null> {
    scope.assertCurrent();
    const record = hasIndexedDb()
      ? await runTransaction<StoredRecord<T> | undefined>(scope, store, "readonly", (os) => os.get(key))
      : memoryFor(scope)[store].get(key) as StoredRecord<T> | undefined;
    scope.assertCurrent();
    return record && visible(scope, store, record) ? cloneValue(record.value) : null;
  },
  async getAll<T>(store: OfflineStoreName): Promise<T[]> {
    scope.assertCurrent();
    const records = hasIndexedDb()
      ? await runTransaction<StoredRecord<T>[]>(scope, store, "readonly", (os) => os.getAll())
      : Array.from(memoryFor(scope)[store].values()) as StoredRecord<T>[];
    scope.assertCurrent();
    return records.filter((record) => visible(scope, store, record)).map((record) => cloneValue(record.value));
  },
  async getKeysByIndex(store: OfflineStoreName, indexName: string, value: string): Promise<string[]> {
    scope.assertCurrent();
    if (store !== FILES_STORE || indexName !== "jobId") {
      throw new Error("Índice offline no compatible");
    }
    if (!hasIndexedDb()) {
      return Array.from(memoryFor(scope)[store].values())
        .filter((record) => visible(scope, store, record) && record.jobId === value)
        .map((record) => record.key);
    }
    const keys = await runTransaction<IDBValidKey[]>(scope, store, "readonly", (os) =>
      os.index(indexName).getAllKeys(IDBKeyRange.only([scope.authorizationKey, value])),
    );
    scope.assertCurrent();
    return keys.map(String);
  },
  async put(store: OfflineStoreName, value: unknown): Promise<void> {
    scope.assertCurrent();
    const record: StoredRecord<unknown> = {
      key: getRecordKey(store, value),
      jobId: (value as { jobId?: string }).jobId,
      authorizationKey: scope.authorizationKey,
      value,
    };
    if (!hasIndexedDb()) {
      memoryFor(scope)[store].set(record.key, cloneValue(record));
      return;
    }
    await runTransaction(scope, store, "readwrite", (os) => os.put(record));
    scope.assertCurrent();
  },
  async remove(store: OfflineStoreName, key: string): Promise<void> {
    scope.assertCurrent();
    if (!hasIndexedDb()) {
      memoryFor(scope)[store].delete(key);
      return;
    }
    await runTransaction(scope, store, "readwrite", (os) => os.delete(key));
    scope.assertCurrent();
  },
});

export const offlineDb = {
  forScope,
  async get<T>(store: OfflineStoreName, key: string): Promise<T | null> {
    return forScope(capturePrivateDataScope()).get<T>(store, key);
  },
  async getAll<T>(store: OfflineStoreName): Promise<T[]> {
    return forScope(capturePrivateDataScope()).getAll<T>(store);
  },
  async getKeysByIndex(store: OfflineStoreName, indexName: string, value: string): Promise<string[]> {
    return forScope(capturePrivateDataScope()).getKeysByIndex(store, indexName, value);
  },
  async put(store: OfflineStoreName, value: unknown): Promise<void> {
    return forScope(capturePrivateDataScope()).put(store, value);
  },
  async remove(store: OfflineStoreName, key: string): Promise<void> {
    return forScope(capturePrivateDataScope()).remove(store, key);
  },
};

/** Test-only helper: subsequent tests supply a new IDBFactory. */
export const __resetOfflineDbForTests = () => {
  memoryAccounts.clear();
  connections.forEach((promise) => { void promise.then((db) => db.close(), () => undefined); });
  connections.clear();
};
