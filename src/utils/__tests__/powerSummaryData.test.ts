import { describe, expect, it } from 'vitest';

import {
  formatPowerRequirementsText,
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
    // Compatible 3φ supplies aggregate by ΣP/ΣQ, never by adding row currents.
    expect(summary.totalSystemAmps).toBeCloseTo(7.1218, 3);
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
          table_data: { rows: [{ quantity: '1', componentId: '1', watts: '31500' }] },
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
          table_data: { rows: [{ quantity: '1', componentId: '1', watts: '31500' }] },
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

  it('keeps only the newest same-name generation when a corrected table changes rows', async () => {
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
          table_data: {
            sourceTableId: '1744012800000',
            rows: [{ quantity: '1', componentId: '1', watts: '31500' }],
          },
        },
        {
          id: 'sound-new',
          created_at: '2026-04-07T09:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'MAIN L',
          total_watts: 29000,
          current_per_phase: 52.9,
          pdu_type: 'CEE63A 3P+N+G',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            sourceTableId: '1744016400000',
            rows: [{ quantity: '1', componentId: '1', watts: '29000' }],
          },
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows).toHaveLength(1);
    expect(summary.departments.sound.rows[0].totalWatts).toBe(29000);
    expect(summary.departments.sound.rows[0].pduLabel).toBe('CEE63A 3P+N+G');
  });

  it('uses input order instead of lexicographic ids to break duplicate save freshness ties', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'z-old-id',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'MAIN L',
          total_watts: 31500,
          current_per_phase: 57.43,
          pdu_type: 'CEE125A 3P+N+G',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: { rows: [{ quantity: '1', componentId: '1', watts: '31500' }] },
        },
        {
          id: 'a-new-id',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'MAIN L',
          total_watts: 31500,
          current_per_phase: 57.43,
          pdu_type: 'CEE125A 3P+N+G',
          custom_pdu_type: null,
          includes_hoist: true,
          table_data: { rows: [{ quantity: '1', componentId: '1', watts: '31500' }] },
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows).toHaveLength(1);
    expect(summary.departments.sound.rows[0].notes).toContain('CEE32A');
  });

  it('keeps different legacy sets separate for the same department and stage', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-stage-1',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'Main PA',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          position: 'Stage 1',
          custom_position: null,
          includes_hoist: false,
          table_data: {
            sourceTableId: 'stage-1-table',
            rows: [{ quantity: '1', componentId: '1', watts: '1000' }],
          },
        },
        {
          id: 'sound-stage-2',
          created_at: '2026-04-07T08:05:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'Side PA',
          total_watts: 1200,
          current_per_phase: 5,
          pdu_type: '32A',
          custom_pdu_type: null,
          position: 'Stage 2',
          custom_position: null,
          includes_hoist: false,
          table_data: {
            sourceTableId: 'stage-2-table',
            rows: [{ quantity: '1', componentId: '1', watts: '1000' }],
          },
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows).toHaveLength(2);
    expect(summary.departments.sound.rows.map((row) => row.name)).toEqual([
      'Main PA',
      'Side PA',
    ]);
  });

  it('keeps every row from the latest timestamped generation for a department and stage', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-old-main',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'Old Main',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            generationTimestamp: '2026-04-07T08:00:00.000Z',
            sourceTableId: 'old-main',
            rows: [{ quantity: '1', componentId: '1', watts: '1000' }],
          },
        },
        {
          id: 'sound-old-delay',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'Old Delay',
          total_watts: 1200,
          current_per_phase: 5,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            generationTimestamp: '2026-04-07T08:00:00.000Z',
            sourceTableId: 'old-delay',
            rows: [{ quantity: '1', componentId: '1', watts: '1200' }],
          },
        },
        {
          id: 'sound-new-main',
          created_at: '2026-04-07T09:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'Main PA',
          total_watts: 3000,
          current_per_phase: 12,
          pdu_type: '63A',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            generationTimestamp: '2026-04-07T09:00:00.000Z',
            sourceTableId: 'new-main',
            rows: [{ quantity: '1', componentId: '1', watts: '3000' }],
          },
        },
        {
          id: 'sound-new-delay',
          created_at: '2026-04-07T09:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'Delay PA',
          total_watts: 2000,
          current_per_phase: 8,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: true,
          table_data: {
            generationTimestamp: '2026-04-07T09:00:00.000Z',
            sourceTableId: 'new-delay',
            rows: [{ quantity: '1', componentId: '1', watts: '2000' }],
          },
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows).toHaveLength(2);
    expect(summary.departments.sound.rows.map((row) => row.name)).toEqual([
      'Main PA',
      'Delay PA',
    ]);
    expect(summary.departments.sound.totalWatts).toBe(5000);
    expect(summary.departments.sound.rows[1].notes).toContain('CEE32A');
  });

  it('keeps same saved table identity separate per festival stage', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-stage-1',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          stage_number: 1,
          stage_name: 'Main Stage',
          table_name: 'Main PA',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            sourceTableId: 'same-local-table-id',
            rows: [{ quantity: '1', componentId: '1', watts: '1000' }],
          },
        },
        {
          id: 'sound-stage-2',
          created_at: '2026-04-07T08:05:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          stage_number: 2,
          stage_name: 'Club Stage',
          table_name: 'Main PA',
          total_watts: 1200,
          current_per_phase: 5,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            sourceTableId: 'same-local-table-id',
            rows: [{ quantity: '1', componentId: '1', watts: '1000' }],
          },
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows).toHaveLength(2);
    expect(summary.departments.sound.rows.map((row) => row.stageName)).toEqual([
      'Main Stage',
      'Club Stage',
    ]);
  });

  it('includes stage labels in hoja de ruta power text', () => {
    expect(
      formatPowerRequirementsText([
        {
          id: 'sound-stage-1',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          stage_number: 1,
          stage_name: 'Main Stage',
          table_name: 'Main PA',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          custom_position: null,
          position: null,
          includes_hoist: false,
          table_data: { rows: [] },
        } as any,
      ])
    ).toContain('SOUND - Main Stage - Main PA:');
  });

  it('formats only the latest same-name generation in hoja de ruta power text', () => {
    const text = formatPowerRequirementsText([
      {
        id: 'sound-old',
        created_at: '2026-04-07T08:00:00.000Z',
        job_id: 'job-1',
        department: 'sound',
        stage_number: null,
        stage_name: null,
        table_name: 'MAIN L',
        total_watts: 31500,
        current_per_phase: 57.43,
        pdu_type: 'CEE125A 3P+N+G',
        custom_pdu_type: null,
        custom_position: null,
        position: null,
        includes_hoist: false,
        table_data: {
          sourceTableId: '1744012800000',
          rows: [{ quantity: '1', componentId: '1', watts: '31500' }],
        },
      } as any,
      {
        id: 'sound-new',
        created_at: '2026-04-07T09:00:00.000Z',
        job_id: 'job-1',
        department: 'sound',
        stage_number: null,
        stage_name: null,
        table_name: 'MAIN L',
        total_watts: 29000,
        current_per_phase: 52.9,
        pdu_type: 'CEE63A 3P+N+G',
        custom_pdu_type: null,
        custom_position: null,
        position: null,
        includes_hoist: false,
        table_data: {
          sourceTableId: '1744016400000',
          rows: [{ quantity: '1', componentId: '1', watts: '29000' }],
        },
      } as any,
    ]);

    expect(text).toContain('Potencia Total: 29000.00W');
    expect(text).not.toContain('Potencia Total: 31500.00W');
  });

  it('formats every row from the latest timestamped generation in hoja de ruta power text', () => {
    const text = formatPowerRequirementsText([
      {
        id: 'sound-old-main',
        created_at: '2026-04-07T08:00:00.000Z',
        job_id: 'job-1',
        department: 'sound',
        stage_number: null,
        stage_name: null,
        table_name: 'Old Main',
        total_watts: 1000,
        current_per_phase: 4,
        pdu_type: '32A',
        custom_pdu_type: null,
        custom_position: null,
        position: null,
        includes_hoist: false,
        table_data: {
          generationTimestamp: '2026-04-07T08:00:00.000Z',
          rows: [],
        },
      } as any,
      {
        id: 'sound-new-main',
        created_at: '2026-04-07T09:00:00.000Z',
        job_id: 'job-1',
        department: 'sound',
        stage_number: null,
        stage_name: null,
        table_name: 'Main PA',
        total_watts: 3000,
        current_per_phase: 12,
        pdu_type: '63A',
        custom_pdu_type: null,
        custom_position: null,
        position: null,
        includes_hoist: false,
        table_data: {
          generationTimestamp: '2026-04-07T09:00:00.000Z',
          rows: [],
        },
      } as any,
      {
        id: 'sound-new-delay',
        created_at: '2026-04-07T09:00:00.000Z',
        job_id: 'job-1',
        department: 'sound',
        stage_number: null,
        stage_name: null,
        table_name: 'Delay PA',
        total_watts: 2000,
        current_per_phase: 8,
        pdu_type: '32A',
        custom_pdu_type: null,
        custom_position: null,
        position: null,
        includes_hoist: false,
        table_data: {
          generationTimestamp: '2026-04-07T09:00:00.000Z',
          rows: [],
        },
      } as any,
    ]);

    expect(text).toContain('SOUND - Main PA:');
    expect(text).toContain('SOUND - Delay PA:');
    expect(text).not.toContain('Old Main');
  });

  it('keeps numeric stage zero when formatting hoja de ruta power text', () => {
    expect(
      formatPowerRequirementsText([
        {
          id: 'sound-stage-0',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          stage_number: 0,
          stage_name: null,
          table_name: 'Main PA',
          total_watts: 1000,
          current_per_phase: 4,
          pdu_type: '32A',
          custom_pdu_type: null,
          custom_position: null,
          position: null,
          includes_hoist: false,
          table_data: { rows: [] },
        } as any,
      ])
    ).toContain('SOUND - Stage 0 - Main PA:');
  });

  it('uses saved job table electrical settings when calculating apparent power', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'sound-1',
          created_at: '2026-04-07T08:00:00.000Z',
          job_id: 'job-1',
          department: 'sound',
          table_name: 'FoH',
          total_watts: 950,
          current_per_phase: 5,
          pdu_type: '32A',
          custom_pdu_type: null,
          includes_hoist: false,
          table_data: {
            pf: 0.95,
            safetyMargin: 20,
            rows: [{ quantity: '1', componentId: '1', watts: '950' }],
          },
        },
      ],
    });

    const summary = await loadTechnicalPowerSummaryData({
      job: { id: 'job-1', job_type: 'single' },
      supabase,
    });

    expect(summary.departments.sound.rows[0].totalVa).toBe(1200);
    expect(summary.departments.sound.totalKva).toBe(1.2);
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

  it('uses resolved package defaults instead of stale job snapshots for tourdate summaries', async () => {
    const supabase = createMockSupabase({
      power_requirement_tables: [
        {
          id: 'stale-sound-job-table',
          job_id: 'job-tour',
          department: 'sound',
          table_name: 'Stale Job FoH',
          total_watts: 4000,
          current_per_phase: 16,
          pdu_type: '63A',
          custom_pdu_type: null,
          includes_hoist: false,
        },
      ],
      tour_dates: [
        {
          id: 'tour-date-1',
          tour_id: 'tour-1',
          sound_package_size: 'l',
          is_tour_pack_only: false,
          sound_default_set_id: null,
          lights_default_set_id: null,
          video_default_set_id: null,
        },
      ],
      tour_date_power_overrides: [],
      tour_power_defaults: [],
      tour_default_sets: [
        {
          id: 'set-sound-l',
          tour_id: 'tour-1',
          department: 'sound',
          package_size: 'l',
        },
        {
          id: 'set-sound-s',
          tour_id: 'tour-1',
          department: 'sound',
          package_size: 's',
        },
      ],
      tour_default_tables: [
        {
          id: 'default-sound-l',
          set_id: 'set-sound-l',
          table_name: 'L FoH',
          table_type: 'power',
          total_value: 3000,
          metadata: { current_per_phase: 12, pdu_type: '63A', pf: 0.95 },
          table_data: { rows: [{ quantity: '1' }] },
          created_at: '2026-04-07T08:00:00.000Z',
        },
        {
          id: 'default-sound-s',
          set_id: 'set-sound-s',
          table_name: 'S FoH',
          table_type: 'power',
          total_value: 1000,
          metadata: { current_per_phase: 4, pdu_type: '32A', pf: 0.95 },
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

    expect(summary.departments.sound.rows.map((row) => row.name)).toEqual(['L FoH']);
    expect(summary.departments.sound.rows[0].source).toBe('tour-default');
    expect(summary.departments.sound.totalWatts).toBe(3000);
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
