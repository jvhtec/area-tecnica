import type { createClient } from "../deps.ts";
import {
  getAdminUserIdsForStaffingNotifications,
  getManagementByDepartmentUserIds,
  lookupTechnicianDepartment,
} from "../data.ts";

type BroadcastClient = ReturnType<typeof createClient>;

/**
 * Resolve department-scoped management + admin IDs for a technician.
 * Warns when the technician has no department set (notifications still go to
 * cross-department admins, but department managers are skipped).
 */
export async function getScopedManagementIds(
  client: BroadcastClient,
  technicianId: string | undefined,
  context?: string,
): Promise<string[]> {
  let techDepartment: string | null = null;

  if (technicianId) {
    const result = await lookupTechnicianDepartment(client, technicianId);
    techDepartment = result.department;

    if (!result.error && !techDepartment) {
      console.warn(
        `[push/broadcast] Technician ${technicianId} has no department set` +
          (context ? ` (context: ${context})` : '') +
          ' - department-scoped management recipients will be empty',
      );
    }
  }

  const deptMgmt = techDepartment
    ? await getManagementByDepartmentUserIds(client, techDepartment)
    : [];
  const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
  return [...new Set([...deptMgmt, ...relevantAdmins])];
}
