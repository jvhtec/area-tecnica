import { describe, expect, it } from 'vitest';
import {
  collectTimelineFindings,
  parseClockMinutes,
  toWindowOffset,
  TIMELINE_WINDOW_START_MINUTES,
} from '@/utils/pdf/festival-report/timeline';
import {
  distributeColumnWidths,
  dropConstantColumns,
} from '@/utils/pdf/festival-report/tables';
import { formatFestivalNumber } from '@/utils/pdf/festival-report/components';
import { festivalGeometry } from '@/utils/pdf/festival-report/tokens';
import { fitImageWithin } from '@/utils/pdf/soundvisionReportPdf';
import { buildWiredMicrophoneMatrix } from '@/utils/wiredMicrophoneNeedsPdfExport';

describe('timeline clock parsing', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseClockMinutes('18:30')).toBe(18 * 60 + 30);
    expect(parseClockMinutes('07:00:00')).toBe(TIMELINE_WINDOW_START_MINUTES);
  });

  it('rejects values that are not clock times', () => {
    expect(parseClockMinutes('')).toBeNull();
    expect(parseClockMinutes(undefined)).toBeNull();
    expect(parseClockMinutes('mañana')).toBeNull();
    expect(parseClockMinutes('25:00')).toBeNull();
    expect(parseClockMinutes('12:71')).toBeNull();
  });

  it('places the programme day between 07:00 and 07:00', () => {
    expect(toWindowOffset('07:00')).toBe(0);
    expect(toWindowOffset('08:00')).toBe(60);
    // 02:00 is late in the same programme day, not early in the previous one.
    expect(toWindowOffset('02:00')).toBe(19 * 60);
    expect(toWindowOffset('06:59')).toBe(24 * 60 - 1);
  });
});

describe('timeline findings', () => {
  it('flags a soundcheck window that is longer than a soundcheck', () => {
    const findings = collectTimelineFindings([
      {
        name: 'Artista A',
        show: { start: '22:00', end: '23:30' },
        soundcheck: { start: '09:00', end: '02:00' },
      },
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0].label).toBe('Revisar');
    expect(findings[0].name).toBe('Artista A');
  });

  it('flags a soundcheck that starts after its own show', () => {
    const findings = collectTimelineFindings([
      {
        name: 'Artista B',
        show: { start: '18:00', end: '19:00' },
        soundcheck: { start: '20:00', end: '20:30' },
      },
    ]);

    expect(findings.map((finding) => finding.label)).toContain('Conflicto');
  });

  it('says nothing about a well-formed day', () => {
    expect(
      collectTimelineFindings([
        {
          name: 'Artista C',
          show: { start: '21:00', end: '22:30' },
          soundcheck: { start: '17:00', end: '18:00' },
        },
      ]),
    ).toEqual([]);
  });

  it('ignores artists with no soundcheck rather than inventing one', () => {
    expect(
      collectTimelineFindings([
        { name: 'Artista D', show: { start: '21:00', end: '22:00' } },
      ]),
    ).toEqual([]);
  });
});

describe('dropConstantColumns', () => {
  const head = ['Artista', 'Escenario', 'Rider', 'Notas'];
  const rows = [
    ['A', 'Escenario 1', 'Completo', 'Sin notas'],
    ['B', 'Escenario 1', 'Completo', 'Llega tarde'],
  ];

  it('lifts columns whose value never varies', () => {
    const result = dropConstantColumns(head, rows, { protect: [0] });

    expect(result.head).toEqual(['Artista', 'Notas']);
    expect(result.rows).toEqual([['A', 'Sin notas'], ['B', 'Llega tarde']]);
    expect(result.constants).toEqual([
      { label: 'Escenario', value: 'Escenario 1' },
      { label: 'Rider', value: 'Completo' },
    ]);
  });

  it('keeps protected columns even when they never vary', () => {
    const result = dropConstantColumns(head, rows, { protect: [0, 1] });

    expect(result.head).toContain('Escenario');
    expect(result.constants.map((constant) => constant.label)).toEqual(['Rider']);
  });

  it('leaves a single-row table alone — one row proves nothing about variance', () => {
    const result = dropConstantColumns(head, [rows[0]]);

    expect(result.head).toEqual(head);
    expect(result.constants).toEqual([]);
  });

  it('does not lift a column that is blank in every row', () => {
    const result = dropConstantColumns(['A', 'B'], [['1', ''], ['2', '']]);

    expect(result.head).toEqual(['A', 'B']);
    expect(result.constants).toEqual([]);
  });
});

