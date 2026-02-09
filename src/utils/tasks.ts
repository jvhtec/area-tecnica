import { UserRole, isTechnicianRole, canEditJobs } from "@/utils/permissions";

export type Dept = 'sound' | 'lights' | 'video' | 'production' | 'administrative';

/**
 * Normalize a department string to a canonical Dept value.
 * Returns null for unrecognized input.
 */
export function normalizeDept(value: string | null | undefined): Dept | null {
  const lower = (value || '').toLowerCase();
  if (lower === 'sound' || lower === 'sonido') return 'sound';
  if (lower === 'lights' || lower === 'luces') return 'lights';
  if (lower === 'video' || lower === 'vídeo') return 'video';
  if (lower === 'production' || lower === 'produccion' || lower === 'producción') return 'production';
  if (lower === 'administrative' || lower === 'administracion' || lower === 'administración') return 'administrative';
  return null;
}

export const isTechRole = (role: UserRole) => isTechnicianRole(role);

export const canCreateTasks = (role: UserRole) => {
  return ['admin', 'management', 'logistics', 'oscar'].includes((role || '').toString());
};

export const canEditTasks = (role: UserRole) => {
  return ['admin', 'management', 'logistics', 'oscar'].includes((role || '').toString());
};

export const canAssignTasks = (role: UserRole) => {
  return ['admin', 'management', 'logistics', 'oscar'].includes((role || '').toString());
};

export const canUpdateOwnTasks = (role: UserRole) => {
  // Techs can update status/progress on assigned tasks
  return isTechnicianRole(role) || canEditJobs(role);
};
