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
});
