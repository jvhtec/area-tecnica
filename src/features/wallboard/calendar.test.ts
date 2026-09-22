import { describe, expect, it } from 'vitest';

import { buildCalendarModel } from './calendar';
import type { CalendarFeed } from './types';

describe('buildCalendarModel', () => {
  it('uses the canonical server range instead of rebuilding the grid from the device clock', () => {
    const calendar: CalendarFeed = {
      jobs: [],
      jobsByDate: {},
      jobDateLookup: {},
      range: {
        start: '2026-08-30T22:00:00.000Z',
        end: '2026-10-11T21:59:59.999Z',
      },
      focusMonth: 8,
      focusYear: 2026,
    };

    const model = buildCalendarModel(calendar);

    expect(model.cells).toHaveLength(42);
    expect(model.cells[0].isoKey).toBe('2026-08-31');
    expect(model.cells[41].isoKey).toBe('2026-10-11');
    expect(model.monthLabel).toContain('septiembre');
    expect(model.monthLabel).toContain('2026');
  });
});
