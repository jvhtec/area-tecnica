import { isAdministrativeDepartment, normalizeDepartmentKey } from '@/utils/permissions';

interface TechnicianDepartmentRow {
  id: string;
  department?: string | null;
}

/**
 * Returns the technician IDs whose financial data the current user may see.
 *  - `null`  → unrestricted (see all)
 *  - `[]`    → no access
 *  - `[...]` → scoped to listed technicians
 */
export const getVisibleFinancialTechnicianIds = (
  technicians: TechnicianDepartmentRow[],
  userRole?: string | null,
  userDepartment?: string | null,
  canViewFinancials?: boolean,
): string[] | null => {
  if (!technicians.length) return [];

  // Admins always see everything
  if (userRole === 'admin') {
    return null;
  }

  // Non-admin users without explicit permission see nothing
  if (!canViewFinancials) {
    return [];
  }

  // Users with permission in logistics or administrative departments see all
  if (
    userRole === 'logistics'
    || isAdministrativeDepartment(userDepartment)
  ) {
    return null;
  }

  // Management users are scoped to their own department
  if (userRole === 'management') {
    const normalizedViewerDepartment = normalizeDepartmentKey(userDepartment);
    if (!normalizedViewerDepartment) {
      return [];
    }

    return technicians
      .filter((technician) => normalizeDepartmentKey(technician.department) === normalizedViewerDepartment)
      .map((technician) => technician.id);
  }

  // Other roles with the flag: unrestricted view
  return null;
};
