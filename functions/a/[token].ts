/**
 * Cloudflare Pages Function: WhatsApp Short Link Handler
 *
 * Handles short URLs like https://www.sector-pro.work/a/<token>
 *
 * Flow:
 * 1. Look up <token> in Supabase staffing_click_tokens table
 * 2. Validate token (not expired)
 * 3. Atomically claim the token (set processing_at where used_at and processing_at are null)
 * 4. Call existing staffing-click Edge Function to process the RSVP
 * 5. Mark token as used (set used_at, clear processing_at) after successful processing
 * 6. Redirect to answer page (/answer/yes, /answer/no, /answer/error, etc.)
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_FUNCTIONS_BASE_URL?: string;
}

interface TokenRow {
  token: string;
  rid: string;
  action: 'confirm' | 'decline';
  channel: string;
  expires_at: string;
  used_at: string | null;
  processing_at: string | null;
  created_at: string;
  hmac_token: string | null;
  phase: string | null;
}

/**
 * Safely parse a URL, returning null if parsing fails
 */
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

  // Safely derive functions base URL from Supabase URL if not explicitly set
  let projectRef = '';
  if (SUPABASE_URL) {
    const parsed = safeParseUrl(SUPABASE_URL);
    if (parsed) {
      projectRef = parsed.host.split('.')[0] || '';
    }
  }

  const FUNCTIONS_BASE = env.SUPABASE_FUNCTIONS_BASE_URL ||
    (projectRef ? `https://${projectRef}.functions.supabase.co` : '');

  // Validate environment
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
    // 1) Look up token in database
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staffing_click_tokens?token=eq.${encodeURIComponent(token)}&select=token,rid,action,channel,expires_at,used_at,processing_at,hmac_token,phase`,
      {
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!lookupRes.ok) {
      console.error('[staffing-token] Token lookup failed', {
        status: lookupRes.status,
        statusText: lookupRes.statusText,
      });
      return redirectTo(request, '/answer/error');
    }

    const rows = await lookupRes.json() as TokenRow[];
    const row = rows?.[0];

    if (!row) {
      console.log('[staffing-token] Token not found', { token: token.substring(0, 8) + '...' });
      return redirectTo(request, '/answer/invalid');
    }

    // 2) Check expiration
    const expiresAt = new Date(row.expires_at);

    if (expiresAt.getTime() < Date.now()) {
      console.log('[staffing-token] Token expired', {
        token: token.substring(0, 8) + '...',
        expiredAt: row.expires_at,
      });
      return redirectTo(request, '/answer/expired');
    }

    // 3) Check if already used (quick check before atomic claim)
    if (row.used_at) {
      console.log('[staffing-token] Token already used', {
        token: token.substring(0, 8) + '...',
        usedAt: row.used_at,
      });
      return redirectTo(request, '/answer/already');
    }

    // Check if we have the HMAC token stored
    if (!row.hmac_token) {
      console.error('[staffing-token] No HMAC token stored for this click token', {
        token: token.substring(0, 8) + '...',
        rid: row.rid,
      });
      return redirectTo(request, '/answer/error');
    }

    // 4) Atomically claim the token to prevent race conditions
    // Only claim if used_at IS NULL AND processing_at IS NULL
    const claimTime = new Date().toISOString();
    const claimRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staffing_click_tokens?token=eq.${encodeURIComponent(token)}&used_at=is.null&processing_at=is.null`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ processing_at: claimTime }),
      }
    );

    if (!claimRes.ok) {
      console.error('[staffing-token] Failed to claim token', {
        status: claimRes.status,
      });
      return redirectTo(request, '/answer/error');
    }

    const claimedRows = await claimRes.json() as TokenRow[];
    if (!claimedRows || claimedRows.length === 0) {
      // Another request already claimed this token
      console.log('[staffing-token] Token already claimed by another request', {
        token: token.substring(0, 8) + '...',
      });
      return redirectTo(request, '/answer/already');
    }

    // 5) Call the staffing-click Edge Function
    const actionParam = row.action;
    const channelParam = row.channel || 'whatsapp';

    const fnUrl = new URL(`${FUNCTIONS_BASE}/staffing-click`);
    fnUrl.searchParams.set('rid', row.rid);
    fnUrl.searchParams.set('a', actionParam);
    fnUrl.searchParams.set('exp', row.expires_at);
    fnUrl.searchParams.set('t', row.hmac_token);
    fnUrl.searchParams.set('c', channelParam);

    console.log('[staffing-token] Calling staffing-click function', {
      rid: row.rid,
      action: actionParam,
      channel: channelParam,
    });

    const fnRes = await fetch(fnUrl.toString(), {
      method: 'GET',
      headers: {
        'X-Internal-Token': SERVICE_ROLE.substring(0, 32),
      },
    });

    const fnStatus = fnRes.status;
    const fnOk = fnRes.ok || fnStatus === 302;

    if (!fnOk && fnStatus !== 200 && fnStatus !== 302) {
      const errorBody = await fnRes.text().catch(() => '');
      console.error('[staffing-token] Staffing-click function failed', {
        status: fnStatus,
        body: errorBody.substring(0, 500),
      });

      // Release the claim so user can retry
      await fetch(
        `${SUPABASE_URL}/rest/v1/staffing_click_tokens?token=eq.${encodeURIComponent(token)}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_ROLE,
            'Authorization': `Bearer ${SERVICE_ROLE}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ processing_at: null }),
        }
      ).catch(() => {});

      if (errorBody.includes('Ya has') || errorBody.includes('already')) {
        return redirectTo(request, '/answer/already');
      }

      return redirectTo(request, '/answer/error');
    }

    // 6) Mark token as used and clear processing_at
    const finalizeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/staffing_click_tokens?token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          used_at: new Date().toISOString(),
          processing_at: null,
        }),
      }
    );

    if (!finalizeRes.ok) {
      console.warn('[staffing-token] Failed to finalize token (non-blocking)', {
        status: finalizeRes.status,
      });
    }

    // 7) Redirect to success page based on action
    const finalPath = actionParam === 'confirm' ? '/answer/yes' : '/answer/no';
    console.log('[staffing-token] Success, redirecting', { action: actionParam, path: finalPath });

    return redirectTo(request, finalPath);

  } catch (error) {
    console.error('[staffing-token] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return redirectTo(request, '/answer/error');
  }
};

/**
 * Helper to redirect to an answer page
 */
function redirectTo(request: Request, path: string): Response {
  const url = new URL(request.url);
  const targetUrl = new URL(path, url.origin);
  return Response.redirect(targetUrl.toString(), 302);
}

/**
 * Handle HEAD requests (for link previews) - return 204 to minimize preview noise
 */
export const onRequestHead: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204 });
};
