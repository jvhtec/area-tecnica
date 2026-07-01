import { dataLayerClient } from "@/services/dataLayerClient";
import { getDocumentUploadValidationError } from "@/utils/documentUploadValidation";
import { getStorageUploadErrorMessage, uploadStorageObject } from "@/utils/storageUpload";

export type PublicRiderFileRecord = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
};

type PreparedRiderUpload = {
  client_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number;
  upload_token: string;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const parsePreparedUploads = (files: Array<Record<string, unknown>>, expectedCount: number) => {
  const preparedUploads = files
    .map((file) => ({
      client_id: asString(file.client_id),
      file_name: asString(file.file_name),
      file_path: asString(file.file_path),
      file_type: asString(file.file_type) || null,
      file_size: typeof file.file_size === "number" ? file.file_size : 0,
      upload_token: asString(file.upload_token),
    }))
    .filter((file): file is PreparedRiderUpload =>
      Boolean(file.client_id && file.file_name && file.file_path && file.file_size > 0 && file.upload_token)
    );

  if (preparedUploads.length !== expectedCount) {
    throw new Error("invalid_upload_response");
  }

  return preparedUploads;
};

const parseUploadedRiderFiles = (response: {
  file?: Record<string, unknown> | null;
  files?: Array<Record<string, unknown>>;
}) => {
  const uploadedRaw =
    Array.isArray(response.files) && response.files.length > 0
      ? response.files
      : response.file
        ? [response.file]
        : [];

  const uploaded = uploadedRaw
    .map((file) => ({
      id: asString(file.id),
      file_name: asString(file.file_name),
      file_path: asString(file.file_path),
      file_type: asString(file.file_type) || null,
      file_size: typeof file.file_size === "number" ? file.file_size : null,
      uploaded_at: asString(file.uploaded_at) || null,
      uploaded_by: asString(file.uploaded_by) || null,
      uploaded_by_name: asString(file.uploaded_by_name) || null,
    }))
    .filter((file) => file.id && file.file_path);

  if (uploaded.length === 0) {
    throw new Error("invalid_upload_response");
  }

  return uploaded;
};

export async function uploadPublicArtistRiderFiles(token: string, selectedFiles: File[]) {
  const validationError = getDocumentUploadValidationError(selectedFiles);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data: prepareData, error: prepareError } = await dataLayerClient.functions.invoke("upload-public-artist-rider", {
    body: {
      action: "prepare",
      token,
      files: selectedFiles.map((file, index) => ({
        client_id: String(index),
        name: file.name,
        type: file.type || null,
        size: file.size,
      })),
    },
  });

  if (prepareError) throw prepareError;

  const prepareResponse = prepareData as {
    ok?: boolean;
    error?: string;
    files?: Array<Record<string, unknown>>;
  } | null;
  if (!prepareResponse?.ok || !Array.isArray(prepareResponse.files)) {
    throw new Error(prepareResponse?.error || "upload_prepare_failed");
  }

  const preparedUploads = parsePreparedUploads(prepareResponse.files, selectedFiles.length);

  for (const preparedUpload of preparedUploads) {
    const sourceFile = selectedFiles[Number(preparedUpload.client_id)];
    if (!sourceFile) {
      throw new Error("invalid_upload_response");
    }

    try {
      await uploadStorageObject(dataLayerClient, {
        bucket: "festival_artist_files",
        path: preparedUpload.file_path,
        file: sourceFile,
        contentType: sourceFile.type || preparedUpload.file_type || "application/octet-stream",
        signedUploadToken: preparedUpload.upload_token,
      });
    } catch (uploadError) {
      throw new Error(getStorageUploadErrorMessage(uploadError, sourceFile));
    }
  }

  const { data: completeData, error: completeError } = await dataLayerClient.functions.invoke("upload-public-artist-rider", {
    body: {
      action: "complete",
      token,
      files: preparedUploads.map((file) => ({
        file_name: file.file_name,
        file_path: file.file_path,
        file_type: file.file_type,
        file_size: file.file_size,
      })),
    },
  });

  if (completeError) throw completeError;

  const completeResponse = completeData as {
    ok?: boolean;
    error?: string;
    file?: Record<string, unknown> | null;
    files?: Array<Record<string, unknown>>;
  } | null;
  if (!completeResponse?.ok) {
    throw new Error(completeResponse?.error || "upload_failed");
  }

  return parseUploadedRiderFiles(completeResponse);
}
