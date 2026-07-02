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

export const getOfflineFile = async (bucket: string, path: string): Promise<OfflineStoredFile | null> =>
  offlineDb.get<OfflineStoredFile>(FILES_STORE, fileKey(bucket, path));

export const getOfflineFileBlob = async (bucket: string, path: string): Promise<Blob | null> =>
  (await getOfflineFile(bucket, path))?.blob ?? null;

export const deleteOfflineFilesForJob = async (jobId: string): Promise<void> => {
  const files = await offlineDb.getAll<OfflineStoredFile>(FILES_STORE);
  await Promise.all(
    files.filter((file) => file.jobId === jobId).map((file) => offlineDb.remove(FILES_STORE, file.key)),
  );
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
        const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
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
  const existing = await offlineDb.getAll<OfflineStoredFile>(FILES_STORE);
  await Promise.all(
    existing
      .filter((file) => file.jobId === jobId && !keptKeys.has(file.key))
      .map((file) => offlineDb.remove(FILES_STORE, file.key)),
  );

  return stats;
};
