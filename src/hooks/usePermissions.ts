import { useMemo } from 'react';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import {
  canAccessDashboard,
  canAccessDisponibilidad,
  canAccessExpenses,
  canAccessProjectManagement,
  canAccessSoundVision,
  canAssignPersonnel,
  canCreateFolders,
  canDeleteDocuments,
  canDeleteSoundVisionFiles,
  canEditJobs,
  canManageFestivalArtists,
  canManagePayouts,
  canUploadDocuments,
  canUploadSoundVisionFiles,
  canUseHouseTechCalendar,
  canUseCustomFolderStructure,
  canViewPendingExpenses,
  hasTechnicianSelfServiceAccess,
  isAdminRole,
  isManagementRole,
  isTechnicianRole,
} from '@/utils/permissions';

export const usePermissions = () => {
  const { userRole, userDepartment, assignableAsTech } = useOptimizedAuth();

  return useMemo(() => ({
    userRole,
    userDepartment,
    isAdmin: isAdminRole(userRole),
    isManagement: isManagementRole(userRole),
    isTechnician: isTechnicianRole(userRole),
    canAccessDashboard: canAccessDashboard(userRole),
    canAccessDisponibilidad: canAccessDisponibilidad(userRole, userDepartment),
    canAccessExpenses: canAccessExpenses(userRole),
    canAccessProjectManagement: canAccessProjectManagement(userRole),
    canAccessSoundVision: canAccessSoundVision(userRole, userDepartment),
    canAssignPersonnel: canAssignPersonnel(userRole),
    canCreateFolders: canCreateFolders(userRole),
    canDeleteDocuments: canDeleteDocuments(userRole),
    canDeleteSoundVisionFiles: canDeleteSoundVisionFiles(userRole),
    canEditJobs: canEditJobs(userRole),
    canManageFestivalArtists: canManageFestivalArtists(userRole),
    canManagePayouts: canManagePayouts(userRole, userDepartment),
    canUploadDocuments: canUploadDocuments(userRole),
    canUploadSoundVisionFiles: canUploadSoundVisionFiles(userRole),
    canUseCustomFolderStructure: canUseCustomFolderStructure(userRole),
    canUseHouseTechCalendar: canUseHouseTechCalendar(userRole),
    canViewPendingExpenses: canViewPendingExpenses(userRole),
    hasTechnicianSelfServiceAccess: hasTechnicianSelfServiceAccess(userRole, assignableAsTech),
  }), [assignableAsTech, userDepartment, userRole]);
};
