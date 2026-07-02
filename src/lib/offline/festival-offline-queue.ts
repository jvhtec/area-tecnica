import { offlineDb, QUEUE_STORE } from "./offline-db";
import { notifyOfflineFestivalChanged } from "./offline-events";
import { getFestivalSnapshot, saveFestivalSnapshot } from "./festival-snapshot";
import type {
  OfflineChangeOperation,
  OfflinePendingChange,
  OfflineSyncableTable,
} from "./types";

type Row = Record<string, unknown>;

export const generateOfflineId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback: the id becomes the row's uuid primary key on
  // sync, so it must be a valid UUID even in older WebViews.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Serializes queue/snapshot writes per festival so concurrent
// queueFestivalChange calls can't interleave their read-modify-write
// cycles (stale queue coalescing or lost snapshot mutations).
const jobWriteLocks = new Map<string, Promise<void>>();

const withJobWriteLock = <T>(jobId: string, fn: () => Promise<T>): Promise<T> => {
  const previous = jobWriteLocks.get(jobId) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  const tail = result.then(
    (): void => undefined,
    (): void => undefined,
  );
  jobWriteLocks.set(jobId, tail);
  tail.then(() => {
    if (jobWriteLocks.get(jobId) === tail) {
      jobWriteLocks.delete(jobId);
    }
  });
  return result;
};

export const getPendingChanges = async (jobId?: string): Promise<OfflinePendingChange[]> => {
  const changes = await offlineDb.getAll<OfflinePendingChange>(QUEUE_STORE);
  return changes
    .filter((change) => !jobId || change.jobId === jobId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

export const countPendingChanges = async (jobId: string): Promise<number> =>
  (await getPendingChanges(jobId)).length;

export const removePendingChange = async (changeId: string): Promise<void> => {
  await offlineDb.remove(QUEUE_STORE, changeId);
};

/**
 * Drops every queued change of a festival. The local snapshot may still
 * contain the discarded edits, so callers should re-download it afterwards
 * when a connection is available.
 */
export const discardPendingChanges = async (jobId: string): Promise<number> => {
  const changes = await getPendingChanges(jobId);
  await Promise.all(changes.map((change) => offlineDb.remove(QUEUE_STORE, change.id)));
  notifyOfflineFestivalChanged(jobId);
  return changes.length;
};

const applyChangeToSnapshotArtists = (artists: Row[], change: OfflinePendingChange): Row[] => {
  switch (change.operation) {
    case "insert":
      return [...artists, { ...(change.payload ?? {}), id: change.recordId }];
    case "update":
      return artists.map((artist) =>
        artist.id === change.recordId ? { ...artist, ...(change.payload ?? {}) } : artist,
      );
    case "delete":
      return artists.filter((artist) => artist.id !== change.recordId);
    default:
      return artists;
  }
};

const mutateSnapshot = async (change: OfflinePendingChange): Promise<void> => {
  const snapshot = await getFestivalSnapshot(change.jobId);
  if (!snapshot) return;

  if (change.table === "festival_artists") {
    snapshot.data.artists = applyChangeToSnapshotArtists(snapshot.data.artists, change);
  }

  await saveFestivalSnapshot(snapshot);
};

/**
 * Coalesces a new operation with a previously queued one for the same
 * record so sync sends the minimum set of writes:
 *   insert + update -> insert (merged payload)
 *   insert + delete -> nothing
 *   update + update -> update (merged payload, original baseUpdatedAt)
 *   update + delete -> delete (original baseUpdatedAt)
 */
const coalesce = (
  existing: OfflinePendingChange | undefined,
  incoming: OfflinePendingChange,
): OfflinePendingChange | null => {
  if (!existing) return incoming;

  if (existing.operation === "insert") {
    if (incoming.operation === "delete") return null;
    return {
      ...existing,
      payload: { ...(existing.payload ?? {}), ...(incoming.payload ?? {}) },
      label: incoming.label ?? existing.label,
    };
  }

  if (existing.operation === "update") {
    if (incoming.operation === "delete") {
      return { ...incoming, id: existing.id, createdAt: existing.createdAt, baseUpdatedAt: existing.baseUpdatedAt };
    }
    return {
      ...existing,
      payload: { ...(existing.payload ?? {}), ...(incoming.payload ?? {}) },
      label: incoming.label ?? existing.label,
    };
  }

  // existing delete followed by anything else: keep the latest intent
  return incoming;
};

export interface QueueFestivalChangeInput {
  jobId: string;
  table: OfflineSyncableTable;
  operation: OfflineChangeOperation;
  recordId: string;
  payload?: Row | null;
  baseUpdatedAt?: string | null;
  label?: string;
}

/**
 * Queues an offline mutation and reflects it immediately in the local
 * snapshot so offline reads show the edited data. Writes for the same
 * festival are serialized to avoid stale read-modify-write races.
 */
export const queueFestivalChange = (input: QueueFestivalChangeInput): Promise<void> =>
  withJobWriteLock(input.jobId, async () => {
    const incoming: OfflinePendingChange = {
      id: generateOfflineId(),
      jobId: input.jobId,
      table: input.table,
      operation: input.operation,
      recordId: input.recordId,
      payload: input.payload ?? null,
      baseUpdatedAt: input.baseUpdatedAt ?? null,
      createdAt: new Date().toISOString(),
      label: input.label,
    };

    const pending = await getPendingChanges(input.jobId);
    const existing = pending.find(
      (change) => change.table === input.table && change.recordId === input.recordId,
    );

    const merged = coalesce(existing, incoming);

    if (existing && (!merged || merged.id !== existing.id)) {
      await offlineDb.remove(QUEUE_STORE, existing.id);
    }
    if (merged) {
      await offlineDb.put(QUEUE_STORE, merged);
    }

    await mutateSnapshot(incoming);
    notifyOfflineFestivalChanged(input.jobId);
  });
