import { getStorageUploadErrorMessage, uploadStorageObject } from "@/utils/storageUpload";

type UploadClient = Parameters<typeof uploadStorageObject>[0];
type UploadFile = Parameters<typeof uploadStorageObject>[1]["file"];

type TaskStorageUploadOptions = {
  bucket: string;
  path: string;
  file: UploadFile;
  upsert: boolean;
};

export async function uploadTaskStorageObject(
  supabase: UploadClient,
  { bucket, path, file, upsert }: TaskStorageUploadOptions,
) {
  try {
    await uploadStorageObject(supabase, {
      bucket,
      path,
      file,
      contentType: file.type || "application/octet-stream",
      upsert,
    });
  } catch (error) {
    throw new Error(getStorageUploadErrorMessage(error, file));
  }
}
