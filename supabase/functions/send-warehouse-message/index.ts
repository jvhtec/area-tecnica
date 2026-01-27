import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface SendRequest {
  message?: string;
  job_id?: string;
  highlight?: boolean; // explicitly request highlight regardless of message detection
}

const WAREHOUSE_SOUND_GROUP = "120363042398076348@g.us"; // "Almacén sonido"

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '').trim();

    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const actorId = userData?.user?.id || null;
    if (!actorId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load actor profile to read role and WAHA endpoint
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, waha_endpoint')
      .eq('id', actorId)
      .maybeSingle();

    const role = (profile?.role || '').toLowerCase();
    if (!['admin', 'management'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!profile?.waha_endpoint) {
      return new Response(JSON.stringify({ error: 'Forbidden', reason: 'User not authorized for WhatsApp operations' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = (await req.json().catch(() => ({}))) as SendRequest;
    let msg = (body.message || '').toString().trim();

    // Fetch job title early if available (to detect default message and build fallback)
    let jobTitle: string | null = null;
    if (body.job_id) {
      const { data: j } = await supabaseAdmin
        .from('jobs')
        .select('title')
        .eq('id', body.job_id)
        .maybeSingle();
      jobTitle = j?.title ?? null;
    }

    // Fallback: build a lightweight message from job context if provided
    if (!msg) {
      const title = jobTitle || 'trabajo';
      msg = `He hecho cambios en el PS del ${title} por favor echad un vistazo`;
    }

    const normalizeBase = (s: string) => {
      let b = (s || '').trim();
      if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
      return b.replace(/\/+$/, '');
    };

    const base = normalizeBase(profile.waha_endpoint);
    const { data: cfg } = await supabaseAdmin.rpc('get_waha_config', { base_url: base });
    const session = (cfg?.[0] as any)?.session || Deno.env.get('WAHA_SESSION') || 'default';
    const apiKey = (cfg?.[0] as any)?.api_key || Deno.env.get('WAHA_API_KEY') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const requestId = crypto.randomUUID();
    try {
      console.log('send-warehouse-message context', {
        requestId,
        actorId,
        base,
        session,
        hasApiKey: Boolean(apiKey),
        groupIdSuffix: WAREHOUSE_SOUND_GROUP?.slice(-8) || null,
      });
    } catch {}

    const basePayload = { chatId: WAREHOUSE_SOUND_GROUP, text: msg, linkPreview: false } as const;
    const attempts = [
      {
        url: `${base}/api/${encodeURIComponent(session)}/sendText`,
        body: { ...basePayload },
      },
      {
        url: `${base}/api/sendText`,
        body: { ...basePayload, session },
      },
    ] as const;

    // Fetch with timeout + Cloudflare 524 awareness
    // Keep a global time budget to avoid crossing edge 15s limits
    const timeoutMs = Number(Deno.env.get('WAHA_FETCH_TIMEOUT_MS') || 15000);
    const overallBudgetMs = Number(Deno.env.get('WAREHOUSE_SEND_OVERALL_TIMEOUT_MS') || 14000);
    const startedAt = Date.now();
    const fetchWithTimeout = async (url: string, init: RequestInit, ms: number) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(new DOMException('timeout','AbortError')), ms);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(id);
      }
    };
    const parseCF524 = (body: string) => {
      const is524 = /Error code\s*524/i.test(body) || /cloudflare/i.test(body);
      if (!is524) return null;
      const ray = (body.match(/Cloudflare Ray ID:\s*<strong[^>]*>([^<]+)/i)?.[1])
        || (body.match(/Ray ID:\s*([a-z0-9]+)/i)?.[1]) || null;
      return { rayId: ray };
    };

    const truncate = (value: string | null | undefined, max = 2000) => {
      if (!value) return value ?? '';
      return value.length > max ? `${value.slice(0, max)}…` : value;
    };

    type AttemptError = {
      url: string;
      step: 'http' | 'fetch' | 'api';
      status?: number;
      body?: string;
      json?: Record<string, unknown> | null;
      message?: string;
      cloudflareRayId?: string | null;
    };

    const attemptErrors: AttemptError[] = [];
    let waSendOk = false;

    const interpretResponse = (payload: unknown): { ok: boolean; reason?: string } => {
      if (!payload || typeof payload !== 'object') return { ok: true };
      const obj = payload as Record<string, unknown>;
      if (obj.success === false) return { ok: false, reason: typeof obj.message === 'string' ? obj.message : 'WAHA reported success=false' };
      if (obj.error && typeof obj.error === 'string') return { ok: false, reason: obj.error };
      if (Array.isArray(obj.errors) && obj.errors.length) return { ok: false, reason: obj.errors.map((e) => String(e)).join(', ') };
      if (typeof obj.status === 'string') {
        const lowered = obj.status.toLowerCase();
        if (['error', 'fail', 'failed'].includes(lowered)) {
          return { ok: false, reason: typeof obj.message === 'string' ? obj.message : obj.status };
        }
        if (['success', 'ok'].includes(lowered)) return { ok: true };
      }
      if (obj.success === true) return { ok: true };
      if ('result' in obj && obj.result !== undefined) return { ok: true };
      if ('data' in obj && obj.data !== undefined) return { ok: true };
      if ('id' in obj || 'messageId' in obj) return { ok: true };
      return { ok: true };
    };

    for (const attempt of attempts) {
      // Ensure we don't exceed the global time budget
      const elapsed = Date.now() - startedAt;
      const remaining = overallBudgetMs - elapsed - 200; // leave a small margin to finalize response
      if (remaining <= 200) {
        attemptErrors.push({ url: attempt.url, step: 'fetch', message: 'skipped_due_to_time_budget' });
        continue;
      }
      try {
        const perAttemptTimeout = Math.min(timeoutMs, Math.max(500, remaining));
        const res = await fetchWithTimeout(
          attempt.url,
          { method: 'POST', headers, body: JSON.stringify(attempt.body) },
          perAttemptTimeout,
        );
        const contentType = res.headers.get('content-type') || '';
        let parsedJson: Record<string, unknown> | null = null;
        let bodyText: string | null = null;
        if (/application\/json/i.test(contentType)) {
          parsedJson = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        } else {
          bodyText = await res.text().catch(() => null);
        }

        if (!res.ok) {
          const body = parsedJson ? JSON.stringify(parsedJson) : bodyText || '';
          const cf = res.status === 524 && body ? parseCF524(body) : null;
          console.warn('WAHA sendText returned non-OK', {
            url: attempt.url,
            status: res.status,
            body: truncate(body || ''),
            rayId: cf?.rayId || null,
          });
          attemptErrors.push({
            url: attempt.url,
            step: 'http',
            status: res.status,
            body: body ? truncate(body) : undefined,
            cloudflareRayId: cf?.rayId || null,
          });
          continue;
        }

        const interpretation = interpretResponse(parsedJson);
        if (interpretation.ok) {
          waSendOk = true;
          break;
        }

        const serialized = parsedJson ? JSON.stringify(parsedJson) : bodyText || '';
        console.warn('WAHA sendText reported failure', {
          url: attempt.url,
          status: res.status,
          body: truncate(serialized || ''),
          reason: interpretation.reason || null,
        });
        attemptErrors.push({
          url: attempt.url,
          step: 'api',
          status: res.status,
          json: parsedJson,
          body: bodyText ? truncate(bodyText) : undefined,
          message: interpretation.reason,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn('WAHA sendText fetch error (timeout/abort or network)', { url: attempt.url, message });
        attemptErrors.push({ url: attempt.url, step: 'fetch', message });
      }
    }

    if (!waSendOk) {
      const errorPayload: Record<string, unknown> = {
        error: 'Failed to send WhatsApp message',
        request_id: requestId,
        context: { base, session },
        attempts: attemptErrors.map((err) => ({
          url: err.url,
          step: err.step,
          status: err.status,
          message: err.message,
          cloudflareRayId: err.cloudflareRayId,
          body: err.body,
          json: err.json ? err.json : undefined,
        })),
      };

      return new Response(JSON.stringify(errorPayload), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If message equals the default phrase for this job, create an announcement with a highlight directive
    if (jobTitle && body.job_id) {
      const expectedDefault = `He hecho cambios en el PS del ${jobTitle} por favor echad un vistazo`;
      const isDefault = msg.trim().toLowerCase() === expectedDefault.trim().toLowerCase();
      if (isDefault || body.highlight === true) {
        const { error: annError } = await supabaseAdmin
          .from('announcements')
          .insert({
            message: `[HIGHLIGHT_JOB:${body.job_id}] ${msg}`,
            level: 'info',
            active: true,
            created_by: actorId
          });
        
        if (annError) {
          console.error('Failed to create announcement:', annError);
        } else {
          console.log('Announcement created successfully for job:', body.job_id);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-warehouse-message error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
