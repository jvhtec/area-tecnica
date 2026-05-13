import type { UserRole as AppUserRole } from '@/types/user';

export type UserRole = string | null | undefined;
export type UserDepartment = string | null | undefined;

export const MANAGEMENT_ALLOWED_ROLES: AppUserRole[] = ['admin', 'management'];
export const PROJECT_MANAGEMENT_ALLOWED_ROLES: AppUserRole[] = ['admin', 'management', 'logistics'];
export const DASHBOARD_ALLOWED_ROLES: AppUserRole[] = ['admin', 'management', 'logistics', 'oscar'];

const ADMINISTRATIVE_DEPARTMENT_KEYS = new Set(['administrative', 'administracion']);
const PRODUCTION_DEPARTMENT_KEYS = new Set(['production', 'produccion']);
const PAYOUT_MANAGEMENT_DEPARTMENT_KEYS = new Set(['sound', 'lights', ...PRODUCTION_DEPARTMENT_KEYS, ...ADMINISTRATIVE_DEPARTMENT_KEYS]);
const MANAGEMENT_ROLES = new Set(MANAGEMENT_ALLOWED_ROLES);
const DASHBOARD_ROLES = new Set(DASHBOARD_ALLOWED_ROLES);
const DISPONIBILIDAD_DEPARTMENTS = new Set(['sound', 'lights']);

export const normalizeDepartmentKey = (value?: UserDepartment): string =>
  value
    ?.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? '';

export const isAdministrativeDepartment = (department?: UserDepartment): boolean =>
  ADMINISTRATIVE_DEPARTMENT_KEYS.has(normalizeDepartmentKey(department));

export const isAdminRole = (role: UserRole): boolean => role === 'admin';

export const isManagementRole = (role: UserRole): boolean => MANAGEMENT_ROLES.has(role || '');

export const isDepartmentManagementRole = (role: UserRole): boolean => role === 'management';

export const canAccessDashboard = (role: UserRole): boolean => DASHBOARD_ROLES.has(role || '');

export const canAccessDisponibilidad = (role: UserRole, department?: UserDepartment): boolean =>
  isAdminRole(role) || (isDepartmentManagementRole(role) && DISPONIBILIDAD_DEPARTMENTS.has(normalizeDepartmentKey(department)));

export const canAccessExpenses = (role: UserRole): boolean =>
  isManagementRole(role) || role === 'logistics';

export const canAccessProjectManagement = (role: UserRole): boolean =>
  isManagementRole(role) || role === 'logistics';

export const canViewPendingExpenses = (role: UserRole): boolean =>
  canAccessExpenses(role);

export const canUseCustomFolderStructure = (role: UserRole): boolean => isManagementRole(role);

export const canAccessSoundVision = (
  role: UserRole,
  department?: UserDepartment,
  hasExplicitAccess = false,
): boolean => {
  const normalizedDepartment = normalizeDepartmentKey(department);
  return (
    hasExplicitAccess ||
    isManagementRole(role) ||
    ((role === 'house_tech' || role === 'technician') && normalizedDepartment === 'sound')
  );
};

export const canManagePayouts = (role: UserRole, department?: UserDepartment): boolean =>
  isAdminRole(role) || (isDepartmentManagementRole(role) && PAYOUT_MANAGEMENT_DEPARTMENT_KEYS.has(normalizeDepartmentKey(department)));

export const isTechnicianRole = (role: UserRole) => role === 'technician' || role === 'house_tech';

export const canUseHouseTechCalendar = (role: UserRole): boolean =>
  role === 'house_tech' || isManagementRole(role);

export const hasTechnicianSelfServiceAccess = (
  role: UserRole,
  assignableAsTech?: boolean | null,
): boolean =>
  role === 'technician' ||
  role === 'house_tech' ||
  (isManagementRole(role) && assignableAsTech === true);

export const canViewDetails = (_role: UserRole) => true;

export const canEditJobs = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canAssignPersonnel = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canUploadDocuments = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canDeleteDocuments = (role: UserRole) => isManagementRole(role);

export const canCreateFolders = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canManageFestivalArtists = (role: UserRole) => ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(role || '');

export const canUploadSoundVisionFiles = (role: UserRole) => ['admin', 'management', 'house_tech', 'technician', 'logistics'].includes(role || '');

export const canDeleteSoundVisionFiles = (role: UserRole) => isManagementRole(role);
