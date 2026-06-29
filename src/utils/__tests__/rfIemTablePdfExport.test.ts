import { describe, expect, it } from 'vitest';
import {
  buildRfIemTableRow,
  computeRfIemFestivalDayKey,
  getUniqueFormattedBands,
  hasRfIemContent,
  normalizeRfIemArtistInput,
  getProviderSummary,
  getRfSystemChannels,
  formatMetricBreakdownByProvider,
  groupArtistsByFestivalDay,
  formatTimeRange,
  hasProviderTextToken,
  stripProviderTextTokens,
  splitTokenizedSegments,
  FESTIVAL_TEXT_TOKEN,
  BAND_TEXT_TOKEN,
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

  describe('getProviderSummary', () => {
    it('returns Festival for all festival systems', () => {
      expect(
        getProviderSummary([
          { model: 'RF A', provided_by: 'festival' },
          { model: 'RF B', provided_by: 'festival' },
        ]),
      ).toBe('Festival');
    });

    it('returns Banda for all band systems', () => {
      expect(
        getProviderSummary([
          { model: 'RF A', provided_by: 'band' },
          { model: 'RF B', provided_by: 'band' },
        ]),
      ).toBe('Banda');
    });

    it('returns Mixto for mixed providers', () => {
      expect(
        getProviderSummary([
          { model: 'RF A', provided_by: 'festival' },
          { model: 'RF B', provided_by: 'band' },
        ]),
      ).toBe('Mixto');
    });

    it('returns empty string for empty array', () => {
      expect(getProviderSummary([])).toBe('');
    });
  });

  describe('getRfSystemChannels', () => {
    it('uses quantity_ch when available and positive', () => {
      expect(getRfSystemChannels({ model: 'RF', quantity_ch: 8, quantity_hh: 4, quantity_bp: 2 })).toBe(8);
    });

    it('falls back to HH + BP when quantity_ch is 0', () => {
      expect(getRfSystemChannels({ model: 'RF', quantity_ch: 0, quantity_hh: 4, quantity_bp: 2 })).toBe(6);
    });

    it('falls back to HH + BP when quantity_ch is undefined', () => {
      expect(getRfSystemChannels({ model: 'RF', quantity_hh: 4, quantity_bp: 2 })).toBe(6);
    });

    it('handles missing HH and BP gracefully', () => {
      expect(getRfSystemChannels({ model: 'RF' })).toBe(0);
    });
  });

  describe('formatMetricBreakdownByProvider', () => {
    it('returns simple total for single provider', () => {
      const result = formatMetricBreakdownByProvider(
        [
          { model: 'RF A', quantity_hh: 2, provided_by: 'festival' },
          { model: 'RF B', quantity_hh: 3, provided_by: 'festival' },
        ],
        (sys) => sys.quantity_hh || 0,
      );
      expect(result).toBe(5);
    });

    it('returns breakdown with provider tokens for mixed providers', () => {
      const result = formatMetricBreakdownByProvider(
        [
          { model: 'RF A', quantity_hh: 2, provided_by: 'festival' },
          { model: 'RF B', quantity_hh: 3, provided_by: 'band' },
        ],
        (sys) => sys.quantity_hh || 0,
      );
      expect(result).toContain('2F');
      expect(result).toContain('3B');
      expect(result).toContain('(5)');
    });

    it('groups by band when multiple bands exist', () => {
      const result = formatMetricBreakdownByProvider(
        [
          { model: 'RF A', quantity_hh: 2, band: 'G51', provided_by: 'festival' },
          { model: 'RF B', quantity_hh: 3, band: 'L8E', provided_by: 'band' },
        ],
        (sys) => sys.quantity_hh || 0,
      );
      expect(result).toContain('G51');
      expect(result).toContain('L8E');
      expect(result).toContain('(5)');
    });
  });

  describe('groupArtistsByFestivalDay', () => {
    it('groups artists by festival day', () => {
      const artists = [
        {
          name: 'Artist 1',
          stage: 1,
          date: '2026-03-10',
          showStart: '20:00',
          wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
          iemSystems: [],
        },
        {
          name: 'Artist 2',
          stage: 1,
          date: '2026-03-10',
          showStart: '22:00',
          wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
          iemSystems: [],
        },
        {
          name: 'Artist 3',
          stage: 1,
          date: '2026-03-11',
          showStart: '20:00',
          wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
          iemSystems: [],
        },
      ];

      const groups = groupArtistsByFestivalDay(artists);
      expect(groups.length).toBe(2);
      expect(groups[0].artists.length).toBe(2);
      expect(groups[1].artists.length).toBe(1);
    });

    it('sorts artists by time within day', () => {
      const artists = [
        {
          name: 'Artist Late',
          stage: 1,
          date: '2026-03-10',
          showStart: '23:00',
          wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
          iemSystems: [],
        },
        {
          name: 'Artist Early',
          stage: 1,
          date: '2026-03-10',
          showStart: '20:00',
          wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
          iemSystems: [],
        },
      ];

      const groups = groupArtistsByFestivalDay(artists);
      expect(groups[0].artists[0].name).toBe('Artist Early');
      expect(groups[0].artists[1].name).toBe('Artist Late');
    });
  });

  describe('formatTimeRange', () => {
    it('formats valid time range', () => {
      expect(formatTimeRange('20:00', '22:00')).toBe('20:00 - 22:00');
    });

    it('handles missing start time', () => {
      expect(formatTimeRange(undefined, '22:00')).toBe('- 22:00');
    });

    it('handles missing end time', () => {
      expect(formatTimeRange('20:00', undefined)).toBe('20:00 - -');
    });

    it('handles both missing', () => {
      expect(formatTimeRange(undefined, undefined)).toBe('-');
    });
  });

  describe('provider text tokens', () => {
    it('detects provider tokens in text', () => {
      expect(hasProviderTextToken(`${FESTIVAL_TEXT_TOKEN}Festival: G51`)).toBe(true);
      expect(hasProviderTextToken(`${BAND_TEXT_TOKEN}Banda: L8E`)).toBe(true);
      expect(hasProviderTextToken('Plain text')).toBe(false);
    });

    it('strips provider tokens from text', () => {
      const text = `${FESTIVAL_TEXT_TOKEN}Festival: G51, ${BAND_TEXT_TOKEN}Banda: L8E`;
      const stripped = stripProviderTextTokens(text);
      expect(stripped).not.toContain(FESTIVAL_TEXT_TOKEN);
      expect(stripped).not.toContain(BAND_TEXT_TOKEN);
      expect(stripped).toContain('Festival');
      expect(stripped).toContain('Banda');
    });

    it('splits tokenized text into segments', () => {
      const text = `${FESTIVAL_TEXT_TOKEN}Festival: 2F + ${BAND_TEXT_TOKEN}Banda: 3B`;
      const segments = splitTokenizedSegments(text);

      expect(segments.length).toBeGreaterThan(1);
      expect(segments.some(s => s.provider === 'festival')).toBe(true);
      expect(segments.some(s => s.provider === 'band')).toBe(true);
    });

    it('handles text without tokens', () => {
      const text = 'Plain text without tokens';
      const segments = splitTokenizedSegments(text);

      expect(segments.length).toBe(1);
      expect(segments[0].provider).toBe('default');
      expect(segments[0].text).toBe(text);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('handles artist with no name', () => {
      const normalized = normalizeRfIemArtistInput({
        name: '',
        stage: 1,
        wireless_systems: [{ model: 'RF', quantity_ch: 1 }],
        iem_systems: [],
      } as any);

      expect(normalized.name).toBe('Unnamed Artist');
    });

    it('handles negative stage numbers', () => {
      const normalized = normalizeRfIemArtistInput({
        name: 'Artist',
        stage: -1,
        wireless_systems: [],
        iem_systems: [],
      } as any);

      expect(normalized.stage).toBe(1); // Falls back to 1
    });

    it('filters out systems with no model and no quantities', () => {
      const normalized = normalizeRfIemArtistInput({
        name: 'Artist',
        stage: 1,
        wireless_systems: [
          { model: '', quantity_ch: 0, quantity_hh: 0, quantity_bp: 0 },
          { model: 'Valid RF', quantity_ch: 1 },
        ],
        iem_systems: [],
      } as any);

      expect(normalized.wirelessSystems.length).toBe(1);
      expect(normalized.wirelessSystems[0].model).toBe('Valid RF');
    });

    it('handles invalid date format gracefully', () => {
      const key = computeRfIemFestivalDayKey({
        name: 'Artist',
        stage: 1,
        date: 'invalid-date',
        wirelessSystems: [{ model: 'RF', quantity_ch: 1 }],
        iemSystems: [],
      });

      expect(key).toBe('Sin fecha');
    });
  });
});