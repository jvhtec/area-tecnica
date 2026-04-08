import { describe, expect, it } from 'vitest';

import {
  computePowerTotalVa,
  normalizeLegacyTourPowerDefault,
  normalizeTourDefaultPowerTable,
  normalizeTourPowerOverride,
} from '@/utils/tourPowerTables';

describe('tourPowerTables', () => {
  it('uses the stored power factor when it is within the valid range', () => {
    expect(computePowerTotalVa(950, { pf: 0.95 }, 'sound')).toBe(1000);
  });

  it('uses a stored power factor of 1 without falling back', () => {
    expect(computePowerTotalVa(1000, { pf: 1 }, 'sound')).toBe(1000);
  });

  it('falls back to the department default power factor when the stored value is invalid', () => {
    expect(computePowerTotalVa(950, { pf: 2 }, 'sound')).toBe(1000);
    expect(computePowerTotalVa(900, { pf: 0 }, 'video')).toBe(1000);
    expect(computePowerTotalVa(950, { pf: -1 }, 'sound')).toBe(1000);
  });

  it('returns zero when watts is zero', () => {
    expect(computePowerTotalVa(0, { pf: 0.5 }, 'sound')).toBe(0);
  });

  it('uses department defaults when metadata is null or undefined', () => {
    expect(computePowerTotalVa(950, null, 'sound')).toBe(1000);
    expect(computePowerTotalVa(900, undefined, 'video')).toBe(1000);
  });

  it('normalizes position metadata from new-format tour defaults', () => {
    const normalized = normalizeTourDefaultPowerTable(
      {
        id: 'default-1',
        set_id: 'set-1',
        table_name: 'Video Wall',
        table_type: 'power',
        total_value: 2200,
        metadata: {
          current_per_phase: 8,
          pdu_type: '63A',
          position: 'USL',
          custom_position: null,
        },
        table_data: { rows: [] },
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
      } as any,
      'video'
    );

    expect(normalized.position).toBe('USL');
    expect(normalized.customPosition).toBeUndefined();
  });

  it('normalizes custom positions from legacy defaults and overrides', () => {
    const legacy = normalizeLegacyTourPowerDefault(
      {
        id: 'legacy-1',
        tour_id: 'tour-1',
        table_name: 'Legacy FoH',
        total_watts: 1200,
        current_per_phase: 5,
        pdu_type: '32A',
        custom_pdu_type: null,
        position: null,
        custom_position: 'Front Delay',
        includes_hoist: false,
        department: 'sound',
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
      } as any,
      'sound'
    );

    const override = normalizeTourPowerOverride(
      {
        id: 'override-1',
        tour_date_id: 'date-1',
        table_name: 'Override Wall',
        total_watts: 1800,
        current_per_phase: 7,
        pdu_type: '32A',
        custom_pdu_type: null,
        position: 'DSR',
        custom_position: null,
        includes_hoist: false,
        department: 'video',
        override_data: { rows: [] },
        default_table_id: null,
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
      } as any,
      'video'
    );

    expect(legacy.customPosition).toBe('Front Delay');
    expect(override.position).toBe('DSR');
  });
});
