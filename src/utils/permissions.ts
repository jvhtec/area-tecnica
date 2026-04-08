export type UserRole = string | null | undefined;
export type UserDepartment = string | null | undefined;

const ADMINISTRATIVE_DEPARTMENT_KEYS = new Set(['administrative', 'administracion']);
const PRODUCTION_DEPARTMENT_KEYS = new Set(['production', 'produccion']);
const PAYOUT_MANAGEMENT_DEPARTMENT_KEYS = new Set(['sound', 'lights', ...PRODUCTION_DEPARTMENT_KEYS, ...ADMINISTRATIVE_DEPARTMENT_KEYS]);

export const normalizeDepartmentKey = (value?: UserDepartment): string =>
  value
    ?.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? '';

export const isAdministrativeDepartment = (department?: UserDepartment): boolean =>
  ADMINISTRATIVE_DEPARTMENT_KEYS.has(normalizeDepartmentKey(department));

export const canManagePayouts = (role: UserRole, department?: UserDepartment): boolean =>
  role === 'admin' || (role === 'management' && PAYOUT_MANAGEMENT_DEPARTMENT_KEYS.has(normalizeDepartmentKey(department)));

export const isTechnicianRole = (role: UserRole) => role === 'technician' || role === 'house_tech';

export const canViewDetails = (_role: UserRole) => true;

export const canEditJobs = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canAssignPersonnel = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canUploadDocuments = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canDeleteDocuments = (role: UserRole) => ['admin', 'management'].includes(role || '');

export const canCreateFolders = (role: UserRole) => ['admin', 'management', 'logistics'].includes(role || '');

export const canManageFestivalArtists = (role: UserRole) => ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(role || '');

export const canUploadSoundVisionFiles = (role: UserRole) => ['admin', 'management', 'house_tech', 'technician', 'logistics'].includes(role || '');

export const canDeleteSoundVisionFiles = (role: UserRole) => ['admin', 'management'].includes(role || '');
