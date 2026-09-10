import { describe, expect, it } from 'vitest';

import { sortArtistsByField } from '@/utils/artistSorting';

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
