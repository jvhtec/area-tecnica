/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { getDashboardPath } from '@/utils/roleBasedRouting';
import { UserRole } from '@/types/user';

describe('getDashboardPath', () => {
  describe('null/undefined role', () => {
    it('returns /profile for null role', () => {
      expect(getDashboardPath(null)).toBe('/profile');
    });

    it('returns /profile for undefined role', () => {
      expect(getDashboardPath(undefined as any)).toBe('/profile');
    });
  });

  describe('wallboard role', () => {
    it('returns /wallboard for wallboard role', () => {
      expect(getDashboardPath('wallboard')).toBe('/wallboard');
    });
  });

  describe('technician role', () => {
    it('returns /tech-app for technician role', () => {
      expect(getDashboardPath('technician')).toBe('/tech-app');
    });
  });

  describe('management roles', () => {
    it('returns /dashboard for admin role', () => {
      expect(getDashboardPath('admin')).toBe('/dashboard');
    });

    it('returns /dashboard for management role', () => {
      expect(getDashboardPath('management')).toBe('/dashboard');
    });

    it('returns /dashboard for logistics role', () => {
      expect(getDashboardPath('logistics')).toBe('/dashboard');
    });

    it('returns /dashboard for house_tech role', () => {
      expect(getDashboardPath('house_tech')).toBe('/dashboard');
    });

    it('returns /dashboard for oscar role', () => {
      expect(getDashboardPath('oscar')).toBe('/dashboard');
    });
  });

  describe('unknown roles', () => {
    it('returns /dashboard for unknown roles (fallback)', () => {
      expect(getDashboardPath('unknown' as UserRole)).toBe('/dashboard');
    });
  });
});
