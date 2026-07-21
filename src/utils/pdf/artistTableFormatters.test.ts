import { describe, expect, it } from 'vitest';
import {
  BAND_TEXT_TOKEN,
  FESTIVAL_TEXT_TOKEN,
  formatInfrastructureForPdf,
  formatWiredMicsForPdf,
  formatWirelessSystemsForPdf,
} from './artistTableFormatters';

describe('artist table PDF formatters', () => {
  it('formats infrastructure and wired microphone inventories', () => {
    expect(formatInfrastructureForPdf({
      infra_cat6: true,
      infra_cat6_quantity: 4,
      infra_analog: 2,
    })).toBe('4x CAT6, 2x Analog');
    expect(formatWiredMicsForPdf([{ model: 'SM58', quantity: 3, exclusive_use: true }]))
      .toBe('3x SM58 (E)');
  });

  it('preserves provider tokens for mixed wireless systems', () => {
    const result = formatWirelessSystemsForPdf([
      { model: 'Axient', quantity_ch: 2, quantity_hh: 1, provided_by: 'festival' },
      { model: 'EW-DX', quantity_ch: 2, quantity_bp: 2, provided_by: 'band' },
    ], 'mixed');

    expect(result).toContain(`${FESTIVAL_TEXT_TOKEN}Festival: Axient`);
    expect(result).toContain(`${BAND_TEXT_TOKEN}Banda: EW-DX`);
  });
});
