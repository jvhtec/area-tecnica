import { describe, expect, it } from 'vitest';
import {
  canManagePayouts,
  hasTechnicianSelfServiceAccess,
  isAdministrativeDepartment,
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
