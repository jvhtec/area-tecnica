import { describe, expect, it } from 'vitest';

import {
  getTechnicalPowerSummaryAvailability,
  loadTechnicalPowerSummaryData,
} from '@/utils/powerSummaryData';

const createMockSupabase = (responses: Record<string, any[]>) =>
  ({
    from(table: string) {
      const filters: Array<{ type: 'eq' | 'in'; column: string; value: any }> = [];
      const rows = responses[table] || [];

      const applyFilters = () =>
        rows.filter((row) =>
          filters.every((filter) => {
            if (filter.type === 'eq') {
              return row[filter.column] === filter.value;
            }

            return filter.value.includes(row[filter.column]);
          })
        );

      const builder: any = {
        select: () => builder,
        eq: (column: string, value: any) => {
          filters.push({ type: 'eq', column, value });
          return builder;
        },
        in: (column: string, value: any[]) => {
          filters.push({ type: 'in', column, value });
          return builder;
        },
        order: () => builder,
        then: (resolve: (value: any) => void) =>
          Promise.resolve(resolve({ data: applyFilters(), error: null })),
      };

      return builder;
    },
  }) as any;

describe('powerSummaryData', () => {
  it('loads and aggregates standard job power tables by department', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-1',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'FoH',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          position: 'FOH',
          custom_position: null,
          includes_hoist: false,
        },
        {
          id: 'lights-1',
          job_id: 'job-1',
          department: 'lights',
          table_name: 'Dimmers',
          total_watts: 2000,
          current_per_phase: 8,
          pdu_type: '63A',
          custom_pdu_type: 'Custom 63A',
          position: null,
          custom_position: 'Custom Left',
          includes_hoist: true,
        },
        {
          id: 'video-1',
          job_id: 'job-1',
          department: 'video',
          table_name: 'LED',
          total_watts: 1500,
          current_per_phase: 6,
          pdu_type: '32A',
          custom_pdu_type: null,
          position: 'DSR',
          custom_position: null,
          includes_hoist: false,
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.totalWatts).toBe(1000);
    expect(summary.departments.sound.rows[0].positionLabel).toBe('FOH');
    expect(summary.departments.lights.rows[0].positionLabel).toBe('Custom Left');
    expect(summary.departments.lights.rows[0].notes).toContain('CEE32A');
    expect(summary.totalSystemWatts).toBe(4500);
    expect(summary.totalSystemAmps).toBe(18);
  });

  it('keeps only the newest saved job table when a department table was re-saved', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-old',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'MAIN L',
          total_watts: 31500,
          current_per_phase: 57.43,
          pdu_type: 'CEE125A 3P+N+G',
          custom_pdu_type: null,
          includes_hoist: false,
        },
        {
          id: 'sound-new',
          created_at: '2026-04-07T09:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'MAIN L',
          total_watts: 31500,
          current_per_phase: 57.43,
          pdu_type: 'CEE125A 3P+N+G',
          custom_pdu_type: null,
          includes_hoist: true,
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows).toHaveLength(1);
    expect(summary.departments.sound.rows[0].name).toBe('MAIN L');
    expect(summary.departments.sound.rows[0].notes).toContain('CEE32A');
  });

  it('prefers tour date overrides over defaults for tourdate jobs', async () => {
    const supabase = createMockSupabase({
      tour_date_power_overrides: [
        {
          id: 'override-sound',
          tour_date_id: 'tour-date-1',
          department: 'sound',
          table_name: 'Override FoH',
          total_watts: 1800,
          current_per_phase: 7,
          pdu_type: '32A',
          custom_pdu_type: null,
          position: 'USL',
          custom_position: null,
          includes_hoist: false,
          override_data: { rows: [], safetyMargin: 15, pf: 0.95 },
        },
      ],
      tour_power_defaults: [],
      tour_default_sets: [
        {
          id: 'set-sound',
          tour_id: 'tour-1',
          department: 'sound',
        },
      ],
      tour_default_tables: [
        {
          id: 'default-sound',
          set_id: 'set-sound',
          table_name: 'Default FoH',
          table_type: 'power',
          total_value: 1200,
          metadata: { current_per_phase: 5, pdu_type: '32A', pf: 0.95 },
          table_data: { rows: [] },
          created_at: '2026-04-07T08:00:00.000Z',
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: {
        id: 'job-tour',
        job_type: 'tourdate',
        tour_id: 'tour-1',
        tour_date_id: 'tour-date-1',
      },
      supabase,
    });

    expect(summary.departments.sound.rows[0].name).toBe('Override FoH');
    expect(summary.departments.sound.rows[0].positionLabel).toBe('USL');
    expect(summary.departments.sound.safetyMargin).toBe(15);
    expect(summary.departments.sound.rows[0].source).toBe('tour-override');
  });

  it('falls back to tour defaults and legacy defaults when no overrides exist', async () => {
    const supabase = createMockSupabase({
      tour_date_power_overrides: [],
      tour_power_defaults: [
        {
          id: 'legacy-video',
          tour_id: 'tour-1',
          department: 'video',
          table_name: 'Legacy LED',
          total_watts: 900,
          current_per_phase: 3,
          pdu_type: '16A',
          custom_pdu_type: null,
          position: null,
          custom_position: 'Video Custom',
          includes_hoist: false,
        },
      ],
      tour_default_sets: [
        {
          id: 'set-sound',
          tour_id: 'tour-1',
          department: 'sound',
        },
        {
          id: 'set-lights',
          tour_id: 'tour-1',
          department: 'lights',
        },
      ],
      tour_default_tables: [
        {
          id: 'default-sound',
          set_id: 'set-sound',
          table_name: 'Default FoH',
          table_type: 'power',
          total_value: 1200,
          metadata: { current_per_phase: 5, pdu_type: '32A', position: 'FOH', safetyMargin: 20, pf: 0.95 },
          table_data: { rows: [{ quantity: '1' }] },
          created_at: '2026-04-07T08:00:00.000Z',
        },
        {
          id: 'default-lights',
          set_id: 'set-lights',
          table_name: 'Default Dimmers',
          table_type: 'power',
          total_value: 2200,
          metadata: { current_per_phase: 9, pdu_type: '63A', pf: 0.9 },
          table_data: { rows: [{ quantity: '1' }] },
          created_at: '2026-04-07T08:00:00.000Z',
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: {
        id: 'job-tour',
        job_type: 'tourdate',
        tour_id: 'tour-1',
        tour_date_id: 'tour-date-1',
      },
      supabase,
    });

    expect(summary.departments.sound.rows[0].source).toBe('tour-default');
    expect(summary.departments.sound.rows[0].positionLabel).toBe('FOH');
    expect(summary.departments.sound.safetyMargin).toBe(20);
    expect(summary.departments.video.rows[0].positionLabel).toBe('Video Custom');
    expect(summary.departments.video.rows[0].source).toBe('legacy-tour-default');
    expect(summary.totalSystemWatts).toBe(4300);
  });

  it('treats legacy tour defaults with a null department as sound defaults', async () => {
    const supabase = createMockSupabase({
      tour_date_power_overrides: [],
      tour_power_defaults: [
        {
          id: 'legacy-sound',
          tour_id: 'tour-1',
          department: null,
          table_name: 'Legacy FoH',
          total_watts: 1200,
          current_per_phase: 5,
          pdu_type: '32A',
          custom_pdu_type: null,
          position: 'CSR',
          custom_position: null,
          includes_hoist: false,
        },
      ],
      tour_default_sets: [],
      tour_default_tables: [],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: {
        id: 'job-tour',
        job_type: 'tourdate',
        tour_id: 'tour-1',
        tour_date_id: 'tour-date-1',
      },
      supabase,
    });

    expect(summary.departments.sound.rows[0].name).toBe('Legacy FoH');
    expect(summary.departments.sound.rows[0].positionLabel).toBe('CSR');
    expect(summary.departments.sound.rows[0].source).toBe('legacy-tour-default');
  });

  it('uses job-specific tourdate tables before tour defaults when they exist', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'lights-job-table',
          job_id: 'job-tour',
          department: 'lights',
          table_name: 'Job Dimmers',
          total_watts: 2600,
          current_per_phase: 10,
          pdu_type: '63A',
          custom_pdu_type: null,
          includes_hoist: false,
        },
      ],
      tour_date_power_overrides: [],
      tour_power_defaults: [],
      tour_default_sets: [
        {
          id: 'set-lights',
          tour_id: 'tour-1',
          department: 'lights',
        },
      ],
      tour_default_tables: [
        {
          id: 'default-lights',
          set_id: 'set-lights',
          table_name: 'Default Dimmers',
          table_type: 'power',
          total_value: 2200,
          metadata: { current_per_phase: 9, pdu_type: '63A', pf: 0.9 },
          table_data: { rows: [{ quantity: '1' }] },
          created_at: '2026-04-07T08:00:00.000Z',
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: {
        id: 'job-tour',
        job_type: 'tourdate',
        tour_id: 'tour-1',
        tour_date_id: 'tour-date-1',
      },
      supabase,
    });

    expect(summary.departments.lights.rows[0].name).toBe('Job Dimmers');
    expect(summary.departments.lights.rows[0].source).toBe('job');
    expect(summary.departments.lights.totalWatts).toBe(2600);
  });

  it('resolves the tour id from the tour date when only defaults exist', async () => {
    const supabase = createMockSupabase({
      tour_dates: [
        {
          id: 'tour-date-1',
          tour_id: 'tour-1',
        },
      ],
      power_requirement_tables: [],
      tour_date_power_overrides: [],
      tour_power_defaults: [],
      tour_default_sets: [
        {
          id: 'set-sound',
          tour_id: 'tour-1',
          department: 'sound',
        },
      ],
      tour_default_tables: [
        {
          id: 'default-sound',
          set_id: 'set-sound',
          table_name: 'Default FoH',
          table_type: 'power',
          total_value: 1200,
          metadata: { current_per_phase: 5, pdu_type: '32A', safetyMargin: 20, pf: 0.95 },
          table_data: { rows: [{ quantity: '1' }] },
          created_at: '2026-04-07T08:00:00.000Z',
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: {
        id: 'job-tour',
        job_type: 'tourdate',
        tour_date_id: 'tour-date-1',
      },
      supabase,
    });

    expect(summary.departments.sound.rows[0].name).toBe('Default FoH');
    expect(summary.departments.sound.rows[0].source).toBe('tour-default');
    expect(summary.departments.sound.safetyMargin).toBe(20);
  });

  it('reports missing departments based on actual summary rows', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-1',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'FoH',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
        },
        {
          id: 'video-1',
          job_id: 'job-1',
          department: 'video',
          table_name: 'LED',
          total_watts: 1500,
          current_per_phase: 6,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(getTechnicalPowerSummaryAvailability(summary)).toEqual({
      ready: false,
      requiredDepartments: ['sound', 'lights', 'video'],
      availableDepartments: ['sound', 'video'],
      missingDepartments: ['lights'],
    });
  });

  it('treats uninvolved departments as optional when required departments are provided', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-1',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'FoH',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
        },
        {
          id: 'lights-1',
          job_id: 'job-1',
          department: 'lights',
          table_name: 'Dimmers',
          total_watts: 2000,
          current_per_phase: 8,
          pdu_type: '63A',
          custom_pdu_type: null,
          includes_hoist: false,
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(
      getTechnicalPowerSummaryAvailability(summary, ['sound', 'lights'])
    ).toEqual({
      ready: true,
      requiredDepartments: ['sound', 'lights'],
      availableDepartments: ['sound', 'lights'],
      missingDepartments: [],
    });
  });
});
