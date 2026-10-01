import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type NewRequest = {
  id: string;
  job_id: string;
  profile_id: string;
  phase: string;
  requested_by: string | null;
  token_expires_at: string;
  idempotency_key: string | null;
  role_code?: string;
};

type PendingRequest = { id: string; target_date: string; batch_id: string | null; role_code?: string | null };
type Credentials = { token: string; token_hash: string };

export async function createStaffingRequestToken(secret: string, id: string, phase: string, expiry: string): Promise<Credentials> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}:${phase}:${expiry}`)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', signature));
  return {
    token: btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    token_hash: Array.from(digest).map(value => value.toString(16).padStart(2, '0')).join(''),
  };
}

/** New snapshots insert atomically. Only an exact existing cycle may refresh its link. */
export async function persistDateScopedRequests(client: SupabaseClient, request: NewRequest, dates: string[], sign: (id: string) => Promise<Credentials>) {
  if (dates.length === 0) throw new Error('A staffing request requires at least one date');
  const failed = (error: { code?: string; message: string }) => ({ error, id: request.id, token: '' });
  const collision = () => failed({ code: '23505', message: 'Pending coverage belongs to a different staffing cycle' });
  const hasRoleCode = 'role_code' in request;
  const pendingQuery = () => {
    const table = client.from('staffing_requests');
    const selected = hasRoleCode ? table.select('id,target_date,batch_id,role_code') : table.select('id,target_date,batch_id');
    return selected.eq('job_id', request.job_id).eq('profile_id', request.profile_id).eq('phase', request.phase).eq('status', 'pending');
  };
  const { data: overlapping, error: lookupError } = await pendingQuery().eq('single_day', true).in('target_date', dates);
  if (lookupError) return failed(lookupError);
  const candidates = (overlapping ?? []) as PendingRequest[];
  if (candidates.length > 0) {
    const head = candidates.find(row => row.target_date === dates[0]) ?? candidates[0];
    let cycle = candidates;
    if (head.batch_id) {
      const { data, error } = await pendingQuery().eq('batch_id', head.batch_id);
      if (error) return failed(error);
      cycle = (data ?? []) as PendingRequest[];
    } else if (dates.length !== 1) {
      return collision();
    }
    if (cycle.length !== dates.length || candidates.length !== dates.length || cycle.some(row =>
      !dates.includes(row.target_date) || row.batch_id !== head.batch_id || (hasRoleCode && (row.role_code ?? null) !== request.role_code)
    )) return collision();
    const credentials = await sign(head.id);
    const { data: refreshedCycle, error: cycleError } = await client.from('staffing_requests').update({
      requested_by: request.requested_by, token_expires_at: request.token_expires_at, updated_at: new Date().toISOString(),
    }).in('id', cycle.map(row => row.id)).eq('status', 'pending').select('id');
    if (cycleError) return failed(cycleError);
    if (refreshedCycle?.length !== cycle.length) return collision();
    const { data: refreshed, error } = await client.from('staffing_requests').update({
      token_hash: credentials.token_hash, idempotency_key: request.idempotency_key,
    }).eq('id', head.id).eq('status', 'pending').select('id').maybeSingle();
    if (error) return failed(error);
    if (!refreshed) return collision();
    return { error: null, id: head.id, token: credentials.token };
  }
  const credentials = await sign(request.id);
  const batchId = dates.length > 1 ? crypto.randomUUID() : null;
  const rows = dates.map((date, index) => ({
    ...request,
    token_hash: credentials.token_hash,
    id: index === 0 ? request.id : crypto.randomUUID(),
    status: 'pending',
    single_day: true,
    target_date: date,
    batch_id: batchId,
    idempotency_key: index === 0 ? request.idempotency_key : null,
  }));
  const { error } = await client.from('staffing_requests').insert(rows);
  return { error, id: request.id, token: credentials.token };
}
