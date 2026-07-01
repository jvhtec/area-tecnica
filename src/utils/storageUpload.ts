import type { SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/api-config";

export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

type UploadableFile = Blob & {
  name?: string;
  type?: string;
  size: number;
};

type StorageUploadOptions = {
  bucket: string;
  path: string;
  file: UploadableFile;
  cacheControl?: string;
  contentType?: string;
  signedUploadToken?: string;
  upsert?: boolean;
  onProgress?: (progress: { bytesUploaded: number; bytesTotal: number; percentage: number }) => void;
};

type SupabaseStorageClient = Pick<SupabaseClient, "auth" | "storage">;
type UploadErrorWithStatus = {
  status?: unknown;
  statusCode?: unknown;
  originalResponse?: {
    getStatus?: () => unknown;
    status?: unknown;
    statusCode?: unknown;
  };
};

function normalizeStatusCode(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function getResumableUploadEndpoint() {
  const url = new URL(SUPABASE_URL);
  const [projectRef] = url.hostname.split(".");

  if (projectRef && url.hostname.endsWith(".supabase.co")) {
    return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  return `${url.origin}/storage/v1/upload/resumable`;
}

function getSignedResumableUploadEndpoint() {
  const url = new URL(SUPABASE_URL);
  return `${url.origin}/storage/v1/upload/resumable/sign`;
}

function getUploadContentType(file: UploadableFile, override?: string) {
  return override || file.type || "application/octet-stream";
}

export function shouldUseResumableUpload(file: UploadableFile) {
  return file.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES;
}

export async function uploadStorageObject(
  supabase: SupabaseStorageClient,
  options: StorageUploadOptions,
): Promise<void> {
  const { bucket, path, file, cacheControl = "3600", contentType, upsert = false, onProgress } = options;

  if (!options.signedUploadToken && !shouldUseResumableUpload(file)) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl,
      contentType: getUploadContentType(file, contentType),
      upsert,
    });

    if (error) throw error;
    onProgress?.({ bytesUploaded: file.size, bytesTotal: file.size, percentage: 100 });
    return;
  }

  let endpoint = getResumableUploadEndpoint();
  let headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "x-upsert": String(upsert),
  };

  if (options.signedUploadToken) {
    endpoint = getSignedResumableUploadEndpoint();
    headers = {
      apikey: SUPABASE_ANON_KEY,
      "x-signature": options.signedUploadToken,
    };
  } else {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.access_token) {
      throw new Error("Usuario no autenticado");
    }

    headers.authorization = `Bearer ${session.access_token}`;
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: getUploadContentType(file, contentType),
        cacheControl,
      },
      fingerprint: async (uploadFile) => {
        const namedFile = uploadFile as UploadableFile & { lastModified?: number };
        return [
          endpoint,
          bucket,
          path,
          namedFile.name ?? "blob",
          namedFile.size,
          namedFile.type ?? "",
          namedFile.lastModified ?? "",
        ].join(":");
      },
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0;
        onProgress?.({ bytesUploaded, bytesTotal, percentage });
      },
      onError: reject,
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        const [previousUpload] = previousUploads;
        if (previousUpload) {
          upload.resumeFromPreviousUpload(previousUpload);
        }
        upload.start();
      })
      .catch(reject);
  });
}

export function getStorageUploadErrorMessage(error: unknown, file?: UploadableFile) {
  const message = error instanceof Error ? error.message : String(error);

  if (file && shouldUseResumableUpload(file) && /failed to fetch|networkerror|load failed/i.test(message)) {
    return "No se pudo completar la subida del archivo grande. Revisa la conexion e intentalo de nuevo; la subida se enviara por partes.";
  }

  return message || "No se pudo subir el archivo";
}

export function getStorageUploadStatusCode(error: unknown) {
  const errorWithStatus = error as UploadErrorWithStatus;
  const response = errorWithStatus.originalResponse;
  const candidates = [
    errorWithStatus.status,
    errorWithStatus.statusCode,
    response?.status,
    response?.statusCode,
    response?.getStatus?.(),
  ];

  for (const candidate of candidates) {
    const statusCode = normalizeStatusCode(candidate);
    if (statusCode !== null) return statusCode;
  }

  return null;
}

export function isStorageNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return getStorageUploadStatusCode(error) === 404 || /bucket not found/i.test(message);
}
