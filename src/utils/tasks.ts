import { UserRole, isTechnicianRole, canEditJobs } from "@/utils/permissions";

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
