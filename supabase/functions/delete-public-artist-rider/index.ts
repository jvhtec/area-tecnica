import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type DeleteBody = {
  token?: string;
  fileId?: string;
};

type UploadFormRow = {
  id: string;
  artist_id: string;
  status: "pending" | "submitted" | "expired";
  expires_at: string;
};

type RiderFileRow = {
  id: string;
  artist_id: string;
  file_path: string;
};

serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const body = (await req.json()) as DeleteBody;
    const token = String(body?.token ?? "").trim();
    const fileId = String(body?.fileId ?? "").trim();

    if (!token) {
      return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
    }
    if (!fileId) {
      return jsonResponse({ ok: false, error: "missing_file_id" }, { status: 400 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: formRow, error: formError } = await supabaseAdmin
      .from("festival_artist_forms")
      .select("id, artist_id, status, expires_at")
      .eq("token", token)
      .maybeSingle<UploadFormRow>();

    if (formError) {
      console.error("[delete-public-artist-rider] token lookup error", formError);
      return jsonResponse({ ok: false, error: "token_lookup_failed" }, { status: 500 });
    }

    if (!formRow) {
      return jsonResponse({ ok: false, error: "invalid_token" }, { status: 404 });
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

    const { data: fileRow, error: fileError } = await supabaseAdmin
      .from("festival_artist_files")
      .select("id, artist_id, file_path")
      .eq("id", fileId)
      .eq("artist_id", formRow.artist_id)
      .maybeSingle<RiderFileRow>();

    if (fileError) {
      console.error("[delete-public-artist-rider] file lookup error", fileError);
      return jsonResponse({ ok: false, error: "file_lookup_failed" }, { status: 500 });
    }

    if (!fileRow) {
      return jsonResponse({ ok: false, error: "file_not_found" }, { status: 404 });
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from("festival_artist_files")
      .remove([fileRow.file_path]);

    if (storageError) {
      console.error("[delete-public-artist-rider] storage remove error", storageError);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("festival_artist_files")
      .delete()
      .eq("id", fileRow.id)
      .eq("artist_id", formRow.artist_id);

    if (deleteError) {
      console.error("[delete-public-artist-rider] metadata delete error", deleteError);
      return jsonResponse({ ok: false, error: "metadata_delete_failed" }, { status: 500 });
    }

    return jsonResponse({ ok: true, deleted_file_id: fileRow.id }, { status: 200 });
  } catch (error) {
    console.error("[delete-public-artist-rider] unexpected error", error);
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 500 });
  }
});
