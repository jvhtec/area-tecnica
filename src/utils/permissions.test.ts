import { describe, expect, it } from 'vitest';
import { canManagePayouts, isAdministrativeDepartment, normalizeDepartmentKey } from './permissions';

describe('payout permissions', () => {
  it('allows admins regardless of department or flag', () => {
    expect(canManagePayouts('admin', 'sound')).toBe(true);
    expect(canManagePayouts('admin', null)).toBe(true);
    expect(canManagePayouts('admin', 'sound', false)).toBe(true);
    expect(canManagePayouts('admin', null, undefined)).toBe(true);
  });

  it('allows users with canViewFinancials flag', () => {
    expect(canManagePayouts('management', 'sound', true)).toBe(true);
    expect(canManagePayouts('management', 'lights', true)).toBe(true);
    expect(canManagePayouts('management', 'video', true)).toBe(true);
    expect(canManagePayouts('logistics', 'sound', true)).toBe(true);
  });

  it('denies management without canViewFinancials flag', () => {
    expect(canManagePayouts('management', 'sound', false)).toBe(false);
    expect(canManagePayouts('management', 'lights')).toBe(false);
    expect(canManagePayouts('management', 'administrative', false)).toBe(false);
  });

  it('denies non-admin roles without the flag', () => {
    expect(canManagePayouts('logistics', 'administrative')).toBe(false);
    expect(canManagePayouts('house_tech', 'administrative', false)).toBe(false);
    expect(canManagePayouts('technician', 'sound')).toBe(false);
  });
});

describe('department normalization', () => {
  it('normalizes accented department names', () => {
    expect(normalizeDepartmentKey('Administración')).toBe('administracion');
    expect(isAdministrativeDepartment('Administración')).toBe(true);
  });
});
