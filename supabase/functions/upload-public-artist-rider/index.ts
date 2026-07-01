import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  requireEnvValues,
} from "../_shared/http.ts";
import { checkEdgeRateLimit, rateLimitHeaders } from "../_shared/rateLimit.ts";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;
const MAX_MULTIPART_BODY_BYTES = MAX_FILES_PER_REQUEST * MAX_FILE_SIZE_BYTES + 1024 * 1024;
const INGRESS_RATE_LIMIT_WINDOW_SECONDS = 60;
const INGRESS_RATE_LIMIT_MAX_REQUESTS = 30;
const TOKEN_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const TOKEN_RATE_LIMIT_MAX_REQUESTS = 50;
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "xmlp",
  "xmlc",
  "xmls",
  "nwm",
  "dwg",
  "dfx",
  "dxf",
]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/xml",
  "text/xml",
  "application/octet-stream",
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "application/dwg",
  "application/x-dwg",
  "image/vnd.dwg",
  "application/dxf",
  "application/x-dxf",
  "application/vnd.dxf",
  "image/vnd.dxf",
  "drawing/x-dxf",
]);

type UploadFormRow = {
  id: string;
  artist_id: string;
  status: "pending" | "submitted" | "expired";
  expires_at: string;
};

type ArtistLookupRow = {
  id: string;
  job_id: string | null;
  name: string | null;
  date: string | null;
};

type JobTitleRow = {
  title: string | null;
};

type FileDescriptor = {
  name?: unknown;
  type?: unknown;
  size?: unknown;
};

type PreparedUploadTarget = {
  client_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number;
  upload_token: string;
};

type UploadContext = {
  formRow: UploadFormRow;
  artistContext: ArtistLookupRow | null;
};

const sanitizeFileName = (value: string) => {
  const trimmed = value.trim();
  const cleaned = trimmed
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 160);

  return cleaned || "rider";
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase();
};

const extractFiles = (formData: FormData) => {
  const filesFromPlural = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (filesFromPlural.length > 0) return filesFromPlural;
  const single = formData.get("file");
  return single instanceof File ? [single] : [];
};

const buildArtistTableUrl = (jobId?: string | null, artistDate?: string | null) => {
  const normalizedJobId = typeof jobId === "string" ? jobId.trim() : "";
  if (!normalizedJobId) {
    return "/festival-management";
  }
  const normalizedDate = typeof artistDate === "string" ? artistDate.trim() : "";
  if (!normalizedDate) {
    return `/festival-management/${normalizedJobId}/artists`;
  }
  return `/festival-management/${normalizedJobId}/artists?date=${encodeURIComponent(normalizedDate)}`;
};

const buildRiderFilePath = (artistId: string, sanitizedName: string) => {
  const timestampPrefix = new Date().toISOString().replace(/[:.]/g, "-");
  return `${artistId}/${timestampPrefix}-${crypto.randomUUID()}-${sanitizedName}`;
};

const getFileValidationStatus = (errorCode: string) =>
  errorCode === "file_too_large"
    ? 413
    : errorCode === "empty_file" ||
        errorCode === "invalid_file_extension" ||
        errorCode === "invalid_file_type" ||
        errorCode === "invalid_file_name" ||
        errorCode === "invalid_file_size"
      ? 400
      : 500;

const validateFileDescriptor = (descriptor: FileDescriptor) => {
  const fileName = typeof descriptor.name === "string" ? descriptor.name : "";
  const fileType = typeof descriptor.type === "string" ? descriptor.type : "";
  const fileSize =
    typeof descriptor.size === "number"
      ? descriptor.size
      : typeof descriptor.size === "string"
        ? Number(descriptor.size)
        : Number.NaN;

  if (!fileName.trim()) {
    throw new Error("invalid_file_name");
  }

  if (!Number.isFinite(fileSize)) {
    throw new Error("invalid_file_size");
  }

  if (fileSize <= 0) {
    throw new Error("empty_file");
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error("file_too_large");
  }

  const sanitizedName = sanitizeFileName(fileName);
  const extension = getFileExtension(sanitizedName);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("invalid_file_extension");
  }

  if (fileType && !ALLOWED_MIME_TYPES.has(fileType)) {
    throw new Error("invalid_file_type");
  }

  return {
    sanitizedName,
    fileType: fileType || null,
    fileSize,
  };
};

