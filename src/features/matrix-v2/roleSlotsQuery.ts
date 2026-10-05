import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { queryKeys } from '@/lib/react-query';
import { STAFFING_SUMMARY_SCOPE } from '@/features/matrix-v2/pairPatch';
import {
  buildJobRoleSlots,
  type RoleSlot,
  type RoleSlotAssignmentRow,
  type RoleSlotSummaryRow,
} from '@/features/matrix-v2/roleSlots';

/**
 * What each job asks for and who holds it. One query serves the "outstanding
 * staffing" reminder and the Matrix's role-slot bar; the runner keeps it in
 * step with every command, so the bar changes the moment a technician is
 * assigned.
 */
export interface StaffingSummaryData {
  summaries: RoleSlotSummaryRow[];
  assignments: Array<RoleSlotAssignmentRow & {
    sound_role: string | null;
    lights_role: string | null;
    video_role: string | null;
    production_role: string | null;
    status: string | null;
  }>;
}

export const staffingSummaryQueryKey = (jobIdsKey: string) => queryKeys.scope(STAFFING_SUMMARY_SCOPE, jobIdsKey);

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

function parseSummaryRow(row: unknown): RoleSlotSummaryRow | null {
  if (typeof row !== 'object' || row === null) return null;
  const jobId = 'job_id' in row ? text(row.job_id) : null;
  const department = 'department' in row ? text(row.department) : null;
  if (!jobId || !department) return null;
  const rawRoles = 'roles' in row && Array.isArray(row.roles) ? row.roles : [];
  const roles = rawRoles.flatMap((role: unknown) => {
    if (typeof role !== 'object' || role === null) return [];
    const code = 'role_code' in role ? text(role.role_code) : null;
    if (!code) return [];
    return [{ role_code: code, quantity: Number('quantity' in role ? role.quantity : 0) || 0 }];
  });
  return { job_id: jobId, department, roles };
}

export async function fetchStaffingSummary(jobIds: string[]): Promise<StaffingSummaryData> {
  if (jobIds.length === 0) return { summaries: [], assignments: [] };

  const [summaryRes, assignmentRows] = await Promise.all([
    supabase.from('job_required_roles_summary').select('job_id, department, roles').in('job_id', jobIds),
    // Every page: one response stops at PostgREST's max_rows, which would
    // undercount who already fills a role on a busy season.
    fetchAllPages((from, to) =>
      supabase
        .from('job_assignments')
        .select('job_id, technician_id, sound_role, lights_role, video_role, production_role, status')
        .in('job_id', jobIds)
        .order('job_id', { ascending: true })
        .order('technician_id', { ascending: true })
        .range(from, to)),
  ]);
  if (summaryRes.error) throw summaryRes.error;

  const summaries = (summaryRes.data ?? []).flatMap((row) => {
    const parsed = parseSummaryRow(row);
    return parsed ? [parsed] : [];
  });
  const assignments = assignmentRows
    .filter((row) => Boolean(row.job_id))
    .map((row) => ({
      job_id: row.job_id,
      technician_id: row.technician_id,
      sound_role: row.sound_role ? String(row.sound_role) : null,
      lights_role: row.lights_role ? String(row.lights_role) : null,
      video_role: row.video_role ? String(row.video_role) : null,
      production_role: row.production_role ? String(row.production_role) : null,
      status: row.status ? String(row.status) : null,
    }));
  return { summaries, assignments };
}

/** Role slots per job from the shared staffing-summary data. */
export function useJobRoleSlots(data: StaffingSummaryData | undefined): Map<string, RoleSlot[]> {
  return useMemo(
    () => (data ? buildJobRoleSlots(data.summaries, data.assignments) : new Map<string, RoleSlot[]>()),
    [data],
  );
}
