import { supabase } from "@/integrations/supabase/client";

import { FILES_STORE, offlineDb } from "./offline-db";

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

/**
 * Cache lookups never throw: callers use them as a fast path before the
 * network, so a blocked/broken IndexedDB must degrade to "not cached".
 */
export const getOfflineFile = async (bucket: string, path: string): Promise<OfflineStoredFile | null> => {
  try {
    return await offlineDb.get<OfflineStoredFile>(FILES_STORE, fileKey(bucket, path));
  } catch (error) {
    console.warn("No se pudo leer el archivo offline:", error);
    return null;
  }
};

export const getOfflineFileBlob = async (bucket: string, path: string): Promise<Blob | null> =>
  (await getOfflineFile(bucket, path))?.blob ?? null;

export const deleteOfflineFilesForJob = async (jobId: string): Promise<void> => {
  const keys = await offlineDb.getKeysByIndex(FILES_STORE, "jobId", jobId);
  await Promise.all(keys.map((key) => offlineDb.remove(FILES_STORE, key)));
};

// Storage downloads get their own abort timeout: one request that never
// settles would otherwise pin a worker and block the whole snapshot download.
const downloadWithTimeout = (bucket: string, path: string) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FILE_DOWNLOAD_TIMEOUT_MS);
  const request = supabase.storage.from(bucket).download(path, undefined, { signal: controller.signal });
  return Promise.resolve(request).finally(() => clearTimeout(timer));
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
): Promise<OfflineFileDownloadStats> => {
  const uniqueRefs = Array.from(new Map(refs.map((ref) => [fileKey(ref.bucket, ref.path), ref])).values());
  const stats: OfflineFileDownloadStats = { total: uniqueRefs.length, downloaded: 0, failed: 0 };
  const keptKeys = new Set<string>();

  const queue = [...uniqueRefs];
  const worker = async () => {
    for (;;) {
      const ref = queue.shift();
      if (!ref) return;
      const key = fileKey(ref.bucket, ref.path);
      try {
        const { data, error } = await downloadWithTimeout(ref.bucket, ref.path);
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
        await offlineDb.put(FILES_STORE, stored);
        keptKeys.add(key);
        stats.downloaded += 1;
      } catch (error) {
        console.warn(`No se pudo descargar el archivo offline ${key}:`, error);
        stats.failed += 1;
        // Keep a previously cached copy if we have one rather than dropping it
        if (await getOfflineFile(ref.bucket, ref.path)) {
          keptKeys.add(key);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));

  // Drop files that no longer belong to the festival (deleted riders, etc.)
  const existingKeys = await offlineDb.getKeysByIndex(FILES_STORE, "jobId", jobId);
  await Promise.all(
    existingKeys.filter((key) => !keptKeys.has(key)).map((key) => offlineDb.remove(FILES_STORE, key)),
  );

  return stats;
};
