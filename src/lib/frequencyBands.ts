export interface FrequencyBandSelection {
  code: string;
  from_mhz: number;
  to_mhz: number;
}

export type FrequencyBandOption = FrequencyBandSelection;
export type FrequencyBandCategory = 'wireless' | 'iem';

type WirelessSystemLike = {
  quantity_ch?: number | null;
  quantity_hh?: number | null;
  quantity_bp?: number | null;
  quantity?: number | null;
};

const option = (code: string, from_mhz: number, to_mhz: number): FrequencyBandOption => ({
  code,
  from_mhz,
  to_mhz,
});

export const normalizeModelKey = (model: string): string => model.trim().toLowerCase();

export const WIRELESS_BANDS_EU: Record<string, FrequencyBandOption[]> = {
  [normalizeModelKey('Shure AD Series')]: [
    option('G56', 470, 636),
    option('K55', 606, 698),
  ],
  [normalizeModelKey('Shure AXT Series')]: [
    option('G1E', 470, 530),
    option('H4E', 518, 578),
    option('J5E', 578, 638),
    option('K4E', 606, 666),
    option('L3E', 638, 698),
  ],
  [normalizeModelKey('Shure UR Series')]: [
    option('G1E', 470, 530),
    option('H4E', 518, 578),
    option('J5E', 578, 638),
    option('K4E', 606, 666),
    option('L3E', 638, 698),
    option('M5E', 694, 758),
    option('P8', 710, 790),
    option('Q5', 740, 814),
  ],
  [normalizeModelKey('Shure ULX Series')]: [
    option('G51', 470, 534),
    option('H51', 534, 598),
    option('K51', 606, 670),
    option('P51', 710, 782),
    option('V51', 174, 216),
  ],
  [normalizeModelKey('Shure QLX Series')]: [
    option('G51', 470, 534),
    option('H51', 534, 598),
    option('K51', 606, 670),
    option('L52', 632, 694),
    option('P51', 710, 782),
    option('V51', 174, 216),
  ],
  [normalizeModelKey('Sennheiser 2000 Series')]: [
    option('Aw', 516, 558),
    option('Gw', 558, 626),
    option('Bw', 626, 698),
    option('Cw', 718, 790),
    option('Dw', 790, 865),
  ],
  [normalizeModelKey('Sennheiser EW500 Series')]: [
    option('Aw+', 470, 558),
    option('Aw30', 470, 558),
    option('AS', 520, 558),
    option('Gw1', 558, 608),
    option('Gw', 558, 626),
    option('GBw', 606, 678),
    option('Bw', 626, 698),
    option('Bw30', 626, 698),
    option('Cw', 718, 790),
    option('Cw-TH', 718.2, 727.8),
    option('Dw', 790, 865),
    option('JB', 806, 810),
    option('K+', 925, 937.5),
  ],
  [normalizeModelKey('Sennheiser EW300 Series')]: [
    option('Aw+', 470, 558),
    option('Aw30', 470, 558),
    option('AS', 520, 558),
    option('Gw1', 558, 608),
    option('Gw', 558, 626),
    option('GBw', 606, 678),
    option('Bw', 626, 698),
    option('Bw30', 626, 698),
    option('Cw', 718, 790),
    option('Cw-TH', 718.2, 727.8),
    option('Dw', 790, 865),
    option('JB', 806, 810),
    option('K+', 925, 937.5),
  ],
  [normalizeModelKey('Sennheiser EW100 Series')]: [
    option('A1', 470, 516),
    option('A', 516, 558),
    option('AS', 520, 558),
    option('G', 566, 608),
    option('GB', 606, 648),
    option('B', 626, 668),
    option('C', 734, 776),
    option('C-TH', 748.2, 757.8),
    option('D', 780, 822),
    option('JB', 806, 810),
    option('E', 823, 865),
    option('K+', 925, 937.5),
    option('1G8', 1785, 1800),
  ],
};