describe('distributeColumnWidths', () => {
  it('spreads the available width across the weights', () => {
    const widths = distributeColumnWidths([1, 1, 2], 100);

    expect(widths[0].cellWidth).toBeCloseTo(25);
    expect(widths[1].cellWidth).toBeCloseTo(25);
    expect(widths[2].cellWidth).toBeCloseTo(50);
  });
});

describe('formatFestivalNumber', () => {
  it('uses the Spanish decimal comma and thousands point', () => {
    expect(formatFestivalNumber(42100)).toBe('42.100');
    expect(formatFestivalNumber(49.53, 2)).toBe('49,53');
  });

  it('renders a missing value rather than NaN', () => {
    expect(formatFestivalNumber(Number.NaN)).toBe('—');
  });
});

describe('landscape content box', () => {
  // A stage plot is placed into this box. It has to clear the running head and
  // the footer rule, or the header rule prints across the top of the drawing.
  const geo = festivalGeometry({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
  } as never);

  it('is recognised as landscape and drops the rail', () => {
    expect(geo.landscape).toBe(true);
    expect(geo.contentWidth).toBeCloseTo(297 - 22 - 16);
  });

  it('starts below the header rule and ends above the footer rule', () => {
    expect(geo.contentTop).toBeGreaterThan(geo.headerRuleY);
    expect(geo.contentBottom).toBeLessThan(geo.footerRuleY);
  });

  it('keeps a wide plot inside the box', () => {
    const fitted = fitImageWithin(
      1400,
      900,
      geo.left,
      geo.contentTop,
      geo.contentWidth,
      geo.contentBottom - geo.contentTop,
    );

    expect(fitted.x).toBeGreaterThanOrEqual(geo.left);
    expect(fitted.y).toBeGreaterThanOrEqual(geo.contentTop);
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(geo.right + 0.01);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(geo.contentBottom + 0.01);
  });

  it('keeps a tall plot inside the box too', () => {
    const fitted = fitImageWithin(
      900,
      1400,
      geo.left,
      geo.contentTop,
      geo.contentWidth,
      geo.contentBottom - geo.contentTop,
    );

    expect(fitted.height).toBeLessThanOrEqual(geo.contentBottom - geo.contentTop + 0.01);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(geo.contentBottom + 0.01);
  });
});

describe('wired microphone matrix', () => {
  const artists = [
    { name: 'A', wired_mics: [{ model: 'SM58', quantity: 4 }, { model: 'Beta52', quantity: 1 }] },
    { name: 'B', wired_mics: [{ model: 'SM58', quantity: 6 }] },
    { name: 'C', wired_mics: [] },
  ];

  it('reports peak as the largest single-artist demand, not the sum', () => {
    const matrix = buildWiredMicrophoneMatrix(artists);

    expect(matrix.peak.SM58).toBe(6);
    expect(matrix.total.SM58).toBe(10);
  });

  it('keeps artists with no requirement as columns rather than dropping them', () => {
    const matrix = buildWiredMicrophoneMatrix(artists);

    expect(matrix.artistNames).toEqual(['A', 'B', 'C']);
    expect(matrix.quantities.SM58?.C).toBeUndefined();
  });

  it('ignores entries with no model or a non-positive quantity', () => {
    const matrix = buildWiredMicrophoneMatrix([
      { name: 'A', wired_mics: [{ model: '', quantity: 3 }, { model: 'SM57', quantity: 0 }] },
    ]);

    expect(matrix.micModels).toEqual([]);
  });

  it('accumulates repeated entries of the same model for one artist', () => {
    const matrix = buildWiredMicrophoneMatrix([
      { name: 'A', wired_mics: [{ model: 'SM58', quantity: 2 }, { model: 'SM58', quantity: 3 }] },
    ]);

    expect(matrix.quantities.SM58.A).toBe(5);
    expect(matrix.peak.SM58).toBe(5);
  });
});
