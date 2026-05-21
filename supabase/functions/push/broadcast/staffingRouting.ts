import type { createClient } from "../deps.ts";
import type { BroadcastBody, PushNotificationRoute } from "../types.ts";
import {
  getAdminUserIdsForStaffingNotifications,
  getManagementByDepartmentUserIds,
  lookupTechnicianDepartment,
} from "../data.ts";

type BroadcastClient = ReturnType<typeof createClient>;

export function isStaffingEventCode(type: string): boolean {
  return type.startsWith("staffing.");
}

function normalizeDepartment(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

export async function resolveStaffingDepartment(
  client: BroadcastClient,
  body: BroadcastBody,
  fallbackJobDepartment?: string | null,
): Promise<string | null> {
  const bodyDepartment = normalizeDepartment(body.department);
  if (bodyDepartment) return bodyDepartment;

  const technicianId = body.recipient_id || body.technician_id;
  if (technicianId) {
    const result = await lookupTechnicianDepartment(client, technicianId);
    const technicianDepartment = normalizeDepartment(result.department);
    if (technicianDepartment) return technicianDepartment;
  }

  return normalizeDepartment(fallbackJobDepartment);
}

export async function getStaffingRoutingManagementIds(
  client: BroadcastClient,
  department: string | null,
): Promise<string[]> {
  const scopedDepartment = normalizeDepartment(department);
  if (!scopedDepartment) return [];

  const [departmentManagement, relevantAdmins] = await Promise.all([
    getManagementByDepartmentUserIds(client, scopedDepartment),
    getAdminUserIdsForStaffingNotifications(client, scopedDepartment),
  ]);

  return Array.from(new Set([...departmentManagement, ...relevantAdmins]));
}

export async function filterStaffingRoutesForDepartment(
  client: BroadcastClient,
  routes: PushNotificationRoute[],
  department: string | null,
): Promise<PushNotificationRoute[]> {
  if (!routes.length) return routes;

  const scopedDepartment = normalizeDepartment(department);
  if (!scopedDepartment) {
    return routes.filter((route) =>
      route.recipient_type === "natural" ||
      route.recipient_type === "assigned_technicians"
    );
  }

  const targetedManagementUserIds = Array.from(new Set(
    routes
      .filter((route) => route.recipient_type === "management_user" && route.target_id)
      .map((route) => route.target_id as string),
  ));

  const managementUsersInScope = new Set<string>();
  if (targetedManagementUserIds.length > 0) {
    const { data, error } = await client
      .from("profiles")
      .select("id, department")
      .in("id", targetedManagementUserIds);

    if (error) {
      console.error("[push/broadcast] Failed to scope staffing management_user routes", {
        department: scopedDepartment,
        error,
      });
    } else {
      for (const profile of data || []) {
        if (normalizeDepartment((profile as any).department) === scopedDepartment) {
          managementUsersInScope.add((profile as any).id);
        }
      }
    }
  }

  return routes.filter((route) => {
    if (route.recipient_type === "department") {
      return normalizeDepartment(route.target_id) === scopedDepartment;
    }

    if (route.recipient_type === "management_user" && route.target_id) {
      return managementUsersInScope.has(route.target_id);
    }

    return true;
  });
}
