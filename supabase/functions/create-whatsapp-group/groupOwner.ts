import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type WahaConnection = {
  apiKey: string;
  base: string;
  headers: Record<string, string>;
  session: string;
};

export type GroupOwnerConnection = WahaConnection & {
  /** Phone of the manager whose WAHA session created the group, when known. */
  ownerPhone: string | null;
};

type OwnerProfile = { phone: string | null; waha_endpoint: string | null };

export const normalizeWahaBase = (value: string) => {
  let base = (value || '').trim();
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base; // default to https if scheme missing
  return base.replace(/\/+$/, '');
};

export async function loadWahaConnection(supabase: SupabaseClient, rawBase: string): Promise<WahaConnection> {
  const base = normalizeWahaBase(rawBase);
  // A failed lookup falls back to the WAHA_API_KEY / WAHA_SESSION secrets below.
  const { data: cfg } = await supabase.rpc('get_waha_config', { base_url: base });
  const row = (Array.isArray(cfg) ? cfg[0] : cfg) as { api_key?: string | null; session?: string | null } | null;
  const apiKey = row?.api_key || Deno.env.get('WAHA_API_KEY') || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;
  return {
    apiKey,
    base,
    headers,
    session: row?.session || Deno.env.get('WAHA_SESSION') || 'default',
  };
}

async function sessionSeesGroup(connection: WahaConnection, waGroupId: string) {
  const url = `${connection.base}/api/${encodeURIComponent(connection.session)}/groups/${encodeURIComponent(waGroupId)}`;
  try {
    const res = await fetch(url, { method: 'GET', headers: connection.headers });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Participants can only be added through the WAHA session that owns (created) the group,
 * which is usually not the session of the manager asking for the sync. Prefer the
 * recorded creator's endpoint; groups created before `created_by` existed are located by
 * asking every configured management endpoint whether its session can see the group.
 */
export async function resolveGroupOwnerConnection({
  createdBy,
  supabase,
  waGroupId,
}: {
  createdBy: string | null;
  supabase: SupabaseClient;
  waGroupId: string;
}): Promise<GroupOwnerConnection | null> {
  let creator: OwnerProfile | null = null;
  if (createdBy) {
    const { data } = await supabase
      .from('profiles')
      .select('phone, waha_endpoint')
      .eq('id', createdBy)
      .maybeSingle();
    creator = (data as OwnerProfile | null) ?? null;
  }
  const creatorBase = creator?.waha_endpoint?.trim() ? normalizeWahaBase(creator.waha_endpoint) : null;

  const { data: managers } = await supabase
    .from('profiles')
    .select('waha_endpoint')
    .in('role', ['admin', 'management'])
    .not('waha_endpoint', 'is', null);
  const candidates = Array.from(new Set([
    ...(creatorBase ? [creatorBase] : []),
    ...((managers ?? []) as Array<{ waha_endpoint: string | null }>)
      .map((row) => (row.waha_endpoint || '').trim())
      .filter((value) => value.length > 0)
      .map(normalizeWahaBase),
  ]));

  for (const base of candidates) {
    const connection = await loadWahaConnection(supabase, base);
    if (await sessionSeesGroup(connection, waGroupId)) {
      return { ...connection, ownerPhone: base === creatorBase ? creator?.phone ?? null : null };
    }
  }

  if (creatorBase) {
    // The probe can fail on older WAHA versions; the creator's session is still the best bet.
    return { ...(await loadWahaConnection(supabase, creatorBase)), ownerPhone: creator?.phone ?? null };
  }
  return null;
}
