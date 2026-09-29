import { logoUrlCache } from "@/lib/logo-url-cache";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { Tables } from "@/integrations/supabase/types";
import { optimizeImageForUpload } from "@/utils/imageOptimization";
import { getStorageUploadErrorMessage, uploadStorageObject } from "@/utils/storageUpload";

const LOGO_BUCKET = "festival-logos";
const ARTIST_FILES_BUCKET = "festival_artist_files";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// --- Festival logo -------------------------------------------------------------------------

/** Signed URL when the bucket is private, the public URL otherwise. */
async function resolveLogoUrl(filePath: string): Promise<string | null> {
  const { data: signed } = await dataLayerClient.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
  if (signed?.signedUrl) return signed.signedUrl;

  const { data } = dataLayerClient.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

async function requireSession() {
  const { data, error } = await dataLayerClient.auth.getSession();
  if (error || !data.session) {
    throw new Error("Authentication error: " + (error?.message || "Session not found"));
  }
}

async function fetchLogoPath(jobId: string): Promise<string | null> {
  const { data, error } = await dataLayerClient
    .from("festival_logos")
    .select("file_path")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(`Error fetching logo: ${error.message}`);
  return data?.file_path ?? null;
}

/** URL of the festival's logo, or `null` when it has none. */
export async function fetchFestivalLogoDisplayUrl(jobId: string): Promise<string | null> {
  const filePath = await fetchLogoPath(jobId);
  return filePath ? resolveLogoUrl(filePath) : null;
}

/** Replaces the festival's logo (image is downscaled to webp first) and returns its display URL. */
export async function uploadFestivalLogo({
  jobId,
  file,
  userId,
}: {
  jobId: string;
  file: File;
  userId: string;
}): Promise<string | null> {
  await requireSession();

  const uploadFile = await optimizeImageForUpload(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.86,
    outputFormat: "image/webp",
  });
  const filePath = `${jobId}.${uploadFile.name.split(".").pop()}`;
  const contentType = uploadFile.type || file.type;

  // Drop the previous file first. A failure here only leaves an orphan, so the upload goes on.
  const previousPath = await fetchLogoPath(jobId);
  if (previousPath) {
    await dataLayerClient.storage.from(LOGO_BUCKET).remove([previousPath]);
  }

  const { error: uploadError } = await dataLayerClient.storage
    .from(LOGO_BUCKET)
    .upload(filePath, uploadFile, { upsert: true, cacheControl: "3600", contentType });
  if (uploadError) throw new Error(`Error uploading logo: ${uploadError.message}`);

  const { error: dbError } = await dataLayerClient.from("festival_logos").upsert({
    job_id: jobId,
    file_path: filePath,
    file_name: file.name,
    content_type: contentType,
    file_size: uploadFile.size,
    uploaded_by: userId,
  });
  if (dbError) throw new Error(`Error saving logo information: ${dbError.message}`);

  // A replacement reuses the path, and the list resolves logos through a URL cache keyed by it.
  logoUrlCache.delete(LOGO_BUCKET, filePath);
  if (previousPath) logoUrlCache.delete(LOGO_BUCKET, previousPath);

  return resolveLogoUrl(filePath);
}

/** Deletes the logo file and its record. Resolves `false` when there was nothing to delete. */
export async function deleteFestivalLogo(jobId: string): Promise<boolean> {
  await requireSession();

  const filePath = await fetchLogoPath(jobId);
  if (!filePath) return false;

  const { error: storageError } = await dataLayerClient.storage.from(LOGO_BUCKET).remove([filePath]);
  if (storageError) throw new Error(`Error removing logo: ${storageError.message}`);

  const { error: dbError } = await dataLayerClient.from("festival_logos").delete().eq("job_id", jobId);
  if (dbError) throw new Error(`Error deleting logo record: ${dbError.message}`);
  return true;
}

// --- Artist files ---------------------------------------------------------------------------

export type ArtistFileRow = Tables<"festival_artist_files">;

export async function fetchArtistFiles(artistId: string): Promise<ArtistFileRow[]> {
  const { data, error } = await dataLayerClient.from("festival_artist_files").select("*").eq("artist_id", artistId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Uploads a batch of rider files for an artist and marks the rider as received.
 * The batch is all-or-nothing: if any file fails, the ones already stored are removed again.
 * Resolves `riderStateUpdated: false` when the files landed but the artist's rider flags could not
 * be updated (the files are kept).
 */
export async function uploadArtistFiles(artistId: string, files: File[]): Promise<{ riderStateUpdated: boolean }> {
  const uploadedPaths: string[] = [];
  const insertedIds: string[] = [];

  try {
    for (const file of files) {
      const uploadFile = await optimizeImageForUpload(file, {
        maxWidth: 1800,
        maxHeight: 1800,
        quality: 0.82,
        outputFormat: "image/webp",
      });
      const filePath = `${artistId}/${crypto.randomUUID()}.${uploadFile.name.split(".").pop()}`;
      const fileType = uploadFile.type || file.type;

      // Storage first; large CAD/rider files use resumable chunks.
      try {
        await uploadStorageObject(dataLayerClient, {
          bucket: ARTIST_FILES_BUCKET,
          path: filePath,
          file: uploadFile,
          contentType: fileType || "application/octet-stream",
        });
      } catch (uploadError) {
        throw new Error(getStorageUploadErrorMessage(uploadError, uploadFile));
      }
      uploadedPaths.push(filePath);

      const { data: inserted, error: dbError } = await dataLayerClient
        .from("festival_artist_files")
        .insert({
          artist_id: artistId,
          file_name: file.name,
          file_path: filePath,
          file_type: fileType,
          file_size: uploadFile.size,
        })
        .select("id")
        .single();
      if (dbError) throw dbError;
      if (inserted?.id) insertedIds.push(inserted.id);
    }
  } catch (error) {
    try {
      if (insertedIds.length > 0) {
        await dataLayerClient.from("festival_artist_files").delete().in("id", insertedIds);
      }
      if (uploadedPaths.length > 0) {
        await dataLayerClient.storage.from(ARTIST_FILES_BUCKET).remove(uploadedPaths);
      }
    } catch {
      // Nothing more can be done; the original error is what the user needs to see.
    }
    throw error;
  }

  const { error: riderStateError } = await dataLayerClient
    .from("festival_artists")
    .update({
      rider_missing: false,
      rider_outdated: false,
      rider_copied_from_date: null,
      rider_outdated_dismissed: false,
    })
    .eq("id", artistId);

  return { riderStateUpdated: !riderStateError };
}

/** Removes one file reference; the stored object is deleted too when nothing else uses it. */
export async function deleteArtistFile(fileId: string): Promise<void> {
  const { data, error } = await dataLayerClient.rpc("delete_festival_artist_file_reference", {
    p_file_id: fileId,
  });
  if (error) throw error;

  const result = data?.[0];
  if (!result) throw new Error("No se recibió confirmación de eliminación.");

  if (result.should_delete_storage && result.file_path) {
    // The reference is already gone; a leftover object is harmless.
    await dataLayerClient.storage.from(ARTIST_FILES_BUCKET).remove([result.file_path]);
  }
}

export async function downloadArtistFileBlob(filePath: string): Promise<Blob> {
  const { data, error } = await dataLayerClient.storage.from(ARTIST_FILES_BUCKET).download(filePath);
  if (error) throw error;
  return data;
}

/** One-hour URL for previewing a stored artist file. */
export async function signArtistFileUrl(filePath: string): Promise<string | null> {
  const { data } = await dataLayerClient.storage
    .from(ARTIST_FILES_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
