import { describe, expect, it } from 'vitest';

import { getVisibleFinancialTechnicianIds } from '@/components/jobs/financialViewerScope';

const technicians = [
  { id: 'sound-1', department: 'sound' },
  { id: 'lights-1', department: 'lights' },
  { id: 'admin-1', department: 'administrative' },
];

describe('getVisibleFinancialTechnicianIds', () => {
  it('admins see all technicians regardless of flag', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'admin', 'sound')).toBeNull();
    expect(getVisibleFinancialTechnicianIds(technicians, 'admin', 'sound', false)).toBeNull();
    expect(getVisibleFinancialTechnicianIds(technicians, 'admin', null, undefined)).toBeNull();
  });

  it('users without canViewFinancials flag see nothing', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'sound')).toEqual([]);
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'sound', false)).toEqual([]);
    expect(getVisibleFinancialTechnicianIds(technicians, 'logistics', 'sound', false)).toEqual([]);
  });

  it('scopes department managers with flag to their own department technicians', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'sound', true)).toEqual(['sound-1']);
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'lights', true)).toEqual(['lights-1']);
  });

  it('lets administrative managers with flag see all technicians', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'administrative', true)).toBeNull();
  });

  it('lets logistics users with flag see all technicians', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'logistics', 'sound', true)).toBeNull();
  });

  it('returns an empty list when a scoped manager has no matching department', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'video', true)).toEqual([]);
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', null, true)).toEqual([]);
  });

  it('returns empty array for empty technicians list', () => {
    expect(getVisibleFinancialTechnicianIds([], 'admin', 'sound', true)).toEqual([]);
  });
});
