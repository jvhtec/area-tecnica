/**
 * Cloudflare Pages Function: WhatsApp Short Link Handler
 *
 * Handles short URLs like https://www.sector-pro.work/a/<token>
 *
 * Flow:
 * 1. Look up <token> in staffing_requests.wa_confirm_token / wa_decline_token
 * 2. Validate (not expired, still pending)
 * 3. Call existing staffing-click Edge Function with the stored HMAC token
 * 4. Redirect to answer page (/answer/yes, /answer/no, /answer/error, etc.)
 *
 * No separate token table needed — columns live on staffing_requests.
 * Idempotency is handled by staffing-click (rejects if status != 'pending').
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_FUNCTIONS_BASE_URL?: string;
}

interface StaffingRow {
  id: string;
  status: string;
  phase: string;
  token_expires_at: string;
  hmac_token_raw: string | null;
  wa_confirm_token: string | null;
  wa_decline_token: string | null;
}

function safeParseUrl(urlString: string): URL | null {
  try {
    return new URL(urlString);
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const token = context.params.token as string;
  const { env, request } = context;

  const SUPABASE_URL = env.SUPABASE_URL;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;

  let projectRef = '';
  if (SUPABASE_URL) {
    const parsed = safeParseUrl(SUPABASE_URL);
    if (parsed) {
      projectRef = parsed.host.split('.')[0] || '';
    }
  }

  const FUNCTIONS_BASE = env.SUPABASE_FUNCTIONS_BASE_URL ||
    (projectRef ? `https://${projectRef}.functions.supabase.co` : '');

  if (!token || !SUPABASE_URL || !SERVICE_ROLE || !FUNCTIONS_BASE) {
    console.error('[staffing-token] Missing configuration', {
      hasToken: !!token,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRole: !!SERVICE_ROLE,
      hasFunctionsBase: !!FUNCTIONS_BASE,
    });
    return redirectTo(request, '/answer/error');
  }

  try {
    // 1) Look up token — could be a confirm or decline token
    const encodedToken = encodeURIComponent(token);
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staffing_requests?or=(wa_confirm_token.eq.${encodedToken},wa_decline_token.eq.${encodedToken})&select=id,status,phase,token_expires_at,hmac_token_raw,wa_confirm_token,wa_decline_token&limit=1`,
      {
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!lookupRes.ok) {
      console.error('[staffing-token] Lookup failed', {
        status: lookupRes.status,
        statusText: lookupRes.statusText,
      });
      return redirectTo(request, '/answer/error');
    }

    const rows = await lookupRes.json() as StaffingRow[];
    const row = rows?.[0];

    if (!row) {
      console.log('[staffing-token] Token not found', { token: token.substring(0, 8) + '...' });
      return redirectTo(request, '/answer/invalid');
    }

    // 2) Determine action from which column matched
    const action: 'confirm' | 'decline' =
      row.wa_confirm_token === token ? 'confirm' : 'decline';

    // 3) Check expiration
    const expiresAt = new Date(row.token_expires_at);
    if (expiresAt.getTime() < Date.now()) {
      console.log('[staffing-token] Token expired', {
        rid: row.id,
        expiredAt: row.token_expires_at,
      });
      return redirectTo(request, '/answer/expired');
    }

    // 4) Check if already processed (staffing-click also checks, but early-out is faster)
    if (row.status !== 'pending') {
      console.log('[staffing-token] Already responded', {
        rid: row.id,
        status: row.status,
      });
      return redirectTo(request, '/answer/already');
    }

    // 5) Verify we have the HMAC token to forward
    if (!row.hmac_token_raw) {
      console.error('[staffing-token] No HMAC token stored', { rid: row.id });
      return redirectTo(request, '/answer/error');
    }

    // 6) Call staffing-click Edge Function
    const fnUrl = new URL(`${FUNCTIONS_BASE}/staffing-click`);
    fnUrl.searchParams.set('rid', row.id);
    fnUrl.searchParams.set('a', action);
    fnUrl.searchParams.set('exp', row.token_expires_at);
    fnUrl.searchParams.set('t', row.hmac_token_raw);
    fnUrl.searchParams.set('c', 'whatsapp');

    console.log('[staffing-token] Calling staffing-click', {
      rid: row.id,
      action,
    });

    const fnRes = await fetch(fnUrl.toString(), { method: 'GET' });
    const fnStatus = fnRes.status;

    if (!fnRes.ok && fnStatus !== 302) {
      const errorBody = await fnRes.text().catch(() => '');
      console.error('[staffing-token] staffing-click failed', {
        status: fnStatus,
        body: errorBody.substring(0, 500),
      });

      if (errorBody.includes('Ya has') || errorBody.includes('already')) {
        return redirectTo(request, '/answer/already');
      }
      return redirectTo(request, '/answer/error');
    }

    // 7) Redirect to answer page
    const finalPath = action === 'confirm' ? '/answer/yes' : '/answer/no';
    console.log('[staffing-token] Success', { action, path: finalPath });
    return redirectTo(request, finalPath);

  } catch (error) {
    console.error('[staffing-token] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return redirectTo(request, '/answer/error');
  }
};

function redirectTo(request: Request, path: string): Response {
  const url = new URL(request.url);
  const targetUrl = new URL(path, url.origin);
  return Response.redirect(targetUrl.toString(), 302);
}

/** Return 204 for link-preview HEAD requests to minimize preview noise */
export const onRequestHead: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 });
};
