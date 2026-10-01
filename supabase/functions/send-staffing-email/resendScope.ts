import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { getStaffingWorkDates, type StaffingJobSchedule } from './requestDates.ts';

export class PendingStaffingScopeError extends Error {}

/** Resolve a resend from its persisted identity, never the clicked cell/job span. */
export async function resolveStaffingResend(client: SupabaseClient, requestId: string, jobId: string,
  profileId: string, phase: string, job: StaffingJobSchedule, requestedRole: string | null) {
  const { data: request, error } = await client.from('staffing_requests')
    .select(phase === 'offer' ? 'id,single_day,target_date,batch_id,role_code' : 'id,single_day,target_date,batch_id').eq('id', requestId)
    .eq('job_id', jobId).eq('profile_id', profileId).eq('phase', phase).eq('status', 'pending')
    .returns<{ id: string; single_day: boolean; target_date: string | null; batch_id: string | null; role_code?: string | null }[]>().maybeSingle();
  if (error) throw new Error('Unable to verify the request being resent');
  if (!request) throw new PendingStaffingScopeError('La solicitud ya no está pendiente. Actualiza la matriz.');
  if (request.batch_id) {
    const { data: rows, error: batchError } = await client.from('staffing_requests').select('id,target_date')
      .eq('job_id', jobId).eq('profile_id', profileId).eq('phase', phase)
      .eq('batch_id', request.batch_id).eq('status', 'pending');
    if (batchError) throw new Error('Unable to verify the batch being resent');
    const dates = [...new Set((rows ?? []).map(row => row.target_date as string))].sort();
    if (dates.length === 0 || dates.some(date => !date)) throw new PendingStaffingScopeError('La solicitud no tiene fechas válidas.');
    return { dates, expectedIds: (rows ?? []).map(row => row.id as string), roleCode: request.role_code as string | null, legacyRequestId: undefined };
  }
  if (request.single_day && request.target_date) return { dates: [request.target_date as string], expectedIds: [request.id as string], roleCode: request.role_code as string | null, legacyRequestId: undefined };

  // Preserve legacy row identity and any original successful delivery snapshot.
  // When no snapshot exists, the first successful resend captures today's scope.
  const { data: events, error: eventsError } = await client.from('staffing_events').select('event,meta')
    .eq('staffing_request_id', requestId).in('event', ['email_sent', 'whatsapp_sent', 'request_scope'])
    .order('created_at', { ascending: true });
  if (eventsError) throw new Error('Unable to verify the original request dates');
  const roleEvent = [...(events ?? [])].reverse().find(event => event.meta?.phase === phase && event.meta.role);
  const originalRole = phase === 'offer' ? (request.role_code || roleEvent?.meta?.role || null) as string | null : null;
  if (requestedRole && originalRole && requestedRole !== originalRole) throw new PendingStaffingScopeError('El rol ha cambiado. Cancela la oferta anterior y crea una nueva.');
  const snapshot = (events ?? []).find(event => event.meta?.phase === phase &&
    (event.event === 'request_scope' || (Number(event.meta.status) >= 200 && Number(event.meta.status) < 300)) &&
    Array.isArray(event.meta.dates) && event.meta.dates.length);
  const dates = snapshot ? [...new Set(snapshot.meta.dates as string[])].sort() : getStaffingWorkDates(job);
  return { dates, expectedIds: [request.id as string], roleCode: originalRole, legacyRequestId: request.id as string, needsSnapshot: !snapshot };
}

/** Run after send guards. A deterministic PK makes concurrent scope writers
 * elect one immutable winner regardless of transaction timestamp/commit order. */
export async function preserveLegacyResendScope(client: SupabaseClient, requestId: string, phase: string, dates: string[], role: string | null) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`staffing-request-scope:${requestId}`)));
  const hex = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const { error } = await client.from('staffing_events').insert({ id, staffing_request_id: requestId,
    event: 'request_scope', meta: { phase, dates, role } });
  if (error && error.code !== '23505') throw new Error('Unable to preserve the original request dates');
  const { data: winner, error: readError } = await client.from('staffing_events').select('meta')
    .eq('id', id).eq('staffing_request_id', requestId).eq('event', 'request_scope').maybeSingle();
  if (readError || !winner?.meta?.dates?.length) throw new Error('Unable to verify the saved request dates');
  const winnerDates = [...new Set(winner.meta.dates as string[])].sort();
  if (JSON.stringify(winnerDates) !== JSON.stringify([...dates].sort()) || (winner.meta.role ?? null) !== role) {
    throw new PendingStaffingScopeError('La solicitud ha cambiado durante el reenvío. Actualiza la matriz e inténtalo de nuevo.');
  }
}
