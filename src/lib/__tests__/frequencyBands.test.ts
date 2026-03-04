import { describe, expect, it } from 'vitest';
import {
  coerceBandSelection,
  formatFrequencyBand,
  getAvailableWirelessChannels,
  getRequiredWirelessChannels,
} from '@/lib/frequencyBands';

describe('frequencyBands', () => {
  it('formats structured frequency band values', () => {
    expect(formatFrequencyBand({ code: 'Cw-TH', from_mhz: 718.2, to_mhz: 727.8 })).toBe(
      'Cw-TH (718.2-727.8 MHz)',
    );
  });

  it('passes through and trims legacy string values', () => {
    expect(formatFrequencyBand('  G51  ')).toBe('G51');
  });

  it('coerces known codes to structured model-aware options', () => {
    const coerced = coerceBandSelection('wireless', 'Shure QLX Series', 'g51');
    expect(coerced).toEqual({ code: 'G51', from_mhz: 470, to_mhz: 534 });
  });

  it('keeps unknown codes as custom strings', () => {
    expect(coerceBandSelection('wireless', 'Shure QLX Series', 'CUSTOM-X')).toBe('CUSTOM-X');
  });

  it('computes required wireless channels as max(channels, hh+bp, legacy quantity)', () => {
    expect(getRequiredWirelessChannels({ quantity_ch: 4, quantity_hh: 2, quantity_bp: 3, quantity: 5 })).toBe(5);
    expect(getRequiredWirelessChannels({ quantity_ch: 7, quantity_hh: 2, quantity_bp: 3, quantity: 5 })).toBe(7);
  });

  it('computes available channels preferring quantity_ch over legacy and hh+bp', () => {
    expect(getAvailableWirelessChannels({ quantity_ch: 8, quantity: 12, quantity_hh: 3, quantity_bp: 2 })).toBe(8);
    expect(getAvailableWirelessChannels({ quantity_ch: 0, quantity: 12, quantity_hh: 3, quantity_bp: 2 })).toBe(12);
    expect(getAvailableWirelessChannels({ quantity_ch: 0, quantity: 0, quantity_hh: 3, quantity_bp: 2 })).toBe(5);
  });
});
