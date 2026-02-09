import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type SendRequest = {
  message?: string;
  recipient_ids?: string[];
  job_id?: string;
};

const normalizeBase = (s: string) => {
  let b = (s || "").trim();
  if (!/^https?:\/\//i.test(b)) b = "https://" + b;
  return b.replace(/\/+$/, "");
};

function normalizeDept(value: string | null | undefined): "production" | null {
  if (!value) return null;
  const lower = value.toLowerCase().replace(/_warehouse$/, "");
  if (lower === "production" || lower === "produccion" || lower === "producción") return "production";
  return null;
}

function normalizePhone(raw: string, defaultCountry: string): { ok: true; value: string } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: "empty" } as const;
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" } as const;

  let digits = trimmed.replace(/[\s\-()]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (!digits.startsWith("+")) {
    const dc = defaultCountry.startsWith("+") ? defaultCountry : `+${defaultCountry}`;
    // Spain-friendly: if it looks like a mobile without CC, default to +34
    if (/^[67]\d{8}$/.test(digits)) digits = "+34" + digits;
    else digits = dc + digits;
  }
  if (!/^\+\d{7,15}$/.test(digits)) return { ok: false, reason: "invalid_format" } as const;
  return { ok: true, value: digits } as const;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new DOMException("timeout", "AbortError")), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized", reason: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const actorId = userData?.user?.id || null;
    if (!actorId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department, waha_endpoint")
      .eq("id", actorId)
      .maybeSingle();

    const role = (actorProfile?.role || "").toLowerCase();
    const dept = normalizeDept(actorProfile?.department || null);

    if (!(role === "admin" || dept === "production")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!actorProfile?.waha_endpoint) {
      return new Response(JSON.stringify({ error: "Forbidden", reason: "User not authorized for WhatsApp operations" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as SendRequest;
    const message = (body.message || "").toString().trim();
    const recipientIds = Array.isArray(body.recipient_ids) ? body.recipient_ids.filter(Boolean) : [];

    if (!message) {
      return new Response(JSON.stringify({ error: "Bad Request", reason: "Empty message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bad Request", reason: "No recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recipientIds.length > 80) {
      return new Response(JSON.stringify({ error: "Bad Request", reason: "Too many recipients" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recipients, error: recErr } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, phone")
      .in("id", recipientIds);

    if (recErr) throw recErr;

    const base = normalizeBase(actorProfile.waha_endpoint);
    const { data: cfg } = await supabaseAdmin.rpc("get_waha_config", { base_url: base });
    const session = (cfg?.[0] as any)?.session || Deno.env.get("WAHA_SESSION") || "default";
    const apiKey = (cfg?.[0] as any)?.api_key || Deno.env.get("WAHA_API_KEY") || "";
    const defaultCC = Deno.env.get("WA_DEFAULT_COUNTRY_CODE") || "+34";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["X-API-Key"] = apiKey;

    const attemptsFor = (chatId: string) => [
      {
        url: `${base}/api/${encodeURIComponent(session)}/sendText`,
        body: { chatId, text: message, linkPreview: false },
      },
      {
        url: `${base}/api/sendText`,
        body: { chatId, text: message, session, linkPreview: false },
      },
    ] as const;

    const timeoutMs = Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000);

    const failed: Array<{ recipient_id: string; reason: string }> = [];
    let sentCount = 0;

    const queue = [...(recipients || [])];
    const concurrency = Math.max(1, Math.min(4, Number(Deno.env.get("WAHA_SEND_CONCURRENCY") || 4)));

    const worker = async () => {
      while (queue.length) {
        const r = queue.shift();
        if (!r) return;
        const rid = r.id as string;
        const phone = (r.phone || "").toString();
        const norm = normalizePhone(phone, defaultCC);
        if (!norm.ok) {
          failed.push({ recipient_id: rid, reason: "invalid_or_missing_phone" });
          continue;
        }
        const chatId = norm.value.replace(/^\+/, "").replace(/\D/g, "") + "@c.us";

        let ok = false;
        let lastErr = "send_failed";
        for (const attempt of attemptsFor(chatId)) {
          try {
            const res = await fetchWithTimeout(attempt.url, {
              method: "POST",
              headers,
              body: JSON.stringify(attempt.body),
            }, timeoutMs);

            const contentType = res.headers.get("content-type") || "";
            const payload = /application\/json/i.test(contentType)
              ? await res.json().catch(() => null)
              : await res.text().catch(() => null);

            if (!res.ok) {
              lastErr = `http_${res.status}`;
              continue;
            }

            if (payload && typeof payload === "object") {
              const obj = payload as Record<string, unknown>;
              if (obj.success === false) {
                lastErr = typeof obj.message === "string" ? obj.message : "waha_success_false";
                continue;
              }
              if (typeof obj.error === "string") {
                lastErr = obj.error;
                continue;
              }
            }

            ok = true;
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
          }
        }

        if (ok) sentCount += 1;
        else failed.push({ recipient_id: rid, reason: lastErr });
      }
    };

    await Promise.all(Array.from({ length: concurrency }).map(() => worker()));

    return new Response(JSON.stringify({ success: true, sentCount, failed, job_id: body.job_id || null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-job-whatsapp-message error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
