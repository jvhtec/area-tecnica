import { describe, expect, it } from 'vitest';

import { formatAgo, formatDateKeyRange, formatJobWhen, formatMadridTime, formatRelativeDay, formatStartsIn } from './format';

// 2026-09-22 is a Tuesday; Madrid is UTC+2 in September.
const NOW = new Date('2026-09-22T08:00:00.000Z');

describe('wallboard formatting', () => {
  it('shows Madrid time in 24 h format whatever the device locale', () => {
    expect(formatMadridTime('2026-09-22T07:00:00.000Z')).toBe('09:00');
    expect(formatMadridTime('2026-09-22T21:30:00.000Z')).toBe('23:30');
  });

  it('uses Madrid calendar days for hoy / mañana', () => {
    expect(formatRelativeDay('2026-09-22T21:59:00.000Z', NOW)).toBe('hoy');
    // 22:30 UTC is already Wednesday in Madrid.
    expect(formatRelativeDay('2026-09-22T22:30:00.000Z', NOW)).toBe('mañana');
    expect(formatRelativeDay('2026-09-24T12:00:00.000Z', NOW)).toBe('jue 24');
  });

  it('describes one-day and multi-day jobs', () => {
    expect(formatJobWhen('2026-09-22T07:00:00.000Z', '2026-09-22T21:00:00.000Z', NOW)).toBe('hoy · 09:00–23:00');
    expect(formatJobWhen('2026-09-23T06:00:00.000Z', '2026-09-25T21:00:00.000Z', NOW)).toBe('mañana → vie 25');
  });

  it('counts days until the start', () => {
    expect(formatStartsIn('2026-09-21T08:00:00.000Z', NOW)).toBe('en curso');
    expect(formatStartsIn('2026-09-22T18:00:00.000Z', NOW)).toBe('hoy');
    expect(formatStartsIn('2026-09-25T08:00:00.000Z', NOW)).toBe('en 3 días');
  });

  it('formats ranges and freshness in Spanish', () => {
    expect(formatDateKeyRange('2026-09-21', '2026-10-18')).toBe('21 sept – 18 oct');
    expect(formatAgo(0, 12_000)).toBe('hace 12 s');
    expect(formatAgo(0, 180_000)).toBe('hace 3 min');
  });
});
