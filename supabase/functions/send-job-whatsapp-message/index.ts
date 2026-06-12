import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { checkAndRecordWhatsappQuota } from "../_shared/whatsappQuota.ts";

/** Request payload for sending a WhatsApp message to multiple assigned users. */
type SendRequest = {
  /** Message to send (required). */
  message?: string;
  /** Recipient profile IDs (required). */
  recipient_ids?: string[];
  /** Optional job ID for telemetry/debugging. */
  job_id?: string;
  /** When true, send the latest Hoja de Ruta PDF as a follow-up message after the text. */
  attach_hoja_de_ruta?: boolean;
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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
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

    // Resolve the Hoja de Ruta attachment up-front so a missing document fails
    // the request before any text message goes out.
    const attachHojaDeRuta = Boolean(body.attach_hoja_de_ruta);
    let attachment: { url: string; filename: string } | null = null;
    if (attachHojaDeRuta) {
      const { data: docRows, error: docErr } = await supabaseAdmin
        .from("job_documents")
        .select("file_name, file_path")
        .eq("job_id", jobId)
        .like("file_path", `hojas-de-ruta/${jobId}/%`)
        .order("uploaded_at", { ascending: false })
        .limit(1);

      if (docErr) throw docErr;

      const doc = docRows?.[0];
      if (!doc?.file_path) {
        return jsonResponse({ error: "Bad Request", reason: "hoja_de_ruta_not_found" }, { status: 400 });
      }

      // 7 days: the link must stay alive in the chat, not just survive the send.
      // (Used both by sendFile and by the WAHA Core text-link fallback.)
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("job-documents")
        .createSignedUrl(doc.file_path, 60 * 60 * 24 * 7);

      if (signErr || !signed?.signedUrl) {
        console.error("Failed to sign Hoja de Ruta URL:", signErr);
        return jsonResponse({ error: "Internal Server Error", reason: "hoja_de_ruta_sign_failed" }, { status: 500 });
      }

      attachment = {
        url: signed.signedUrl,
        filename: (doc.file_name || "Hoja de Ruta.pdf").toString(),
      };
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

    // Per-actor daily quota (checked after validation so rejected requests
    // don't consume it): limits the blast radius of a compromised
    // admin/production account without affecting normal call-sheet volume.
    const dailyRecipientLimit = Number(Deno.env.get("WA_DAILY_RECIPIENT_LIMIT") || 500);
    const quota = await checkAndRecordWhatsappQuota({
      supabase: supabaseAdmin,
      actorId,
      kind: "job_message",
      recipientCount: dedupedRecipientIds.length,
      jobId,
      dailyLimit: dailyRecipientLimit,
    });
    if (!quota.allowed) {
      return jsonResponse(
        {
          error: "Too Many Requests",
          reason: "daily_whatsapp_recipient_quota_exceeded",
          used_today: quota.usedToday,
          daily_limit: quota.dailyLimit,
        },
        { status: 429 },
      );
    }

    const { data: recipients, error: recErr } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, phone")
      .in("id", dedupedRecipientIds);

    if (recErr) throw recErr;

    const recipientIdSet = new Set(dedupedRecipientIds);
    const foundIdSet = new Set((recipients || []).map((r) => r.id as string));
    const missingProfileIds = dedupedRecipientIds.filter((id) => !foundIdSet.has(id));

    const failed: Array<{ recipient_id: string; reason: string }> = missingProfileIds.map((id) => ({
      recipient_id: id,
      reason: 'profile_not_found',
    }));

    let sentCount = 0;

    // Only send to recipients we could load.
    const sendTargets = (recipients || []).filter((r) => recipientIdSet.has(r.id as string));

    type WahaConfigRow = { session?: string; api_key?: string };

    const base = normalizeBase(actorProfile.waha_endpoint);
    const { data: cfg, error: cfgErr } = await supabaseAdmin.rpc("get_waha_config", { base_url: base });
    if (cfgErr) console.warn("get_waha_config RPC failed, falling back to env vars:", cfgErr.message);
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

    const fileAttemptsFor = (chatId: string, file: { url: string; filename: string }) => [
      {
        url: `${base}/api/${encodeURIComponent(session)}/sendFile`,
        body: { chatId, file: { url: file.url, filename: file.filename, mimetype: "application/pdf" } },
      },
      {
        url: `${base}/api/sendFile`,
        body: { chatId, file: { url: file.url, filename: file.filename, mimetype: "application/pdf" }, session },
      },
    ] as const;

    // WAHA Core fallback: sending files is a Plus feature, so when sendFile is
    // unavailable we deliver the PDF as a signed download link via plain text.
    const linkAttemptsFor = (chatId: string, file: { url: string; filename: string }) => {
      const text = `📄 Hoja de Ruta: ${file.filename}\n${file.url}\n(Enlace de descarga válido durante 7 días)`;
      return [
        {
          url: `${base}/api/${encodeURIComponent(session)}/sendText`,
          body: { chatId, text, linkPreview: false },
        },
        {
          url: `${base}/api/sendText`,
          body: { chatId, text, session, linkPreview: false },
        },
      ] as const;
    };

    const timeoutMs = Number(Deno.env.get("WAHA_FETCH_TIMEOUT_MS") || 9000);

    /** Try each WAHA endpoint variant in order; succeed on the first OK response. */
    const runAttempts = async (
      attempts: ReadonlyArray<{ url: string; body: unknown }>,
    ): Promise<{ ok: true } | { ok: false; reason: string }> => {
      let lastErr = "send_failed";
      for (const attempt of attempts) {
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

          return { ok: true } as const;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      return { ok: false, reason: lastErr } as const;
    };

    // Concurrency note: Deno JS is single-threaded, so mutating `queue`/`sentCount` is safe
    // as long as we only do it between `await` points (which we do in this loop).
    const queue = [...sendTargets];
    const concurrency = Math.max(1, Math.min(4, Number(Deno.env.get("WAHA_SEND_CONCURRENCY") || 4)));

    let attachmentSentCount = 0;
    let attachmentLinkFallbackCount = 0;
    const attachmentFailed: Array<{ recipient_id: string; reason: string }> = [];

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

        const textResult = await runAttempts(attemptsFor(chatId));
        if (!textResult.ok) {
          failed.push({ recipient_id: rid, reason: textResult.reason });
          continue;
        }
        sentCount += 1;

        // Follow-up: Hoja de Ruta PDF only after the text message succeeded.
        // Native attachment first (WAHA Plus); download link as text otherwise.
        if (attachment) {
          const fileResult = await runAttempts(fileAttemptsFor(chatId, attachment));
          if (fileResult.ok) {
            attachmentSentCount += 1;
          } else {
            const linkResult = await runAttempts(linkAttemptsFor(chatId, attachment));
            if (linkResult.ok) {
              attachmentSentCount += 1;
              attachmentLinkFallbackCount += 1;
            } else {
              attachmentFailed.push({ recipient_id: rid, reason: linkResult.reason });
            }
          }
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }).map(() => worker()));

    return jsonResponse(
      {
        success: true,
        sentCount,
        failed,
        job_id: jobId || null,
        ...(attachment ? { attachmentSentCount, attachmentLinkFallbackCount, attachmentFailed } : {}),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("send-job-whatsapp-message error:", err);
    return jsonResponse({ error: "Internal Server Error" }, { status: 500 });
  }
});
