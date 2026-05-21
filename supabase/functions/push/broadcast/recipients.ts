import type { createClient } from "../deps.ts";
import {
  getAdminUserIdsForStaffingNotifications,
  getManagementAndAdminByDepartmentUserIds,
  getManagementByDepartmentUserIds,
  lookupTechnicianDepartment,
} from "../data.ts";

type BroadcastClient = ReturnType<typeof createClient>;
type ScopedManagementOptions = {
  includeCrossDepartmentAdmins?: boolean;
};

/**
 * Resolve department-scoped management + admin IDs for a technician.
 * Warns when the technician has no department set (notifications still go to
 * cross-department admins, but department managers are skipped).
 */
export async function getScopedManagementIds(
  client: BroadcastClient,
  technicianId: string | undefined,
  context?: string,
  departmentHint?: string | null,
  options: ScopedManagementOptions = {},
): Promise<string[]> {
  let techDepartment: string | null =
    typeof departmentHint === 'string' && departmentHint.trim().length > 0
      ? departmentHint.trim().toLowerCase()
      : null;

  if (!techDepartment && technicianId) {
    const result = await lookupTechnicianDepartment(client, technicianId);
    techDepartment = result.department?.trim().toLowerCase() || null;

    if (!result.error && !techDepartment) {
      console.warn(
        `[push/broadcast] Technician ${technicianId} has no department set` +
          (context ? ` (context: ${context})` : '') +
          ' - department-scoped management recipients will be empty',
      );
    }
  }

  if (options.includeCrossDepartmentAdmins === false) {
    return techDepartment
      ? await getManagementAndAdminByDepartmentUserIds(client, techDepartment)
      : [];
  }

  const deptMgmt = techDepartment
    ? await getManagementByDepartmentUserIds(client, techDepartment)
    : [];
  const relevantAdmins = await getAdminUserIdsForStaffingNotifications(client, techDepartment);
  return [...new Set([...deptMgmt, ...relevantAdmins])];
}
