import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const body = (await req.json()) as SubmitBody;
    const token = String(body?.token ?? "").trim();
    const formData = body?.formData;

    if (!token) {
      return jsonResponse({ ok: false, error: "missing_token" }, { status: 400 });
    }

    if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
      return jsonResponse({ ok: false, error: "missing_form_data" }, { status: 400 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    console.error("[submit-public-artist-form] unexpected error", error);
    return jsonResponse({ ok: false, error: "internal_error" }, { status: 500 });
  }
});
