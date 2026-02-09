import { UserRole, isTechnicianRole, canEditJobs } from "@/utils/permissions";

export type Dept = 'sound' | 'lights' | 'video' | 'production' | 'administrative';

/**
 * Normalize a department string to a canonical Dept value.
 * Returns null for unrecognized input.
 */
export function normalizeDept(value: string | null | undefined): Dept | null {
  const raw = (value ?? '').toString().toLowerCase().trim();
  const lower = raw.endsWith('_warehouse') ? raw.slice(0, -'_warehouse'.length) : raw;

  if (lower === 'sound' || lower === 'sonido') return 'sound';
  if (lower === 'lights' || lower === 'luces') return 'lights';
  if (lower === 'video' || lower === 'vídeo') return 'video';
  if (lower === 'production' || lower === 'produccion' || lower === 'producción') return 'production';
  if (lower === 'administrative' || lower === 'administracion' || lower === 'administración') return 'administrative';
  return null;
}

/**
 * True when the provided role is a technician-like role.
 */
export const isTechRole = (role: UserRole) => isTechnicianRole(role);

/**
 * Permission gate for creating global tasks (non-tech coordinator roles).
 */
export const canCreateTasks = (role: UserRole) => {
  return ['admin', 'management', 'logistics', 'oscar'].includes((role || '').toString());
};

/**
 * Permission gate for editing global tasks (non-tech coordinator roles).
 */
export const canEditTasks = (role: UserRole) => {
  return ['admin', 'management', 'logistics', 'oscar'].includes((role || '').toString());
};

/**
 * Permission gate for assigning global tasks.
 */
export const canAssignTasks = (role: UserRole) => {
  return ['admin', 'management', 'logistics', 'oscar'].includes((role || '').toString());
};

/**
 * Permission gate for a user updating their own assigned tasks.
 */
export const canUpdateOwnTasks = (role: UserRole) => {
  // Techs can update status/progress on assigned tasks
  return isTechnicianRole(role) || canEditJobs(role);
};
