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
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
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
 * snapshot so offline reads show the edited data.
 */
export const queueFestivalChange = async (input: QueueFestivalChangeInput): Promise<void> => {
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
};
