import { describe, expect, it } from 'vitest';
import {
  canAccessDashboard,
  canAccessDisponibilidad,
  canAccessExpenses,
  canAccessProjectManagement,
  canAccessSoundVision,
  canDeleteDocuments,
  canDeleteSoundVisionFiles,
  canDeleteTourDocuments,
  canManagePayouts,
  canPrintFestivalDocuments,
  canReceiveMorningSummary,
  canSubmitTechnicianIncidentReports,
  canUseCustomFolderStructure,
  canUseHouseTechCalendar,
  canUseProfileCalendarSubscription,
  canUseTechnicianSelfTools,
  canUploadDocuments,
  canUploadTourDocuments,
  canViewAchievements,
  canViewPendingExpenses,
  canViewProfilePushControls,
  hasTechnicianSelfServiceAccess,
  isAdminRole,
  isAdministrativeDepartment,
  isDepartmentManagementRole,
  isManagementRole,
  normalizeDepartmentKey,
} from './permissions';

describe('payout permissions', () => {
  it('allows admins regardless of department', () => {
    expect(canManagePayouts('admin', 'sound')).toBe(true);
    expect(canManagePayouts('admin', null)).toBe(true);
  });

  it('allows management only in sound, lights, and administrative department aliases', () => {
    expect(canManagePayouts('management', 'sound')).toBe(true);
    expect(canManagePayouts('management', 'lights')).toBe(true);
    expect(canManagePayouts('management', 'administrative')).toBe(true);
    expect(canManagePayouts('management', 'administracion')).toBe(true);
    expect(canManagePayouts('management', 'Administración')).toBe(true);
    expect(canManagePayouts('management', 'video')).toBe(false);
  });

  it('denies non-admin non-management roles', () => {
    expect(canManagePayouts('logistics', 'administrative')).toBe(false);
    expect(canManagePayouts('house_tech', 'administrative')).toBe(false);
  });
});

describe('department normalization', () => {
  it('normalizes accented department names', () => {
    expect(normalizeDepartmentKey('Administración')).toBe('administracion');
    expect(isAdministrativeDepartment('Administración')).toBe(true);
  });
});

describe('technician self-service access', () => {
  it('allows technician roles and assignable admin/management users', () => {
    expect(hasTechnicianSelfServiceAccess('technician')).toBe(true);
    expect(hasTechnicianSelfServiceAccess('house_tech')).toBe(true);
    expect(hasTechnicianSelfServiceAccess('management', true)).toBe(true);
    expect(hasTechnicianSelfServiceAccess('admin', true)).toBe(true);
  });

  it('denies non-assignable privileged users and unrelated roles', () => {
    expect(hasTechnicianSelfServiceAccess('management', false)).toBe(false);
    expect(hasTechnicianSelfServiceAccess('admin', false)).toBe(false);
    expect(hasTechnicianSelfServiceAccess('logistics', true)).toBe(false);
  });
});

describe('management role helpers', () => {
  it('identifies admin and management roles', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('management')).toBe(false);
    expect(isManagementRole('admin')).toBe(true);
    expect(isManagementRole('management')).toBe(true);
    expect(isManagementRole('logistics')).toBe(false);
    expect(isManagementRole(null)).toBe(false);
    expect(isDepartmentManagementRole('management')).toBe(true);
    expect(isDepartmentManagementRole('admin')).toBe(false);
  });

  it('reuses the shared management predicate for document delete permissions', () => {
    expect(canDeleteDocuments('admin')).toBe(true);
    expect(canDeleteDocuments('management')).toBe(true);
    expect(canDeleteSoundVisionFiles('admin')).toBe(true);
    expect(canDeleteSoundVisionFiles('management')).toBe(true);
    expect(canDeleteDocuments('logistics')).toBe(false);
  });

  it('allows house tech calendar access to house tech and management roles', () => {
    expect(canUseHouseTechCalendar('house_tech')).toBe(true);
    expect(canUseHouseTechCalendar('management')).toBe(true);
    expect(canUseHouseTechCalendar('admin')).toBe(true);
    expect(canUseHouseTechCalendar('technician')).toBe(false);
    expect(canUseProfileCalendarSubscription('technician')).toBe(true);
  });

  it('centralizes dashboard, expenses, and project access predicates', () => {
    expect(canAccessDashboard('admin')).toBe(true);
    expect(canAccessDashboard('management')).toBe(true);
    expect(canAccessDashboard('logistics')).toBe(true);
    expect(canAccessDashboard('oscar')).toBe(true);
    expect(canAccessDashboard('technician')).toBe(false);
    expect(canAccessExpenses('management')).toBe(true);
    expect(canAccessExpenses('logistics')).toBe(true);
    expect(canAccessExpenses('house_tech')).toBe(false);
    expect(canAccessProjectManagement('admin')).toBe(true);
    expect(canAccessProjectManagement('logistics')).toBe(true);
    expect(canViewPendingExpenses('logistics')).toBe(true);
  });

  it('centralizes department-gated availability and SoundVision predicates', () => {
    expect(canAccessDisponibilidad('admin', null)).toBe(true);
    expect(canAccessDisponibilidad('management', 'sound')).toBe(true);
    expect(canAccessDisponibilidad('management', 'lights')).toBe(true);
    expect(canAccessDisponibilidad('management', 'video')).toBe(false);
    expect(canAccessDisponibilidad('technician', 'sound')).toBe(false);
    expect(canAccessSoundVision('technician', 'sound')).toBe(true);
    expect(canAccessSoundVision('house_tech', 'lights')).toBe(false);
    expect(canAccessSoundVision('logistics', null, true)).toBe(true);
  });

  it('centralizes custom folder structure permissions', () => {
    expect(canUseCustomFolderStructure('admin')).toBe(true);
    expect(canUseCustomFolderStructure('management')).toBe(true);
    expect(canUseCustomFolderStructure('logistics')).toBe(false);
    expect(canUseTechnicianSelfTools('management', true)).toBe(true);
    expect(canUseTechnicianSelfTools('technician', true)).toBe(false);
  });

  it('centralizes document and festival print permissions', () => {
    expect(canUploadDocuments('logistics')).toBe(true);
    expect(canUploadTourDocuments('technician')).toBe(true);
    expect(canUploadTourDocuments('house_tech')).toBe(true);
    expect(canDeleteTourDocuments('logistics')).toBe(true);
    expect(canPrintFestivalDocuments('management')).toBe(true);
    expect(canPrintFestivalDocuments('technician')).toBe(false);
  });

  it('centralizes profile and incident-report visibility predicates', () => {
    expect(canViewAchievements('technician')).toBe(true);
    expect(canViewAchievements('admin')).toBe(true);
    expect(canReceiveMorningSummary('house_tech')).toBe(true);
    expect(canReceiveMorningSummary('logistics')).toBe(false);
    expect(canViewProfilePushControls('oscar')).toBe(true);
    expect(canViewProfilePushControls('logistics')).toBe(false);
    expect(canSubmitTechnicianIncidentReports('technician')).toBe(true);
    expect(canSubmitTechnicianIncidentReports('house_tech')).toBe(false);
  });
});
