import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

/** Request payload for sending a WhatsApp message to multiple assigned users. */
type SendRequest = {
  /** Message to send (required). */
  message?: string;
  /** Recipient profile IDs (required). */
  recipient_ids?: string[];
  /** Optional job ID for telemetry/debugging. */
  job_id?: string;
};

/** Normalize a WAHA base URL (ensures protocol, strips trailing slashes). */
const normalizeBase = (s: string) => {
  let b = (s || "").trim();
  if (!/^https?:\/\//i.test(b)) b = "https://" + b;
  return b.replace(/\/+$/, "");
};

/** Normalize department values to the canonical production label when applicable. */
function normalizeDept(value: string | null | undefined): "production" | null {
  if (!value) return null;
  const lower = value.toLowerCase().replace(/_warehouse$/, "");
  if (lower === "production" || lower === "produccion" || lower === "producción") return "production";
  return null;
}

/**
 * Normalize a phone number to E.164.
 *
 * NOTE: The `/^[67]\d{8}$/` shortcut is intentionally Spain-only. It prepends `+34` for
 * mobile-like numbers that omit the country code. `defaultCountry` is used for all
 * other non-E.164 inputs (and is normalized to include a leading '+').
 *
 * If you change `WA_DEFAULT_COUNTRY_CODE`, this Spain shortcut will still force `+34`
 * for numbers matching the regex.
 */
function normalizePhone(raw: string, defaultCountry: string): { ok: true; value: string } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: "empty" } as const;
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" } as const;

  let digits = trimmed.replace(/[\s\-()]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (!digits.startsWith("+")) {
    const dc = defaultCountry.startsWith("+") ? defaultCountry : `+${defaultCountry}`;
    // Spain-only shortcut for common mobile formats without country code.
    if (/^[67]\d{8}$/.test(digits)) digits = "+34" + digits;
    else digits = dc + digits;
  }
  if (!/^\+\d{7,15}$/.test(digits)) return { ok: false, reason: "invalid_format" } as const;
  return { ok: true, value: digits } as const;
}

/** Fetch helper with a hard timeout. */
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
  if (req.method !== "POST") return jsonResponse({ error: "Method Not Allowed" }, { status: 405 });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized", reason: "Missing Authorization header" }, { status: 401 });
    }
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized", reason: "Invalid auth scheme" }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const actorId = userData?.user?.id || null;
    if (!actorId) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role, department, waha_endpoint")
      .eq("id", actorId)
      .maybeSingle();

    const role = (actorProfile?.role || "").toLowerCase();
    const dept = normalizeDept(actorProfile?.department || null);

    if (!(role === "admin" || dept === "production")) {
      return jsonResponse({ error: "Forbidden" }, { status: 403 });
    }

    if (!actorProfile?.waha_endpoint) {
      return jsonResponse({ error: "Forbidden", reason: "User not authorized for WhatsApp operations" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as SendRequest;
    const message = (body.message || "").toString().trim();
    const recipientIds = Array.isArray(body.recipient_ids) ? body.recipient_ids.filter(Boolean) : [];
    const dedupedRecipientIds = Array.from(new Set(recipientIds));
    const jobId = (body.job_id || "").toString().trim();

    if (!message) {
      return jsonResponse({ error: "Bad Request", reason: "Empty message" }, { status: 400 });
    }

    if (!jobId) {
      return jsonResponse({ error: "Bad Request", reason: "Missing job_id" }, { status: 400 });
    }

    if (dedupedRecipientIds.length === 0) {
      return jsonResponse({ error: "Bad Request", reason: "No recipients" }, { status: 400 });
    }

    if (dedupedRecipientIds.length > 80) {
      return jsonResponse({ error: "Bad Request", reason: "Too many recipients" }, { status: 400 });
    }

    // Security: restrict recipients to technicians assigned to this job.
    const { data: assignmentRows, error: asgErr } = await supabaseAdmin
      .from("job_assignments")
      .select("technician_id")
      .eq("job_id", jobId)
      .in("technician_id", dedupedRecipientIds);

    if (asgErr) throw asgErr;

    const allowedIds = new Set((assignmentRows || []).map((r) => r.technician_id as string));
    const disallowed = dedupedRecipientIds.filter((id) => !allowedIds.has(id));
    if (disallowed.length > 0) {
      return jsonResponse(
        {
          error: "Forbidden",
          reason: "Some recipients are not assigned to this job",
          disallowed_recipient_ids: disallowed,
        },
        { status: 403 },
      );
    }

    const { data: recipients, error: recErr } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, phone")
      .in("id", dedupedRecipientIds);

    if (recErr) throw recErr;

    type WahaConfigRow = { session?: string; api_key?: string };

    const base = normalizeBase(actorProfile.waha_endpoint);
    const { data: cfg } = await supabaseAdmin.rpc("get_waha_config", { base_url: base });
    const row = (cfg as WahaConfigRow[] | null)?.[0];
    const session = row?.session || Deno.env.get("WAHA_SESSION") || "default";
    const apiKey = row?.api_key || Deno.env.get("WAHA_API_KEY") || "";
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

    // Concurrency note: Deno JS is single-threaded, so mutating `queue`/`sentCount` is safe
    // as long as we only do it between `await` points (which we do in this loop).
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

    return jsonResponse({ success: true, sentCount, failed, job_id: jobId || null }, { status: 200 });
  } catch (err) {
    console.error("send-job-whatsapp-message error:", err);
    return jsonResponse({ error: "Internal Server Error" }, { status: 500 });
  }
});
