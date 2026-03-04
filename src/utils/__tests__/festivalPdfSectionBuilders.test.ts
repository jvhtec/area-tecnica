import { describe, expect, it } from 'vitest';
import {
  attachShiftAssignmentsAndProfiles,
  buildArtistTableArtists,
  buildInfrastructureArtists,
  sortArtistsChronologically,
} from '@/utils/pdf/festivalPdfSectionBuilders';

describe('festivalPdfSectionBuilders', () => {
  it('buildArtistTableArtists always provides technical shape', () => {
    const artists = buildArtistTableArtists([
      {
        name: 'Artist A',
        stage: 1,
        show_start: '20:00',
        show_end: '21:00',
      },
    ] as any);

    expect(artists).toHaveLength(1);
    expect(artists[0].technical).toBeDefined();
    expect(typeof artists[0].technical.fohTech).toBe('boolean');
    expect(typeof artists[0].technical.monTech).toBe('boolean');
  });

  it('buildInfrastructureArtists normalizes nested infra fields', () => {
    const artists = buildInfrastructureArtists([
      {
        name: 'Artist Infra',
        stage: 2,
        infrastructure_provided_by: 'festival',
        infra_cat6: true,
        infra_cat6_quantity: 4,
      },
    ] as any);

    expect(artists).toHaveLength(1);
    expect(artists[0].cat6.enabled).toBe(true);
    expect(artists[0].cat6.quantity).toBe(4);
    expect(artists[0].hma.enabled).toBe(false);
    expect(artists[0].opticalconDuo.quantity).toBe(0);
  });

  it('attachShiftAssignmentsAndProfiles merges profile and external technician names', () => {
    const shifts = [
      {
        id: 'shift-1',
        job_id: 'job-1',
        name: 'Morning',
        date: '2026-03-01',
        start_time: '10:00:00',
        end_time: '14:00:00',
        stage: 1,
      },
    ];

    const assignments = [
      {
        id: 'asg-1',
        shift_id: 'shift-1',
        technician_id: 'tech-1',
        role: 'FOH',
      },
      {
        id: 'asg-2',
        shift_id: 'shift-1',
        external_technician_name: 'External Tech',
        role: 'MON',
      },
    ];

    const profilesById = new Map([
      [
        'tech-1',
        {
          id: 'tech-1',
          first_name: 'Ana',
          last_name: 'Lopez',
          email: 'ana@example.com',
          department: 'sound',
          role: 'technician',
        },
      ],
    ]);

    const result = attachShiftAssignmentsAndProfiles(shifts as any, assignments as any, profilesById as any);
    expect(result).toHaveLength(1);
    expect(result[0].assignments).toHaveLength(2);
    expect(result[0].assignments[0].profiles?.first_name).toBe('Ana');
    expect(result[0].assignments[1].external_technician_name).toBe('External Tech');
  });

  it('sorts artists by day then show time, with stage as tie-breaker', () => {
    const sorted = sortArtistsChronologically([
      { name: 'S1 late', date: '2026-03-10', show_start: '21:00', stage: 1 },
      { name: 'S2 early', date: '2026-03-10', show_start: '20:00', stage: 2 },
      { name: 'S1 early', date: '2026-03-10', show_start: '20:00', stage: 1 },
      { name: 'Next day', date: '2026-03-11', show_start: '19:00', stage: 1 },
    ]);

    expect(sorted.map((artist) => artist.name)).toEqual([
      'S1 early',
      'S2 early',
      'S1 late',
      'Next day',
    ]);
  });

  it('places after-midnight shows after late-night shows on the same day', () => {
    const sorted = sortArtistsChronologically([
      { name: 'Late Night', date: '2026-03-10', show_start: '23:30', stage: 1 },
      { name: 'After Midnight', date: '2026-03-10', show_start: '01:00', stage: 2 },
      { name: 'Prime Time', date: '2026-03-10', show_start: '21:00', stage: 1 },
    ]);

    expect(sorted.map((artist) => artist.name)).toEqual([
      'Prime Time',
      'Late Night',
      'After Midnight',
    ]);
  });

  it('does not push late-night shows to end when after-midnight flag is true', () => {
    const sorted = sortArtistsChronologically([
      { name: 'Early AM', date: '2026-03-10', show_start: '01:00', stage: 1, isaftermidnight: true },
      { name: 'Late Night Flagged', date: '2026-03-10', show_start: '23:35', stage: 2, isaftermidnight: true },
      { name: 'Prime Time', date: '2026-03-10', show_start: '21:00', stage: 1, isaftermidnight: false },
    ]);

    expect(sorted.map((artist) => artist.name)).toEqual([
      'Prime Time',
      'Late Night Flagged',
      'Early AM',
    ]);
  });
});
