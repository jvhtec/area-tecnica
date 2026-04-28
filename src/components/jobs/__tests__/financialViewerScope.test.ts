import { describe, expect, it } from 'vitest';

import { getVisibleFinancialTechnicianIds } from '@/components/jobs/financialViewerScope';

const technicians = [
  { id: 'sound-1', department: 'sound' },
  { id: 'lights-1', department: 'lights' },
  { id: 'admin-1', department: 'administrative' },
];

describe('getVisibleFinancialTechnicianIds', () => {
  it('scopes department managers to their own department technicians', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'sound')).toEqual(['sound-1']);
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'lights')).toEqual(['lights-1']);
  });

  it('lets administrative managers and admins see all technicians', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'administrative')).toBeNull();
    expect(getVisibleFinancialTechnicianIds(technicians, 'admin', 'sound')).toBeNull();
  });

  it('lets logistics users see all technicians in the expenses flow', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'logistics', 'sound')).toBeNull();
  });

  it('returns an empty list when a scoped manager has no matching department', () => {
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', 'video')).toEqual([]);
    expect(getVisibleFinancialTechnicianIds(technicians, 'management', null)).toEqual([]);
  });
});
