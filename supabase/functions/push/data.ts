import { createClient } from "./deps.ts";
import type { BroadcastBody, DepartmentRoleSummary } from "./types.ts";

export async function getManagementUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .in('role', ['admin','management','logistics']);
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

export async function getSoundDepartmentUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('department', 'sound');
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

export async function getManagementOnlyUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'management');
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

export async function getLogisticsManagementRecipients(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'management')
    .in('department', ['logistics', 'production']);
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

// Admin helpers and department-scoped management targeting
export async function getAdminUserIds(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

/**
 * Get admin users filtered by their staffing notification scope preference.
 * Returns admins who want all departments OR admins who want only their own department (if it matches).
 */
export async function getAdminUserIdsForStaffingNotifications(
  client: ReturnType<typeof createClient>,
  jobDepartment?: string | null
): Promise<string[]> {
  try {
    // Get all admin users with their department and notification preferences
    const { data: admins, error } = await client
      .from('profiles')
      .select(`
        id,
        department,
        notification_preferences!inner(staffing_scope)
      `)
      .eq('role', 'admin');

    if (error || !admins) {
      console.error('Failed to fetch admin notification preferences:', error);
      // Fallback: return all admins if query fails
      return await getAdminUserIds(client);
    }

    const relevantAdmins = admins.filter((admin: any) => {
      const prefs = admin.notification_preferences;
      // If no preferences set, default to all_departments
      if (!prefs || !prefs.length) return true;

      const staffingScope = prefs[0]?.staffing_scope;

      // If preference is all_departments or not set, include this admin
      if (!staffingScope || staffingScope === 'all_departments') return true;

      // If preference is own_department, only include if job department matches admin's department
      if (staffingScope === 'own_department') {
        return jobDepartment && admin.department === jobDepartment;
      }

      return false;
    });

    return relevantAdmins.map((admin: any) => admin.id).filter(Boolean);
  } catch (err) {
    console.error('Exception in getAdminUserIdsForStaffingNotifications:', err);
    // Fallback: return all admins if something goes wrong
    return await getAdminUserIds(client);
  }
}

export async function getManagementByDepartmentUserIds(client: ReturnType<typeof createClient>, department: string): Promise<string[]> {
  if (!department) return [];
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'management')
    .eq('department', department);
  if (error || !data) return [];
  return data.map((r: any) => r.id).filter(Boolean);
}

export async function getTimesheetSubmittingTechDepartment(
  client: ReturnType<typeof createClient>,
  jobId?: string | null,
  actorId?: string | null,
): Promise<string | null> {
  try {
    // Prefer actor's submitted timesheet for this job
    if (jobId && actorId) {
      const { data: anySubmitted } = await client
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('technician_id', actorId)
        .eq('status', 'submitted')
        .limit(1);
      if (anySubmitted && anySubmitted.length) {
        const { data: prof } = await client
          .from('profiles')
          .select('department')
          .eq('id', actorId)
          .maybeSingle();
        return (prof as any)?.department ?? null;
      }
    }

    // Fallback: latest submitted timesheet for the job, then resolve that tech's department
    if (jobId) {
      const { data: row } = await client
        .from('timesheets')
        .select('technician_id, updated_at')
        .eq('job_id', jobId)
        .eq('status', 'submitted')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const techId = (row as any)?.technician_id as string | undefined;
      if (techId) {
        const { data: prof } = await client
          .from('profiles')
          .select('department')
          .eq('id', techId)
          .maybeSingle();
        return (prof as any)?.department ?? null;
      }
    }
  } catch (_) {
    // ignore
  }
  // Last resort: try actor profile
  if (actorId) {
    try {
      const { data: prof } = await client
        .from('profiles')
        .select('department')
        .eq('id', actorId)
        .maybeSingle();
      return (prof as any)?.department ?? null;
    } catch (_) { /* ignore */ }
  }
  return null;
}

export async function getJobParticipantUserIds(client: ReturnType<typeof createClient>, jobId: string): Promise<string[]> {
  if (!jobId) return [];
  const { data, error } = await client
    .from('job_assignments')
    .select('technician_id')
    .eq('job_id', jobId);
  if (error || !data) return [];
  const ids = data.map((r: any) => r.technician_id).filter(Boolean);
  return Array.from(new Set(ids));
}

function parseDepartmentRoleSummary(raw: any): DepartmentRoleSummary | null {
  if (!raw) return null;
  const department = typeof raw.department === 'string' ? raw.department : '';
  if (!department) return null;
  const total = Number(raw.total_required ?? 0);
  const roles = Array.isArray(raw.roles)
    ? raw.roles
        .map((role: any) => ({
          role_code: typeof role?.role_code === 'string' ? role.role_code : '',
          quantity: Number(role?.quantity ?? 0),
          notes: role?.notes ?? null,
        }))
        .filter((role) => role.role_code)
    : [];
  return {
    department,
    total_required: Number.isFinite(total) ? total : 0,
    roles,
  };
}

