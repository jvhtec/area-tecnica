import { describe, expect, it } from 'vitest';
import {
  buildRfIemTableRow,
  computeRfIemFestivalDayKey,
  getUniqueFormattedBands,
  hasRfIemContent,
  normalizeRfIemArtistInput,
} from '@/utils/rfIemTablePdfExport';

describe('rfIemTablePdfExport helpers', () => {
  it('formats structured band values without [object Object] artifacts', () => {
    const wirelessBands = getUniqueFormattedBands([
      { model: 'Shure QLX Series', band: { code: 'G51', from_mhz: 470, to_mhz: 534 } },
      { model: 'Shure QLX Series', band: 'Custom band' },
    ]);

    expect(wirelessBands).toContain('G51 (470-534 MHz)');
    expect(wirelessBands).toContain('Custom band');
    expect(wirelessBands).not.toContain('[object Object]');
  });

  it('builds table rows with RF channels and formatted bands', () => {
    const row = buildRfIemTableRow({
      name: 'Artist A',
      stage: 2,
      showStart: '20:00',
      showEnd: '21:00',
      soundcheckStart: '18:00',
      soundcheckEnd: '18:30',
      wirelessSystems: [
        {
          model: 'Shure QLX Series',
          quantity_ch: 4,
          quantity_hh: 2,
          quantity_bp: 1,
          band: { code: 'G51', from_mhz: 470, to_mhz: 534 },
          provided_by: 'festival',
        },
      ],
      iemSystems: [
        {
          model: 'Shure PSM300 Series',
          quantity_hh: 2,
          quantity_bp: 2,
          band: { code: 'K3E', from_mhz: 606, to_mhz: 630 },
          provided_by: 'festival',
        },
      ],
    });

    expect(row[0]).toBe('Artist A');
    expect(String(row[2])).toContain('Show: 20:00 - 21:00');
    expect(String(row[2])).toContain('SC: 18:00 - 18:30');
    expect(row[6]).toBe(4);
    expect(row[5]).toContain('G51 (470-534 MHz)');
    expect(row[11]).toContain('K3E (606-630 MHz)');
    expect(String(row[5])).not.toContain('[object Object]');
    expect(String(row[11])).not.toContain('[object Object]');
  });

  it('normalizes snake_case artist payload and propagates provider fallback', () => {
    const normalized = normalizeRfIemArtistInput({
      name: 'Artist B',
      stage: 3,
      date: '2026-03-10',
      isaftermidnight: true,
      wireless_systems: [{ model: 'Sennheiser 300 G3 Series', quantity_hh: 2 }],
      iem_systems: [{ model: 'Shure PSM1000 Series', quantity_bp: 4 }],
      wireless_provided_by: 'band',
      iem_provided_by: 'festival',
    } as any);

    expect(normalized.wirelessSystems[0]?.provided_by).toBe('band');
    expect(normalized.iemSystems[0]?.provided_by).toBe('festival');
    expect(normalized.date).toBe('2026-03-10');
    expect(normalized.isAfterMidnight).toBe(true);
    expect(hasRfIemContent(normalized)).toBe(true);
  });

  it('marks empty RF/IEM artists as no-content', () => {
    const normalized = normalizeRfIemArtistInput({
      name: 'No Gear Artist',
      stage: 1,
      wireless_systems: [],
      iem_systems: [],
    } as any);

    expect(hasRfIemContent(normalized)).toBe(false);
  });

  it('shows per-model breakdown when multiple models are configured', () => {
    const row = buildRfIemTableRow({
      name: 'Artist Multi',
      stage: 1,
      wirelessSystems: [
        { model: 'RF A', quantity_hh: 2, quantity_bp: 0, quantity_ch: 2, provided_by: 'festival' },
        { model: 'RF B', quantity_hh: 2, quantity_bp: 0, quantity_ch: 2, provided_by: 'festival' },
      ],
      iemSystems: [
        { model: 'IEM A', quantity_hh: 2, quantity_bp: 2, provided_by: 'festival' },
        { model: 'IEM B', quantity_hh: 4, quantity_bp: 4, provided_by: 'festival' },
      ],
    });

    expect(String(row[4])).toContain('RF A');
    expect(String(row[4])).toContain('RF B');
    expect(String(row[4])).not.toContain('(2ch');
    expect(String(row[10])).toContain('IEM A');
    expect(String(row[10])).toContain('IEM B');
    expect(String(row[10])).not.toContain('(2ch, 2bp)');
    expect(String(row[12])).toBe('2+4 (6)');
    expect(String(row[13])).toBe('2+4 (6)');
  });

  it('renders mixed-provider edge cases with explicit provider labeling and totals', () => {
    const row = buildRfIemTableRow({
      name: 'Artist Mixed',
      stage: 2,
      wirelessSystems: [],
      iemSystems: [
        { model: 'Shure PSM1000 Series', quantity_hh: 2, quantity_bp: 2, band: 'G10E', provided_by: 'festival' },
        { model: 'Shure PSM1000 Series', quantity_hh: 8, quantity_bp: 8, band: 'G10E', provided_by: 'band' },
        { model: 'Shure PSM1000 Series', quantity_hh: 4, quantity_bp: 4, band: 'L8E', provided_by: 'band' },
      ],
    });

    expect(String(row[10])).toContain('Festival: Shure PSM1000 Series');
    expect(String(row[10])).toContain('Banda: Shure PSM1000 Series');
    expect(String(row[10])).not.toContain('(2ch, 2bp)');
    expect(String(row[11])).toContain('Festival: G10E');
    expect(String(row[11])).toContain('Banda: G10E');
    expect(String(row[11])).toContain('L8E');
    expect(String(row[12])).toContain('G10E: ');
    expect(String(row[12])).toContain('2F');
    expect(String(row[12])).toContain('8B');
    expect(String(row[12])).toContain('L8E: ');
    expect(String(row[12])).toContain('4B');
    expect(String(row[12])).toContain('(14)');
    expect(String(row[13])).toContain('G10E: ');
    expect(String(row[13])).toContain('2F');
    expect(String(row[13])).toContain('8B');
    expect(String(row[13])).toContain('L8E: ');
    expect(String(row[13])).toContain('4B');
    expect(String(row[13])).toContain('(14)');
  });

  it('computes festival day with 07:00 rollover and explicit after-midnight override', () => {
    expect(
      computeRfIemFestivalDayKey({
        name: 'Early Show',
        stage: 1,
        date: '2026-03-11',
        showStart: '01:15',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      }),
    ).toBe('2026-03-10');

    expect(
      computeRfIemFestivalDayKey({
        name: 'Tagged After Midnight',
        stage: 1,
        date: '2026-03-11',
        isAfterMidnight: true,
        showStart: '01:15',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      }),
    ).toBe('2026-03-11');

    expect(
      computeRfIemFestivalDayKey({
        name: 'Late Night Flagged',
        stage: 1,
        date: '2026-03-11',
        isAfterMidnight: true,
        showStart: '23:35',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      }),
    ).toBe('2026-03-11');
  });

  it('handles missing or invalid date in computeRfIemFestivalDayKey', () => {
    expect(
      computeRfIemFestivalDayKey({
        name: 'No Date',
        stage: 1,
        showStart: '20:00',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      }),
    ).toBe('Sin fecha');
  });

  it('groupArtistsByFestivalDay sorts by date and time', () => {
    const artists = [
      {
        name: 'Artist C',
        stage: 1,
        date: '2026-03-12',
        showStart: '22:00',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      },
      {
        name: 'Artist B',
        stage: 1,
        date: '2026-03-11',
        showStart: '20:00',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      },
      {
        name: 'Artist A',
        stage: 2,
        date: '2026-03-11',
        showStart: '18:00',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      },
    ];

    const groups = import('@/utils/rfIemTablePdfExport').then(m => m.groupArtistsByFestivalDay(artists));

    // The result should be grouped by date
    groups.then(result => {
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].artists[0].name).toBe('Artist A'); // Earlier time on first date
    });
  });

  it('handles empty wireless and IEM systems', () => {
    const row = buildRfIemTableRow({
      name: 'No Gear',
      stage: 1,
      wirelessSystems: [],
      iemSystems: [],
    });

    expect(row[0]).toBe('No Gear');
    expect(row[6]).toBe(0); // RF channels
    expect(row[12]).toBe(0); // IEM channels
  });

  it('handles legacy quantity field in IEM systems', () => {
    const row = buildRfIemTableRow({
      name: 'Legacy IEM',
      stage: 1,
      wirelessSystems: [],
      iemSystems: [
        { model: 'Old IEM', quantity: 3, provided_by: 'festival' },
      ],
    });

    expect(row[12]).toBe(3); // Should use legacy quantity field
  });

  it('strips provider tokens correctly', () => {
    const { stripProviderTextTokens, FESTIVAL_TEXT_TOKEN, BAND_TEXT_TOKEN } =
      require('@/utils/rfIemTablePdfExport');

    const input = `${FESTIVAL_TEXT_TOKEN}Festival Item ${BAND_TEXT_TOKEN}Band Item`;
    const result = stripProviderTextTokens(input);

    expect(result).not.toContain(FESTIVAL_TEXT_TOKEN);
    expect(result).not.toContain(BAND_TEXT_TOKEN);
    expect(result).toBe('Festival Item Band Item');
  });

  it('detects provider tokens correctly', () => {
    const { hasProviderTextToken, FESTIVAL_TEXT_TOKEN, BAND_TEXT_TOKEN } =
      require('@/utils/rfIemTablePdfExport');

    expect(hasProviderTextToken(`${FESTIVAL_TEXT_TOKEN}text`)).toBe(true);
    expect(hasProviderTextToken(`${BAND_TEXT_TOKEN}text`)).toBe(true);
    expect(hasProviderTextToken('plain text')).toBe(false);
  });

  it('splits tokenized segments into provider-tagged parts', () => {
    const { splitTokenizedSegments, FESTIVAL_TEXT_TOKEN, BAND_TEXT_TOKEN } =
      require('@/utils/rfIemTablePdfExport');

    const input = `${FESTIVAL_TEXT_TOKEN}Festival part ${BAND_TEXT_TOKEN}Band part`;
    const segments = splitTokenizedSegments(input);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ text: 'Festival part ', provider: 'festival' });
    expect(segments[1]).toEqual({ text: 'Band part', provider: 'band' });
  });

  it('formats time range with missing values', () => {
    const { formatTimeRange } = require('@/utils/rfIemTablePdfExport');

    expect(formatTimeRange(undefined, undefined)).toBe('-');
    expect(formatTimeRange('20:00', undefined)).toBe('20:00 - -');
    expect(formatTimeRange(undefined, '22:00')).toBe('- 22:00');
    expect(formatTimeRange('  ', '  ')).toBe('-');
  });

  it('getRfSystemChannels prioritizes quantity_ch over sum of HH+BP', () => {
    const { getRfSystemChannels } = require('@/utils/rfIemTablePdfExport');

    const system1 = { quantity_ch: 10, quantity_hh: 3, quantity_bp: 2 };
    expect(getRfSystemChannels(system1)).toBe(10);

    const system2 = { quantity_hh: 3, quantity_bp: 2 };
    expect(getRfSystemChannels(system2)).toBe(5);
  });

  it('getProviderSummary returns correct labels', () => {
    const { getProviderSummary } = require('@/utils/rfIemTablePdfExport');

    expect(getProviderSummary([])).toBe('');
    expect(getProviderSummary([{ model: 'RF', provided_by: 'festival' }])).toBe('Festival');
    expect(getProviderSummary([{ model: 'RF', provided_by: 'band' }])).toBe('Banda');
    expect(getProviderSummary([
      { model: 'RF1', provided_by: 'festival' },
      { model: 'RF2', provided_by: 'band' }
    ])).toBe('Mixto');
  });

  it('normalizes systems with missing or invalid data', () => {
    const { normalizeRfIemArtistInput } = require('@/utils/rfIemTablePdfExport');

    const artist = normalizeRfIemArtistInput({
      name: '',
      stage: 'invalid' as any,
      wireless_systems: [
        { model: '', quantity_hh: 0 }, // Empty model, zero quantity
        { model: 'Valid RF', quantity_ch: 3 }
      ],
    } as any);

    expect(artist.name).toBe('Unnamed Artist'); // Default name
    expect(artist.stage).toBe(1); // Default stage
    expect(artist.wirelessSystems).toHaveLength(1); // Only valid system
    expect(artist.wirelessSystems[0].model).toBe('Valid RF');
  });

  it('formatMetricBreakdownByProvider handles multiple bands correctly', () => {
    const { formatMetricBreakdownByProvider } = require('@/utils/rfIemTablePdfExport');

    const systems = [
      { model: 'RF', quantity_hh: 2, band: 'G51', provided_by: 'festival' },
      { model: 'RF', quantity_hh: 3, band: 'G51', provided_by: 'band' },
      { model: 'RF', quantity_hh: 4, band: 'K3E', provided_by: 'band' },
    ];

    const result = formatMetricBreakdownByProvider(systems, (s: any) => s.quantity_hh);

    // Should show per-band breakdown with provider labels
    expect(String(result)).toContain('G51');
    expect(String(result)).toContain('K3E');
    expect(String(result)).toContain('(9)'); // Total
  });
});