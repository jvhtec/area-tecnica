import { isAdminRole, isAdministrativeDepartment, isDepartmentManagementRole, normalizeDepartmentKey } from '@/utils/permissions';

interface TechnicianDepartmentRow {
  id: string;
  department?: string | null;
}

export const getVisibleFinancialTechnicianIds = (
  technicians: TechnicianDepartmentRow[],
  userRole?: string | null,
  userDepartment?: string | null,
  viewerId?: string | null,
): string[] | null => {
  if (!technicians.length) return [];

  if (
    isAdminRole(userRole)
    || userRole === 'logistics'
    || (isDepartmentManagementRole(userRole) && isAdministrativeDepartment(userDepartment))
  ) {
    return null;
  }

  if (!isDepartmentManagementRole(userRole)) {
    return viewerId ? [viewerId] : [];
  }

  const normalizedViewerDepartment = normalizeDepartmentKey(userDepartment);
  if (!normalizedViewerDepartment) {
    return [];
  }

  return technicians
    .filter((technician) => normalizeDepartmentKey(technician.department) === normalizedViewerDepartment)
    .map((technician) => technician.id);
};
