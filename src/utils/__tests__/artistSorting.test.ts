import { describe, expect, it } from 'vitest';

import { sortArtistsByField, sortArtistsChronologically } from '@/utils/artistSorting';

const makeArtist = (
  name: string,
  showStart: string,
  isAfterMidnight?: boolean,
) => ({
  id: name,
  name,
  stage: 1,
  date: '2031-07-10',
  show_start: showStart,
  show_end: showStart,
  isaftermidnight: isAfterMidnight,
});

describe('sortArtistsChronologically', () => {
  it('uses festival-day offsets for explicit and inferred flags', () => {
    const sorted = sortArtistsChronologically([
      makeArtist('Explicit 10:00', '10:00', false),
      makeArtist('Inferred 11:00', '11:00'),
      makeArtist('Early AM', '08:30', true),
    ], '09:30');

    expect(sorted.map(({ name }) => name)).toEqual([
      'Explicit 10:00',
      'Inferred 11:00',
      'Early AM',
    ]);
  });
});

describe('sortArtistsByField', () => {
  it('sorts previous-day soundchecks before later show-day soundchecks', () => {
    const artists = [
      {
        id: 'same-day',
        name: 'Same Day',
        stage: 1,
        date: '2026-09-10',
        show_start: '20:00',
        show_end: '21:00',
        soundcheck_start: '10:00',
      },
      {
        id: 'setup-day',
        name: 'Setup Day',
        stage: 1,
        date: '2026-09-10',
        show_start: '22:00',
        show_end: '23:00',
        soundcheck_date: '2026-09-09',
        soundcheck_start: '18:00',
      },
    ];

    expect(sortArtistsByField(artists, 'soundcheck_start').map((artist) => artist.id)).toEqual([
      'setup-day',
      'same-day',
    ]);
  });

  it('keeps artists without a soundcheck at the end', () => {
    const artists = [
      {
        id: 'missing',
        name: 'Missing',
        stage: 1,
        date: '2026-09-10',
        show_start: '20:00',
        show_end: '21:00',
      },
      {
        id: 'scheduled',
        name: 'Scheduled',
        stage: 1,
        date: '2026-09-10',
        show_start: '22:00',
        show_end: '23:00',
        soundcheck_start: '18:00',
      },
    ];

    expect(sortArtistsByField(artists, 'soundcheck_start').map((artist) => artist.id)).toEqual([
      'scheduled',
      'missing',
    ]);
  });
});
