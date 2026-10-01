import { detectConflictForAssignment, type ConflictContext, type ConflictResult } from './conflictUtils.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type RequestScope = { single_day?: boolean | null; target_date?: string | null; batch_id?: string | null };
type DeliveryEvent = { meta?: Record<string, unknown> | null };

function explicitDateKeys(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date)) return null;
  return [...new Set(value as string[])].sort();
}

/** A batch uses only the rows actually transitioned by this click, never the live job span. */
export function getAcceptedStaffingDates(request: RequestScope, updatedBatchRows: RequestScope[] | null, deliveryEvents: DeliveryEvent[]): string[] | null {
  if (request.batch_id) {
    const dates = explicitDateKeys((updatedBatchRows ?? []).map(row => row.target_date));
    if (!dates) throw new Error('The accepted batch has no valid date snapshot');
    return dates;
  }
  if (request.single_day && request.target_date) {
    const dates = explicitDateKeys([request.target_date]);
    if (!dates) throw new Error('The request has an invalid target date');
    return dates;
  }
  // The handler reads newest first. Pin the earliest successful explicit snapshot:
  // a later resend or job extension must never broaden that original coverage.
  const delivered = [...deliveryEvents].reverse().find(event => event.meta?.phase === 'offer' &&
    Number(event.meta.status) >= 200 && Number(event.meta.status) < 300 &&
    Array.isArray(event.meta.dates) && event.meta.dates.length > 0);
  if (delivered?.meta?.dates && Array.isArray(delivered.meta.dates) && delivered.meta.dates.length > 0) {
    const dates = explicitDateKeys(delivered.meta.dates);
    if (!dates) throw new Error('The delivery has an invalid date snapshot');
    return dates;
  }
  // No historical snapshot: retain the legacy current-span compatibility path.
  return null;
}

export function detectConflictForStaffingDates(context: ConflictContext, dates: string[] | null): ConflictResult {
  if (dates === null) return detectConflictForAssignment(context);
  for (const date of dates) {
    const conflict = detectConflictForAssignment({ ...context, targetDate: date });
    if (conflict.conflict) return conflict;
  }
  return { conflict: false };
}

/** Omit legacy scope fields on extensions, avoiding prep-day trigger side effects. */
export function getNewMembershipScope(existing: { status?: string | null } | null, dates: string[] | null): { single_day?: boolean; assignment_date?: string | null } {
  if (existing?.status === 'confirmed') return {};
  return dates?.length === 1
    ? { single_day: true, assignment_date: dates[0] }
    : { single_day: false, assignment_date: null };
}

export function buildStaffingTimesheets(jobId: string, technicianId: string, dates: string[], isScheduleOnly: boolean) {
  return dates.map(date => ({ job_id: jobId, technician_id: technicianId, date, is_schedule_only: isScheduleOnly, source: 'staffing', is_active: true }));
}

export async function persistStaffingMembership(client: SupabaseClient, jobId: string, technicianId: string, existing: { status?: string | null } | null, dates: string[] | null, details: Record<string, unknown>) {
  if (existing?.status === 'confirmed') {
    // Even an unchanged status/job_id/technician_id in an UPSERT fires the prep
    // trigger. Extend confirmed membership without touching any trigger columns.
    const { data, error } = await client.from('job_assignments').update(details)
      .eq('job_id', jobId).eq('technician_id', technicianId).eq('status', 'confirmed').select('id').maybeSingle();
    return { error: error ?? (data ? null : { message: 'Assignment changed during confirmation' }) };
  }
  return await client.from('job_assignments').upsert({
    job_id: jobId, technician_id: technicianId, status: 'confirmed',
    ...getNewMembershipScope(existing, dates), ...details,
  }, { onConflict: 'job_id,technician_id' });
}

/** Compatibility only: old unscoped requests cannot recover their original dates. */
export function getLegacyStaffingSpanDates(start?: string | null, end?: string | null): string[] {
  if (!start || !end) return [];
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dates: string[] = [];
  const last = new Date(end);
  for (const day = new Date(start); day <= last; day.setDate(day.getDate() + 1)) dates.push(formatter.format(day));
  return dates;
}