export const IEM_BANDS_EU: Record<string, FrequencyBandOption[]> = {
  [normalizeModelKey('Shure Digital PSM Series')]: [
    option('G56', 470, 636),
    option('K55', 606, 694),
    option('X57', 961, 1154),
  ],
  [normalizeModelKey('Shure PSM1000 Series')]: [
    option('G10E', 470, 542),
    option('J8E', 554, 626),
    option('K10E', 596, 668),
    option('L8E', 626, 698),
    option('L9E', 670, 742),
  ],
  [normalizeModelKey('Shure PSM900 Series')]: [
    option('G6E', 470, 506),
    option('G7E', 506, 542),
    option('K1E', 596, 632),
    option('L6E', 656, 692),
    option('P7', 702, 742),
  ],
  [normalizeModelKey('Shure PSM300 Series')]: [
    option('H8E', 518, 542),
    option('K3E', 606, 630),
    option('K12', 614, 638),
    option('L19', 630, 654),
    option('M16', 686, 710),
    option('Q25', 742, 766),
  ],
  [normalizeModelKey('Sennheiser 2000 series')]: [
    option('Aw+', 470, 558),
    option('Gw1', 558, 608),
    option('Gw', 558, 626),
    option('GBw', 606, 678),
    option('Bw', 626, 698),
  ],
  [normalizeModelKey('Sennheiser 300 G4 Series')]: [
    option('A1', 470, 516),
    option('A', 516, 558),
    option('AS', 520, 558),
    option('G', 566, 608),
    option('GB', 606, 648),
    option('B', 626, 668),
    option('C', 734, 776),
    option('C-TH', 748.2, 757.8),
    option('D', 780, 822),
    option('E', 823, 865),
  ],
  [normalizeModelKey('Sennheiser 300 G3 Series')]: [
    option('A', 516, 558),
    option('G', 566, 608),
    option('B', 626, 668),
  ],
  [normalizeModelKey('Wysicom MTK')]: [
    option('WB', 470, 800),
  ],
};

export const getBandOptionsEU = (
  category: FrequencyBandCategory,
  model: string,
): FrequencyBandOption[] => {
  const key = normalizeModelKey(model || '');
  if (!key) return [];
  const catalog = category === 'iem' ? IEM_BANDS_EU : WIRELESS_BANDS_EU;
  return catalog[key] || [];
};

export const isFrequencyBandSelection = (band: unknown): band is FrequencyBandSelection => {
  if (!band || typeof band !== 'object') return false;
  const candidate = band as Record<string, unknown>;

  return (
    typeof candidate.code === 'string' &&
    candidate.code.trim().length > 0 &&
    typeof candidate.from_mhz === 'number' &&
    Number.isFinite(candidate.from_mhz) &&
    typeof candidate.to_mhz === 'number' &&
    Number.isFinite(candidate.to_mhz)
  );
};

const formatMhzValue = (value: number): string => {
  if (Number.isInteger(value)) return String(value);
  return String(value);
};

export const formatBandOptionLabel = (band: FrequencyBandSelection): string => {
  const from = formatMhzValue(band.from_mhz);
  const to = formatMhzValue(band.to_mhz);
  return `${band.code} (${from}-${to} MHz)`;
};

export const formatFrequencyBand = (band?: FrequencyBandSelection | string): string => {
  if (!band) return '';
  if (typeof band === 'string') return band.trim();
  if (!isFrequencyBandSelection(band)) return '';
  return formatBandOptionLabel(band);
};

export const coerceBandSelection = (
  category: FrequencyBandCategory,
  model: string,
  band?: FrequencyBandSelection | string | null,
): FrequencyBandSelection | string | undefined => {
  if (!band) return undefined;

  if (isFrequencyBandSelection(band)) {
    return {
      code: band.code.trim(),
      from_mhz: band.from_mhz,
      to_mhz: band.to_mhz,
    };
  }

  const trimmedBand = band.trim();
  if (!trimmedBand) return undefined;

  const options = getBandOptionsEU(category, model);
  const matchingOption = options.find(
    (optionValue) => optionValue.code.toLowerCase() === trimmedBand.toLowerCase(),
  );

  if (matchingOption) {
    return matchingOption;
  }

  return trimmedBand;
};

export const getRequiredWirelessChannels = (system: WirelessSystemLike): number => {
  const quantityCh = Number(system.quantity_ch) || 0;
  const quantityHh = Number(system.quantity_hh) || 0;
  const quantityBp = Number(system.quantity_bp) || 0;
  const legacyQuantity = Number(system.quantity) || 0;

  return Math.max(quantityCh, quantityHh + quantityBp, legacyQuantity);
};

export const getAvailableWirelessChannels = (system: WirelessSystemLike): number => {
  const quantityCh = Number(system.quantity_ch) || 0;
  if (quantityCh > 0) return quantityCh;

  const legacyQuantity = Number(system.quantity) || 0;
  if (legacyQuantity > 0) return legacyQuantity;

  const quantityHh = Number(system.quantity_hh) || 0;
  const quantityBp = Number(system.quantity_bp) || 0;
  return quantityHh + quantityBp;
};