async function loadUploadContext(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  token: string,
  rateLimitSalt: string,
): Promise<UploadContext | Response> {
  if (!token) {
    return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const tokenRateLimit = await checkEdgeRateLimit({
    req,
    supabase: supabaseAdmin,
    scope: "upload-public-artist-rider",
    identifierParts: [token],
    windowSeconds: TOKEN_RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: TOKEN_RATE_LIMIT_MAX_REQUESTS,
    includeIp: false,
    includeUserAgent: false,
    salt: rateLimitSalt,
  });

  if (!tokenRateLimit.allowed) {
    return jsonResponse(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(tokenRateLimit) },
    );
  }

  const { data: formRow, error: formError } = await supabaseAdmin
    .from("festival_artist_forms")
    .select("id, artist_id, status, expires_at")
    .eq("token", token)
    .maybeSingle<UploadFormRow>();

  if (formError) {
    console.error("[upload-public-artist-rider] token lookup error", formError);
    return jsonResponse({ ok: false, error: "token_lookup_failed" }, { status: 500 });
  }

  if (!formRow) {
    return jsonResponse({ ok: false, error: "invalid_token" }, { status: 404 });
  }

  let artistContext: ArtistLookupRow | null = null;
  const { data: artistRow, error: artistError } = await supabaseAdmin
    .from("festival_artists")
    .select("id, job_id, name, date")
    .eq("id", formRow.artist_id)
    .maybeSingle<ArtistLookupRow>();

  if (artistError) {
    console.error("[upload-public-artist-rider] artist lookup error", artistError);
  } else if (artistRow) {
    artistContext = artistRow;
  }

  if (formRow.status !== "pending") {
    return jsonResponse({ ok: false, error: "form_not_pending", status: formRow.status }, { status: 409 });
  }

  if (new Date(formRow.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin
      .from("festival_artist_forms")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", formRow.id);

    return jsonResponse({ ok: false, error: "form_expired", status: "expired" }, { status: 410 });
  }

  const { data: submittedRow, error: submittedError } = await supabaseAdmin
    .from("festival_artist_form_submissions")
    .select("id")
    .eq("artist_id", formRow.artist_id)
    .eq("status", "submitted")
    .maybeSingle();

  if (submittedError && submittedError.code !== "PGRST116") {
    console.error("[upload-public-artist-rider] submission lookup error", submittedError);
    return jsonResponse({ ok: false, error: "submission_lookup_failed" }, { status: 500 });
  }

  if (submittedRow) {
    await supabaseAdmin
      .from("festival_artist_forms")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", formRow.id);

    return jsonResponse({ ok: false, error: "already_submitted", status: "submitted" }, { status: 409 });
  }

  return { formRow, artistContext };
}

async function notifyRiderUpload(
  supabaseAdmin: ReturnType<typeof createClient>,
  context: UploadContext,
  insertedFiles: Array<Record<string, unknown>>,
) {
  if (insertedFiles.length === 0) return;

  let jobTitle: string | null = null;
  if (context.artistContext?.job_id) {
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("title")
      .eq("id", context.artistContext.job_id)
      .maybeSingle<JobTitleRow>();

    if (jobError) {
      console.error("[upload-public-artist-rider] job lookup error", jobError);
    } else {
      jobTitle = jobRow?.title ?? null;
    }
  }

  const artistUrl = buildArtistTableUrl(context.artistContext?.job_id, context.artistContext?.date);
  const { error: pushError } = await supabaseAdmin.functions.invoke("push", {
    body: {
      action: "broadcast",
      type: "festival.public_rider.uploaded",
      job_id: context.artistContext?.job_id ?? undefined,
      job_title: jobTitle ?? undefined,
      artist_id: context.artistContext?.id ?? context.formRow.artist_id,
      artist_name: context.artistContext?.name ?? undefined,
      artist_date: context.artistContext?.date ?? undefined,
      file_name:
        insertedFiles.length === 1
          ? String(insertedFiles[0].file_name ?? "")
          : `${String(insertedFiles[0].file_name ?? "rider")} (+${insertedFiles.length - 1})`,
      url: artistUrl,
    },
  });

  if (pushError) {
    console.error("[upload-public-artist-rider] push invoke error", pushError);
  }
}

async function insertUploadedRiderFiles(
  supabaseAdmin: ReturnType<typeof createClient>,
  context: UploadContext,
  files: Array<{ file_name: string; file_path: string; file_type: string | null; file_size: number }>,
) {
  const insertedFiles: Array<Record<string, unknown>> = [];

  try {
    for (const file of files) {
      if (!file.file_path.startsWith(`${context.formRow.artist_id}/`)) {
        throw new Error("invalid_file_path");
      }

      const folder = context.formRow.artist_id;
      const objectName = file.file_path.slice(folder.length + 1);
      const { data: storedFiles, error: listError } = await supabaseAdmin.storage
        .from("festival_artist_files")
        .list(folder, { limit: 1, search: objectName });

      if (listError) {
        console.error("[upload-public-artist-rider] storage list error", listError);
        throw new Error("storage_lookup_failed");
      }

      if (!storedFiles?.some((storedFile) => storedFile.name === objectName)) {
        throw new Error("uploaded_file_missing");
      }

      const { data: insertedFile, error: insertError } = await supabaseAdmin
        .from("festival_artist_files")
        .insert({
          artist_id: context.formRow.artist_id,
          file_name: file.file_name,
          file_path: file.file_path,
          file_type: file.file_type,
          file_size: file.file_size,
        })
        .select("id, file_name, file_path, file_type, file_size, uploaded_at, uploaded_by")
        .single();

      if (insertError || !insertedFile) {
        console.error("[upload-public-artist-rider] file metadata insert error", insertError);
        throw new Error("metadata_insert_failed");
      }

      insertedFiles.push(insertedFile as Record<string, unknown>);
    }
  } catch (error) {
    if (insertedFiles.length > 0) {
      const insertedIds = insertedFiles
        .map((file) => String(file.id ?? ""))
        .filter((id) => id.length > 0);
      if (insertedIds.length > 0) {
        await supabaseAdmin.from("festival_artist_files").delete().in("id", insertedIds);
      }
    }
    throw error;
  }

  await notifyRiderUpload(supabaseAdmin, context, insertedFiles);

  return {
    ok: true,
    file: insertedFiles[0] ? { ...insertedFiles[0], uploaded_by_name: null } : null,
    files: insertedFiles.map((file) => ({
      ...file,
      uploaded_by_name: null,
    })),
    count: insertedFiles.length,
  };
}

serve(createHttpHandler(async (req) => {
  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const rateLimitSalt = Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET") ?? SUPABASE_SERVICE_ROLE_KEY;
    const ingressRateLimit = await checkEdgeRateLimit({
      req,
      supabase: supabaseAdmin,
      scope: "upload-public-artist-rider.ingress",
      identifierParts: ["multipart"],
      windowSeconds: INGRESS_RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: INGRESS_RATE_LIMIT_MAX_REQUESTS,
      salt: rateLimitSalt,
    });

    if (!ingressRateLimit.allowed) {
      return jsonResponse(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: rateLimitHeaders(ingressRateLimit) },
      );
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let body: Record<string, unknown>;
      try {
        body = await req.json() as Record<string, unknown>;
      } catch {
        return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
      }

      const action = typeof body.action === "string" ? body.action : "";
      const token = typeof body.token === "string" ? body.token.trim() : "";

      if (action === "prepare") {
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length === 0) {
          return jsonResponse({ ok: false, error: "missing_file" }, { status: 400 });
        }
        if (files.length > MAX_FILES_PER_REQUEST) {
          return jsonResponse({ ok: false, error: "too_many_files" }, { status: 400 });
        }

        const contextOrResponse = await loadUploadContext(req, supabaseAdmin, token, rateLimitSalt);
        if (contextOrResponse instanceof Response) return contextOrResponse;

        const targets: PreparedUploadTarget[] = [];

        try {
          for (const [index, rawFile] of files.entries()) {
            if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
              throw new Error("invalid_file");
            }

            const descriptor = rawFile as FileDescriptor & { client_id?: unknown };
            const validated = validateFileDescriptor(descriptor);
            const filePath = buildRiderFilePath(contextOrResponse.formRow.artist_id, validated.sanitizedName);
            const { data: signedUpload, error: signedUploadError } = await supabaseAdmin.storage
              .from("festival_artist_files")
              .createSignedUploadUrl(filePath);

            if (signedUploadError || !signedUpload?.token) {
              console.error("[upload-public-artist-rider] signed upload error", signedUploadError);
              throw new Error("signed_upload_failed");
            }

            targets.push({
              client_id: typeof descriptor.client_id === "string" ? descriptor.client_id : String(index),
              file_name: validated.sanitizedName,
              file_path: filePath,
              file_type: validated.fileType,
              file_size: validated.fileSize,
              upload_token: signedUpload.token,
            });
          }
        } catch (error) {
          const errorCode = error instanceof Error ? error.message : "internal_error";
          return jsonResponse({ ok: false, error: errorCode }, { status: getFileValidationStatus(errorCode) });
        }

        return jsonResponse({ ok: true, files: targets }, { status: 200 });
      }

      if (action === "complete") {
        const files = Array.isArray(body.files) ? body.files : [];
        if (files.length === 0) {
          return jsonResponse({ ok: false, error: "missing_file" }, { status: 400 });
        }
        if (files.length > MAX_FILES_PER_REQUEST) {
          return jsonResponse({ ok: false, error: "too_many_files" }, { status: 400 });
        }

        const contextOrResponse = await loadUploadContext(req, supabaseAdmin, token, rateLimitSalt);
        if (contextOrResponse instanceof Response) return contextOrResponse;

        try {
          const completedFiles = files.map((rawFile) => {
            if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
              throw new Error("invalid_file");
            }

            const fileRecord = rawFile as Record<string, unknown>;
            const validated = validateFileDescriptor({
              name: fileRecord.file_name,
              type: fileRecord.file_type,
              size: fileRecord.file_size,
            });
            const filePath = typeof fileRecord.file_path === "string" ? fileRecord.file_path : "";

            return {
              file_name: validated.sanitizedName,
              file_path: filePath,
              file_type: validated.fileType,
              file_size: validated.fileSize,
            };
          });

          const result = await insertUploadedRiderFiles(supabaseAdmin, contextOrResponse, completedFiles);
          return jsonResponse(result, { status: 201 });
        } catch (error) {
          const errorCode = error instanceof Error ? error.message : "internal_error";
          const status = errorCode === "invalid_file_path" || errorCode === "uploaded_file_missing"
            ? 400
            : getFileValidationStatus(errorCode);
          return jsonResponse({ ok: false, error: errorCode }, { status });
        }
      }

      return jsonResponse({ ok: false, error: "invalid_action" }, { status: 400 });
    }

    const contentLength = Number.parseInt(req.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) {
      return jsonResponse({ ok: false, error: "file_too_large" }, { status: 413 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonResponse({ ok: false, error: "invalid_form_data" }, { status: 400 });
    }

    const token = String(formData.get("token") ?? "").trim();
    const fileEntries = extractFiles(formData);

    if (!token) {
      return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
    }

    if (fileEntries.length === 0) {
      return jsonResponse({ ok: false, error: "missing_file" }, { status: 400 });
    }

    if (fileEntries.length > MAX_FILES_PER_REQUEST) {
      return jsonResponse({ ok: false, error: "too_many_files" }, { status: 400 });
    }

    let validatedFiles: Array<{ file: File; sanitizedName: string }>;
    try {
      validatedFiles = fileEntries.map((entry) => ({
        file: entry,
        sanitizedName: validateFileDescriptor({
          name: entry.name || "rider",
          type: entry.type,
          size: entry.size,
        }).sanitizedName,
      }));
    } catch (validationError) {
      const errorCode = validationError instanceof Error ? validationError.message : "internal_error";
      return jsonResponse({ ok: false, error: errorCode }, { status: getFileValidationStatus(errorCode) });
    }

    const tokenRateLimit = await checkEdgeRateLimit({
      req,
      supabase: supabaseAdmin,
      scope: "upload-public-artist-rider",
      identifierParts: [token],
      windowSeconds: TOKEN_RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: TOKEN_RATE_LIMIT_MAX_REQUESTS,
      includeIp: false,
      includeUserAgent: false,
      salt: rateLimitSalt,
    });

    if (!tokenRateLimit.allowed) {
      return jsonResponse(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: rateLimitHeaders(tokenRateLimit) },
      );
    }

    const { data: formRow, error: formError } = await supabaseAdmin
      .from("festival_artist_forms")
      .select("id, artist_id, status, expires_at")
      .eq("token", token)
      .maybeSingle<UploadFormRow>();

    if (formError) {
      console.error("[upload-public-artist-rider] token lookup error", formError);
      return jsonResponse({ ok: false, error: "token_lookup_failed" }, { status: 500 });
    }

    if (!formRow) {
      return jsonResponse({ ok: false, error: "invalid_token" }, { status: 404 });
    }

    let artistContext: ArtistLookupRow | null = null;
    const { data: artistRow, error: artistError } = await supabaseAdmin
      .from("festival_artists")
      .select("id, job_id, name, date")
      .eq("id", formRow.artist_id)
      .maybeSingle<ArtistLookupRow>();

    if (artistError) {
      console.error("[upload-public-artist-rider] artist lookup error", artistError);
    } else if (artistRow) {
      artistContext = artistRow;
    }

    if (formRow.status !== "pending") {
      return jsonResponse({ ok: false, error: "form_not_pending", status: formRow.status }, { status: 409 });
    }

    if (new Date(formRow.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin
        .from("festival_artist_forms")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", formRow.id);

      return jsonResponse({ ok: false, error: "form_expired", status: "expired" }, { status: 410 });
    }

    const { data: submittedRow, error: submittedError } = await supabaseAdmin
      .from("festival_artist_form_submissions")
      .select("id")
      .eq("artist_id", formRow.artist_id)
      .eq("status", "submitted")
      .maybeSingle();

    if (submittedError && submittedError.code !== "PGRST116") {
      console.error("[upload-public-artist-rider] submission lookup error", submittedError);
      return jsonResponse({ ok: false, error: "submission_lookup_failed" }, { status: 500 });
    }

    if (submittedRow) {
      await supabaseAdmin
        .from("festival_artist_forms")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", formRow.id);

      return jsonResponse({ ok: false, error: "already_submitted", status: "submitted" }, { status: 409 });
    }

    const insertedFiles: Array<Record<string, unknown>> = [];
    const uploadedPaths: string[] = [];

    try {
      for (const entry of validatedFiles) {
        const filePath = buildRiderFilePath(formRow.artist_id, entry.sanitizedName);

        const { error: storageError } = await supabaseAdmin.storage
          .from("festival_artist_files")
          .upload(filePath, entry.file, {
            upsert: false,
            contentType: entry.file.type || "application/octet-stream",
          });

        if (storageError) {
          console.error("[upload-public-artist-rider] storage upload error", storageError);
          throw new Error("storage_upload_failed");
        }

        uploadedPaths.push(filePath);

        const { data: insertedFile, error: insertError } = await supabaseAdmin
          .from("festival_artist_files")
          .insert({
            artist_id: formRow.artist_id,
            file_name: entry.sanitizedName,
            file_path: filePath,
            file_type: entry.file.type || null,
            file_size: entry.file.size,
          })
          .select("id, file_name, file_path, file_type, file_size, uploaded_at, uploaded_by")
          .single();

        if (insertError || !insertedFile) {
          console.error("[upload-public-artist-rider] file metadata insert error", insertError);
          throw new Error("metadata_insert_failed");
        }

        insertedFiles.push(insertedFile as Record<string, unknown>);
      }
    } catch (uploadError) {
      if (uploadedPaths.length > 0) {
        await supabaseAdmin.storage.from("festival_artist_files").remove(uploadedPaths);
      }
      if (insertedFiles.length > 0) {
        const insertedIds = insertedFiles
          .map((file) => String(file.id ?? ""))
          .filter((id) => id.length > 0);
        if (insertedIds.length > 0) {
          await supabaseAdmin.from("festival_artist_files").delete().in("id", insertedIds);
        }
      }

      const errorCode = uploadError instanceof Error ? uploadError.message : "internal_error";
      const status =
        errorCode === "file_too_large"
          ? 413
          : errorCode === "empty_file" ||
              errorCode === "invalid_file_extension" ||
              errorCode === "invalid_file_type"
            ? 400
            : 500;

      return jsonResponse({ ok: false, error: errorCode }, { status });
    }

    let jobTitle: string | null = null;
    if (artistContext?.job_id) {
      const { data: jobRow, error: jobError } = await supabaseAdmin
        .from("jobs")
        .select("title")
        .eq("id", artistContext.job_id)
        .maybeSingle<JobTitleRow>();

      if (jobError) {
        console.error("[upload-public-artist-rider] job lookup error", jobError);
      } else {
        jobTitle = jobRow?.title ?? null;
      }
    }

    const artistUrl = buildArtistTableUrl(artistContext?.job_id, artistContext?.date);
    const { error: pushError } = await supabaseAdmin.functions.invoke("push", {
      body: {
        action: "broadcast",
        type: "festival.public_rider.uploaded",
        job_id: artistContext?.job_id ?? undefined,
        job_title: jobTitle ?? undefined,
        artist_id: artistContext?.id ?? formRow.artist_id,
        artist_name: artistContext?.name ?? undefined,
        artist_date: artistContext?.date ?? undefined,
        file_name:
          insertedFiles.length === 1
            ? String(insertedFiles[0].file_name ?? "")
            : `${String(insertedFiles[0].file_name ?? "rider")} (+${insertedFiles.length - 1})`,
        url: artistUrl,
      },
    });

    if (pushError) {
      console.error("[upload-public-artist-rider] push invoke error", pushError);
    }

    return jsonResponse(
      {
        ok: true,
        file: insertedFiles[0] ? { ...insertedFiles[0], uploaded_by_name: null } : null,
        files: insertedFiles.map((file) => ({
          ...file,
          uploaded_by_name: null,
        })),
        count: insertedFiles.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[upload-public-artist-rider] unexpected error", error);
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 500 });
  }
}, {
  allowedMethods: ["POST"],
  methodNotAllowedBody: { ok: false, error: "method_not_allowed" },
}));