export async function getJobRequiredRolesSummary(
  client: ReturnType<typeof createClient>,
  jobId?: string | null,
): Promise<DepartmentRoleSummary[]> {
  if (!jobId) return [];
  try {
    const { data, error } = await client
      .from('job_required_roles_summary')
      .select('department, total_required, roles')
      .eq('job_id', jobId);
    if (error || !data) {
      return [];
    }
    return (data || [])
      .map(parseDepartmentRoleSummary)
      .filter((item): item is DepartmentRoleSummary => Boolean(item));
  } catch (_) {
    return [];
  }
}

export function normalizeDepartmentRolesPayload(value: unknown): DepartmentRoleSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseDepartmentRoleSummary)
    .filter((item): item is DepartmentRoleSummary => Boolean(item));
}

export function formatDepartmentRolesSummary(summary: DepartmentRoleSummary[]): string {
  if (!summary || summary.length === 0) {
    return '';
  }

  const deptLabels: Record<string, string> = {
    sound: 'Sonido',
    lights: 'Iluminación',
    video: 'Vídeo',
    logistics: 'Logística',
    production: 'Producción',
  };

  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  return summary
    .map((item) => {
      const deptName = deptLabels[item.department] || capitalize(item.department);
      const rolesText = item.roles && item.roles.length
        ? item.roles.map((role) => `${role.role_code} (${role.quantity})`).join(', ')
        : 'Sin roles asignados';
      const total = Number(item.total_required ?? 0);
      return `• ${deptName}${Number.isFinite(total) ? ` (${total})` : ''}: ${rolesText}`;
    })
    .join('\n');
}

export async function getJobTitle(client: ReturnType<typeof createClient>, jobId?: string): Promise<string | null> {
  if (!jobId) return null;
  try {
    const { data, error } = await client.from('jobs').select('title').eq('id', jobId).maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch job title:', { jobId, error });
      return null;
    }
    return data?.title ?? null;
  } catch (err) {
    console.error('⚠️ Exception fetching job title:', { jobId, err });
    return null;
  }
}

export async function getJobDepartment(client: ReturnType<typeof createClient>, jobId?: string): Promise<string | null> {
  if (!jobId) return null;
  try {
    const { data, error } = await client.from('jobs').select('department').eq('id', jobId).maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch job department:', { jobId, error });
      return null;
    }
    return data?.department ?? null;
  } catch (err) {
    console.error('⚠️ Exception fetching job department:', { jobId, err });
    return null;
  }
}

export async function getJobType(client: ReturnType<typeof createClient>, jobId?: string): Promise<string | null> {
  if (!jobId) return null;
  try {
    const { data, error } = await client.from('jobs').select('job_type').eq('id', jobId).maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch job type:', { jobId, error });
      return null;
    }
    return data?.job_type ?? null;
  } catch (err) {
    console.error('⚠️ Exception fetching job type:', { jobId, err });
    return null;
  }
}

export async function getTourName(client: ReturnType<typeof createClient>, tourId?: string): Promise<string | null> {
  if (!tourId) return null;
  try {
    const { data, error } = await client.from('tours').select('name').eq('id', tourId).maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch tour name:', { tourId, error });
      return null;
    }
    return data?.name ?? null;
  } catch (err) {
    console.error('⚠️ Exception fetching tour name:', { tourId, err });
    return null;
  }
}

export async function getProfileDisplayName(client: ReturnType<typeof createClient>, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('first_name,last_name,nickname,email')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('⚠️ Failed to fetch profile display name:', { userId, error });
      return null;
    }
    if (!data) return null;
    const full = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    if (full) return full;
    if (data.nickname) return data.nickname;
    return data.email || null;
  } catch (err) {
    console.error('⚠️ Exception fetching profile display name:', { userId, err });
    return null;
  }
}

export async function resolveSoundVisionVenueName(
  client: ReturnType<typeof createClient>,
  body: BroadcastBody,
): Promise<string | null> {
  if (body.venue_name) return body.venue_name;

  try {
    if (body.venue_id) {
      const { data } = await client.from('venues').select('name').eq('id', body.venue_id).maybeSingle();
      if (data?.name) {
        return data.name as string;
      }
    }

    if (body.file_id) {
      const { data } = await client
        .from('soundvision_files')
        .select('venue:venues(name)')
        .eq('id', body.file_id)
        .maybeSingle();
      const venueName = (data as any)?.venue?.name as string | undefined;
      if (venueName) {
        return venueName;
      }
    }
  } catch (_) {
    // Ignore lookup failures and fall through to null default
  }

  return null;
}

