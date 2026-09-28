import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/http.ts";
import { logEvent } from "../_shared/structuredLogger.ts";

// The rider bucket is private and has no anonymous read policy, so the public
// artist form opens and downloads its own riders through short-lived URLs
// signed here. The caller has already validated the form token.
const SIGNED_READ_URL_TTL_SECONDS = 5 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RiderFileRow = {
  id: string;
  artist_id: string | null;
  file_path: string;
  file_name: string;
};

export async function signOwnRiderFile(
  supabaseAdmin: SupabaseClient,
  artistId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const fileId = typeof body.file_id === "string" ? body.file_id.trim() : "";
  if (!UUID_PATTERN.test(fileId)) {
    return jsonResponse({ ok: false, error: "invalid_file" }, { status: 400 });
  }

  const { data: fileRow, error: fileError } = await supabaseAdmin
    .from("festival_artist_files")
    .select("id, artist_id, file_path, file_name")
    .eq("id", fileId)
    .maybeSingle<RiderFileRow>();

  if (fileError) {
    logEvent("error", "public_rider.sign.file_lookup_failed", { code: fileError.code ?? null });
    return jsonResponse({ ok: false, error: "file_lookup_failed" }, { status: 500 });
  }

  // Another artist's file is reported exactly like a missing one.
  if (!fileRow || fileRow.artist_id !== artistId) {
    return jsonResponse({ ok: false, error: "file_not_found" }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from("festival_artist_files")
    .createSignedUrl(
      fileRow.file_path,
      SIGNED_READ_URL_TTL_SECONDS,
      body.download === true ? { download: fileRow.file_name } : undefined,
    );

  if (signError || !signed?.signedUrl) {
    logEvent("error", "public_rider.sign.failed", { reason: signError?.name ?? "missing_signed_url" });
    return jsonResponse({ ok: false, error: "signed_read_failed" }, { status: 500 });
  }

  return jsonResponse({ ok: true, signed_url: signed.signedUrl }, { status: 200 });
}
