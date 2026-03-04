import { describe, expect, it } from 'vitest';
import { canManagePayouts, isAdministrativeDepartment, normalizeDepartmentKey } from './permissions';

describe('payout permissions', () => {
  it('allows admins regardless of department', () => {
    expect(canManagePayouts('admin', 'sound')).toBe(true);
    expect(canManagePayouts('admin', null)).toBe(true);
  });

  it('allows management only in administrative department aliases', () => {
    expect(canManagePayouts('management', 'administrative')).toBe(true);
    expect(canManagePayouts('management', 'administracion')).toBe(true);
    expect(canManagePayouts('management', 'Administración')).toBe(true);
    expect(canManagePayouts('management', 'sound')).toBe(false);
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
