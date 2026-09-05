import { capturePrivateDataScope, PrivateDataScopeError } from "@/lib/private-data-scope";
import { createPrivateSupabaseClient, type PrivateSupabaseClient } from "@/lib/private-supabase-client";
import { isTransportFailure } from "@/lib/offline/with-offline-fallback";

import { FILES_STORE, SNAPSHOT_STORE, offlineDb } from "@/lib/offline/offline-db";
import { isFestivalCacheRevoked } from "@/lib/offline/offline-revocation";

/**
 * Binary files (rider PDFs, stage plots, job documents) cached alongside a
 * festival snapshot so they can be viewed without connection.
 */
export interface OfflineStoredFile {
  /** `${bucket}/${path}` */
  key: string;
  jobId: string;
  bucket: string;
  path: string;
  fileName: string;
  size: number;
  downloadedAt: string;
  blob: Blob;
}

export interface OfflineFileRef {
  bucket: string;
  path: string;
  fileName: string;
}

export interface OfflineFileDownloadStats {
  total: number;
  downloaded: number;
  failed: number;
}

const fileKey = (bucket: string, path: string) => `${bucket}/${path}`;

const DOWNLOAD_CONCURRENCY = 4;
const FILE_DOWNLOAD_TIMEOUT_MS = 30_000;

class FileDownloadTimeoutError extends Error {
  constructor() { super("La descarga del archivo agotó el tiempo de espera."); }
}

/**
 * Cache lookups never throw: callers use them as a fast path before the
 * network, so a blocked/broken IndexedDB must degrade to "not cached".
 */
export const getOfflineFile = async (bucket: string, path: string): Promise<OfflineStoredFile | null> => {
  const scope = capturePrivateDataScope();
  try {
    const file = await offlineDb.forScope(scope).get<OfflineStoredFile>(FILES_STORE, fileKey(bucket, path));
    scope.assertCurrent();
    if (file) {
      if (isFestivalCacheRevoked(file.jobId, scope)) return null;
      const snapshot = await offlineDb.forScope(scope).get<{ accessRevoked?: boolean }>(SNAPSHOT_STORE, file.jobId);
      scope.assertCurrent();
      if (snapshot?.accessRevoked || isFestivalCacheRevoked(file.jobId, scope)) return null;
    }
    return file;
  } catch (error) {
    scope.assertCurrent();
    if (error instanceof PrivateDataScopeError) throw error;
    console.warn("No se pudo leer el archivo offline:", error);
    return null;
  }
};

export const getOfflineFileBlob = async (bucket: string, path: string): Promise<Blob | null> => {
  const scope = capturePrivateDataScope();
  const file = await getOfflineFile(bucket, path);
  scope.assertCurrent();
  return file?.blob ?? null;
};

export const deleteOfflineFilesForJob = async (jobId: string, scope = capturePrivateDataScope()): Promise<void> => {
  const db = offlineDb.forScope(scope);
  const keys = await db.getKeysByIndex(FILES_STORE, "jobId", jobId);
  await Promise.all(keys.map((key) => db.remove(FILES_STORE, key)));
  scope.assertCurrent();
};

// Storage downloads get their own abort timeout: one request that never
// settles would otherwise pin a worker and block the whole snapshot download.
const downloadWithTimeout = async (supabase: PrivateSupabaseClient, bucket: string, path: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FILE_DOWNLOAD_TIMEOUT_MS);
  try {
    const result = await supabase.storage.from(bucket).download(path, undefined, { signal: controller.signal });
    if (controller.signal.aborted && result.error?.name === "StorageUnknownError") {
      throw new FileDownloadTimeoutError();
    }
    return result;
  } catch (error) {
    if (controller.signal.aborted && error instanceof DOMException && error.name === "AbortError") {
      throw new FileDownloadTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Downloads the referenced storage objects and stores them in IndexedDB,
 * replacing the festival's previous file set. Individual download failures
 * are counted but never abort the batch — a festival with one broken rider
 * still gets everything else cached.
 */
export const downloadFestivalFiles = async (
  jobId: string,
  refs: OfflineFileRef[],
  scope = capturePrivateDataScope(),
): Promise<OfflineFileDownloadStats> => {
  const db = offlineDb.forScope(scope);
  const supabase = await createPrivateSupabaseClient(scope);
  scope.assertCurrent();
  const uniqueRefs = Array.from(new Map(refs.map((ref) => [fileKey(ref.bucket, ref.path), ref])).values());
  const stats: OfflineFileDownloadStats = { total: uniqueRefs.length, downloaded: 0, failed: 0 };
  const keptKeys = new Set<string>();

  const queue = [...uniqueRefs];
  const worker = async () => {
    for (;;) {
      scope.assertCurrent();
      const ref = queue.shift();
      if (!ref) return;
      const key = fileKey(ref.bucket, ref.path);
      try {
        const { data, error } = await downloadWithTimeout(supabase, ref.bucket, ref.path);
        scope.assertCurrent();
        if (error || !data) throw error ?? new Error("empty download");
        const stored: OfflineStoredFile = {
          key,
          jobId,
          bucket: ref.bucket,
          path: ref.path,
          fileName: ref.fileName,
          size: data.size,
          downloadedAt: new Date().toISOString(),
          blob: data,
        };
        await db.put(FILES_STORE, stored);
        scope.assertCurrent();
        keptKeys.add(key);
        stats.downloaded += 1;
      } catch (error) {
        scope.assertCurrent();
        console.warn(`No se pudo descargar el archivo offline ${key}:`, error);
        stats.failed += 1;
        // Only a transport failure can justify retaining a cached private file.
        // Authorization errors and deleted objects must remove the stale copy.
        if ((error instanceof FileDownloadTimeoutError || isTransportFailure(error)) && await db.get(FILES_STORE, key)) {
          keptKeys.add(key);
        } else {
          await db.remove(FILES_STORE, key);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));

  // Drop files that no longer belong to the festival (deleted riders, etc.)
  const existingKeys = await db.getKeysByIndex(FILES_STORE, "jobId", jobId);
  await Promise.all(
    existingKeys.filter((key) => !keptKeys.has(key)).map((key) => db.remove(FILES_STORE, key)),
  );
  scope.assertCurrent();
  return stats;
};
