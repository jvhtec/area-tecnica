import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "png", "jpg", "jpeg", "webp"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
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

serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(
      { ok: false, error: "server_misconfigured" },
      { status: 500 },
    );
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const formData = await req.formData();
    const token = String(formData.get("token") ?? "").trim();
    const fileEntry = formData.get("file");

    if (!token) {
      return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      return jsonResponse({ ok: false, error: "missing_file" }, { status: 400 });
    }

    if (fileEntry.size <= 0) {
      return jsonResponse({ ok: false, error: "empty_file" }, { status: 400 });
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return jsonResponse({ ok: false, error: "file_too_large" }, { status: 413 });
    }

    const sanitizedName = sanitizeFileName(fileEntry.name || "rider");
    const extension = getFileExtension(sanitizedName);

    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      return jsonResponse({ ok: false, error: "invalid_file_extension" }, { status: 400 });
    }

    if (fileEntry.type && !ALLOWED_MIME_TYPES.has(fileEntry.type)) {
      return jsonResponse({ ok: false, error: "invalid_file_type" }, { status: 400 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

    const timestampPrefix = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = `${formRow.artist_id}/${timestampPrefix}-${crypto.randomUUID()}-${sanitizedName}`;

    const { error: storageError } = await supabaseAdmin.storage
      .from("festival_artist_files")
      .upload(filePath, fileEntry, {
        upsert: false,
        contentType: fileEntry.type || "application/octet-stream",
      });

    if (storageError) {
      console.error("[upload-public-artist-rider] storage upload error", storageError);
      return jsonResponse({ ok: false, error: "storage_upload_failed" }, { status: 500 });
    }

    const { data: insertedFile, error: insertError } = await supabaseAdmin
      .from("festival_artist_files")
      .insert({
        artist_id: formRow.artist_id,
        file_name: sanitizedName,
        file_path: filePath,
        file_type: fileEntry.type || null,
        file_size: fileEntry.size,
      })
      .select("id, file_name, file_path, file_type, file_size, uploaded_at, uploaded_by")
      .single();

    if (insertError) {
      console.error("[upload-public-artist-rider] file metadata insert error", insertError);
      await supabaseAdmin.storage.from("festival_artist_files").remove([filePath]);
      return jsonResponse({ ok: false, error: "metadata_insert_failed" }, { status: 500 });
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
        file_name: sanitizedName,
        url: artistUrl,
      },
    });

    if (pushError) {
      console.error("[upload-public-artist-rider] push invoke error", pushError);
    }

    return jsonResponse(
      {
        ok: true,
        file: {
          ...insertedFile,
          uploaded_by_name: null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[upload-public-artist-rider] unexpected error", error);
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 500 });
  }
});
