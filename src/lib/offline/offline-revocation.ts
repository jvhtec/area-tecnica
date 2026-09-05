import { invalidatePrivateDataScope, type PrivateDataScope } from "@/lib/private-data-scope";
import { FILES_STORE, SNAPSHOT_STORE, offlineDb } from "./offline-db";

const revokedJobs = new Set<string>();
const keyFor = (jobId: string, scope: PrivateDataScope) => JSON.stringify([scope.userId, scope.authorizationKey, jobId]);

export const isAuthorizationFailure = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string; context?: { status?: number } };
  return [401, 403].includes(Number(candidate.status ?? candidate.context?.status))
    || ["42501", "PGRST301", "PGRST302", "PGRST116"].includes(candidate.code ?? "");
};

export const isFestivalCacheRevoked = (jobId: string, scope: PrivateDataScope) => revokedJobs.has(keyFor(jobId, scope));
export const authorizeFestivalCache = (jobId: string, scope: PrivateDataScope) => {
  scope.assertCurrent();
  revokedJobs.delete(keyFor(jobId, scope));
};

/** A denial can arrive after a timeout already returned cached data. Replace
 * the durable snapshot with a tombstone, remove blobs, and invalidate mounted
 * private views. The author's unsent edits are deliberately retained. */
export const revokeFestivalCache = async (jobId: string, scope: PrivateDataScope): Promise<void> => {
  if (scope.signal.aborted || isFestivalCacheRevoked(jobId, scope)) return;
  revokedJobs.add(keyFor(jobId, scope));
  const db = offlineDb.forScope(scope);
  try {
    await db.put(SNAPSHOT_STORE, { jobId, schemaVersion: -1, accessRevoked: true });
    const files = await db.getKeysByIndex(FILES_STORE, "jobId", jobId);
    await Promise.all(files.map((key) => db.remove(FILES_STORE, key)));
  } catch (error) {
    if (!scope.signal.aborted) console.error("No se pudo eliminar la copia sin autorización:", error);
  } finally {
    if (!scope.signal.aborted) invalidatePrivateDataScope(scope);
  }
};

export const __resetOfflineRevocationsForTests = () => revokedJobs.clear();
