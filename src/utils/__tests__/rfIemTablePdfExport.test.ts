import { describe, expect, it } from 'vitest';
import { buildRfIemTableRow, getUniqueFormattedBands } from '@/utils/rfIemTablePdfExport';

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
    expect(row[5]).toBe(4);
    expect(row[4]).toContain('G51 (470-534 MHz)');
    expect(row[10]).toContain('K3E (606-630 MHz)');
    expect(String(row[4])).not.toContain('[object Object]');
    expect(String(row[10])).not.toContain('[object Object]');
  });
});
