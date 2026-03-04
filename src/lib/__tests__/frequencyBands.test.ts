import { describe, expect, it } from 'vitest';
import {
  IEM_BANDS_EU,
  WIRELESS_BANDS_EU,
  coerceBandSelection,
  formatFrequencyBand,
  getAvailableWirelessChannels,
  getBandOptionsEU,
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

  it('provides predefined options for all newly added wireless models', () => {
    const newWirelessModels = [
      'Audio-Technica 3000 Series',
      'Sound Devices Astral Series',
      'Sennheiser Spectera',
      'Sennheiser 6000 Series',
      'Sony UWP Series',
    ];

    newWirelessModels.forEach((model) => {
      expect(getBandOptionsEU('wireless', model).length).toBeGreaterThan(0);
    });
  });

  it('provides predefined options for new IEM models and expanded PSM300 bands', () => {
    const newIemModels = [
      'Audio-Technica 3000 IEM Series',
      'Sennheiser Spectera',
      'Shure PSM300 Series',
    ];

    newIemModels.forEach((model) => {
      expect(getBandOptionsEU('iem', model).length).toBeGreaterThan(0);
    });

    const psm300Options = getBandOptionsEU('iem', 'Shure PSM300 Series');
    expect(psm300Options.map((option) => option.code)).toEqual(
      expect.arrayContaining(['H20', 'J10', 'J13', 'S8', 'T11', 'X7']),
    );
  });

  it('coerces new lowercase model-aware band codes', () => {
    expect(coerceBandSelection('wireless', 'Audio-Technica 3000 Series', 'de2')).toEqual({
      code: 'DE2',
      from_mhz: 470,
      to_mhz: 530,
    });
    expect(coerceBandSelection('wireless', 'Sennheiser Spectera', 'z01-uhf-l')).toEqual({
      code: 'Z01-UHF-L',
      from_mhz: 470,
      to_mhz: 608,
    });
    expect(coerceBandSelection('wireless', 'Sony UWP Series', 'ce42')).toEqual({
      code: 'CE42',
      from_mhz: 638.025,
      to_mhz: 694,
    });
  });

  it('does not contain duplicate band codes within any model catalog entry', () => {
    const assertUniqueCodes = (catalog: Record<string, Array<{ code: string }>>) => {
      Object.values(catalog).forEach((options) => {
        const codes = options.map((option) => option.code);
        expect(new Set(codes).size).toBe(codes.length);
      });
    };

    assertUniqueCodes(WIRELESS_BANDS_EU);
    assertUniqueCodes(IEM_BANDS_EU);
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
