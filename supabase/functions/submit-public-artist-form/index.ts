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
const INGRESS_RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_JSON_BODY_BYTES = 256 * 1024;

type SubmitBody = {
  token?: string;
  formData?: Record<string, unknown>;
};

type SubmitResponse = {
  ok: boolean;
  error?: string;
  status?: string;
};

type PublicFormRow = {
  artist_id: string;
};

type PublicArtistRow = {
  id: string;
  job_id: string | null;
  name: string | null;
  date: string | null;
};

type JobTitleRow = {
  title: string | null;
};

const buildArtistTableUrl = (jobId: string, artistDate?: string | null) => {
  const normalizedDate = typeof artistDate === "string" ? artistDate.trim() : "";
  if (!normalizedDate) {
    return `/festival-management/${jobId}/artists`;
  }
  return `/festival-management/${jobId}/artists?date=${encodeURIComponent(normalizedDate)}`;
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
      scope: "submit-public-artist-form.ingress",
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

    let body: SubmitBody;
    try {
      body = await readBoundedJsonObject<Record<string, unknown>>(req, {
        maxBytes: MAX_JSON_BODY_BYTES,
      }) as SubmitBody;
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
    const formData = body?.formData;

    if (!token) {
      return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
    }

    if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
      return jsonResponse({ ok: false, error: "missing_form_data" }, { status: 400 });
    }

    const rateLimit = await checkEdgeRateLimit({
      req,
      supabase: supabaseAdmin,
      scope: "submit-public-artist-form",
      identifierParts: [token],
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

    const { data: submitData, error: submitError } = await supabaseAdmin.rpc(
      "submit_public_artist_form",
      {
        p_token: token,
        p_form_data: formData,
      },
    );

    if (submitError) {
      console.error("[submit-public-artist-form] submit rpc error", submitError);
      return jsonResponse({ ok: false, error: "submit_failed" }, { status: 500 });
    }

    const submitResult = (submitData ?? { ok: false, error: "submit_failed" }) as SubmitResponse;

    if (submitResult.ok) {
      try {
        const { data: formRow, error: formError } = await supabaseAdmin
          .from("festival_artist_forms")
          .select("artist_id")
          .eq("token", token)
          .maybeSingle<PublicFormRow>();

        if (formError) {
          console.error("[submit-public-artist-form] form lookup error", formError);
        } else if (formRow?.artist_id) {
          const { data: artistRow, error: artistError } = await supabaseAdmin
            .from("festival_artists")
            .select("id, job_id, name, date")
            .eq("id", formRow.artist_id)
            .maybeSingle<PublicArtistRow>();

          if (artistError) {
            console.error("[submit-public-artist-form] artist lookup error", artistError);
          } else if (artistRow?.job_id) {
            let jobTitle: string | null = null;
            const { data: jobRow, error: jobError } = await supabaseAdmin
              .from("jobs")
              .select("title")
              .eq("id", artistRow.job_id)
              .maybeSingle<JobTitleRow>();

            if (jobError) {
              console.error("[submit-public-artist-form] job lookup error", jobError);
            } else {
              jobTitle = jobRow?.title ?? null;
            }

            const artistUrl = buildArtistTableUrl(artistRow.job_id, artistRow.date);
            const { error: pushError } = await supabaseAdmin.functions.invoke("push", {
              body: {
                action: "broadcast",
                type: "festival.public_form.submitted",
                job_id: artistRow.job_id,
                job_title: jobTitle ?? undefined,
                artist_id: artistRow.id,
                artist_name: artistRow.name ?? undefined,
                artist_date: artistRow.date ?? undefined,
                url: artistUrl,
              },
            });

            if (pushError) {
              console.error("[submit-public-artist-form] push invoke error", pushError);
            }
          }
        }
      } catch (pushSideEffectError) {
        console.error("[submit-public-artist-form] push side effect failure", pushSideEffectError);
      }
    }

    return jsonResponse(submitResult, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[submit-public-artist-form] unexpected error", error);
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 500 });
  }
}, {
  allowedMethods: ["POST"],
  methodNotAllowedBody: { ok: false, error: "method_not_allowed" },
}));
