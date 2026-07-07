import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";
import { checkEdgeRateLimit, rateLimitHeaders } from "../_shared/rateLimit.ts";

const INGRESS_RATE_LIMIT_WINDOW_SECONDS = 60;
const INGRESS_RATE_LIMIT_MAX_REQUESTS = 120;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_REQUESTS = 60;
const MAX_JSON_BODY_BYTES = 32 * 1024;

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
      scope: "delete-public-artist-rider.ingress",
      identifierParts: ["json"],
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

    let body: DeleteBody;
    try {
      body = await readBoundedJsonObject<Record<string, unknown>>(req, {
        maxBytes: MAX_JSON_BODY_BYTES,
      }) as DeleteBody;
    } catch (error) {
      if (error instanceof HttpError && error.status === 400) {
        return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
      }
      if (error instanceof HttpError && error.status === 413) {
        return jsonResponse({ ok: false, error: "payload_too_large" }, { status: 413 });
      }
      throw error;
    }

    const token = String(body?.token ?? "").trim();
    const fileId = String(body?.fileId ?? "").trim();

    if (!token) {
      return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
    }
    if (!fileId) {
      return jsonResponse({ ok: false, error: "missing_file_id" }, { status: 400 });
    }

    const rateLimit = await checkEdgeRateLimit({
      req,
      supabase: supabaseAdmin,
      scope: "delete-public-artist-rider",
      identifierParts: [token, fileId],
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      includeIp: false,
      includeUserAgent: false,
      salt: rateLimitSalt,
    });

    if (!rateLimit.allowed) {
      return jsonResponse(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

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

    const { data: deleteRows, error: deleteError } = await supabaseAdmin
      .rpc("delete_festival_artist_file_reference", {
        p_artist_id: formRow.artist_id,
        p_file_id: fileRow.id,
      });

    if (deleteError) {
      if (deleteError.code === "P0002" || deleteError.message === "file_not_found") {
        return jsonResponse({ ok: true, deleted_file_id: fileRow.id, already_deleted: true }, { status: 200 });
      }

      console.error("[delete-public-artist-rider] metadata delete error", deleteError);
      return jsonResponse({ ok: false, error: "metadata_delete_failed" }, { status: 500 });
    }

    const deleteResult = deleteRows?.[0];
    if (!deleteResult) {
      console.error("[delete-public-artist-rider] metadata delete returned no result");
      return jsonResponse({ ok: false, error: "metadata_delete_failed" }, { status: 500 });
    }

    if (deleteResult.should_delete_storage && deleteResult.file_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("festival_artist_files")
        .remove([deleteResult.file_path]);

      if (storageError) {
        console.error("[delete-public-artist-rider] storage remove error", storageError);
      }
    }

    return jsonResponse({ ok: true, deleted_file_id: deleteResult.deleted_file_id }, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[delete-public-artist-rider] unexpected error", error);
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 500 });
  }
}, {
  allowedMethods: ["POST"],
  methodNotAllowedBody: { ok: false, error: "method_not_allowed" },
}));
