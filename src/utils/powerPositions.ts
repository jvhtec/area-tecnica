export const POWER_POSITION_PRESETS = [
  'USL',
  'USC',
  'USR',
  'CSL',
  'CSC',
  'CSR',
  'DSL',
  'DSC',
  'DSR',
  'FOH',
] as const;

export type PowerPositionPreset = (typeof POWER_POSITION_PRESETS)[number];

export const NO_POWER_POSITION_VALUE = 'none';
export const CUSTOM_POWER_POSITION_VALUE = 'custom';

export const isPowerPositionPreset = (
  value: string | null | undefined
): value is PowerPositionPreset =>
  typeof value === 'string' &&
  (POWER_POSITION_PRESETS as readonly string[]).includes(value);

export const getPowerPositionCustomValue = (
  position?: string | null,
  customPosition?: string | null
) => {
  const trimmedCustom = customPosition?.trim();
  if (trimmedCustom) {
    return trimmedCustom;
  }

  return isPowerPositionPreset(position) ? '' : position?.trim() || '';
};

export const getResolvedPowerPosition = (
  position?: string | null,
  customPosition?: string | null
) => getPowerPositionCustomValue(position, customPosition) || position?.trim() || '';

export const getPowerPositionSelectValue = (
  position?: string | null,
  customPosition?: string | null
) => {
  if (getPowerPositionCustomValue(position, customPosition)) {
    return CUSTOM_POWER_POSITION_VALUE;
  }

  if (isPowerPositionPreset(position)) {
    return position;
  }

  return NO_POWER_POSITION_VALUE;
};
