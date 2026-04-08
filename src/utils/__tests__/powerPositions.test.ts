import { describe, expect, it } from 'vitest';

import {
  CUSTOM_POWER_POSITION_VALUE,
  getPowerPositionCustomValue,
  getPowerPositionSelectValue,
  getResolvedPowerPosition,
  NO_POWER_POSITION_VALUE,
} from '@/utils/powerPositions';

describe('powerPositions', () => {
  it('returns the preset select value when the position matches a preset', () => {
    expect(getPowerPositionSelectValue('FOH', null)).toBe('FOH');
  });

  it('returns the custom select value when a custom position is provided', () => {
    expect(getPowerPositionSelectValue(undefined, 'Video Wall Left')).toBe(
      CUSTOM_POWER_POSITION_VALUE
    );
    expect(getPowerPositionCustomValue(undefined, 'Video Wall Left')).toBe(
      'Video Wall Left'
    );
    expect(getResolvedPowerPosition(undefined, 'Video Wall Left')).toBe(
      'Video Wall Left'
    );
  });

  it('returns the empty select value when no position is set', () => {
    expect(getPowerPositionSelectValue(undefined, undefined)).toBe(
      NO_POWER_POSITION_VALUE
    );
    expect(getResolvedPowerPosition(undefined, undefined)).toBe('');
  });
});
