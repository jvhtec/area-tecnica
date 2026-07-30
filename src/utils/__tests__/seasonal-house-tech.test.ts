import { describe, expect, it } from 'vitest';

import {
  buildSeasonalUnavailability,
  isSeasonalDateRangeValid,
  isWithinSeasonalAvailability,
} from '@/utils/seasonalHouseTech';

const seasonalProfile = {
  id: 'seasonal-1',
  role: 'house_tech',
  seasonal_house_tech: true,
  seasonal_house_tech_start_date: '2026-06-01',
  seasonal_house_tech_end_date: '2026-08-31',
};

describe('seasonal house tech availability', () => {
  it('treats both range endpoints as available', () => {
    expect(isWithinSeasonalAvailability(seasonalProfile, '2026-06-01')).toBe(true);
    expect(isWithinSeasonalAvailability(seasonalProfile, '2026-08-31')).toBe(true);
    expect(isWithinSeasonalAvailability(seasonalProfile, '2026-05-31')).toBe(false);
    expect(isWithinSeasonalAvailability(seasonalProfile, '2026-09-01')).toBe(false);
  });

  it('adds matrix unavailability only outside the configured season', () => {
    expect(buildSeasonalUnavailability(
      [seasonalProfile],
      '2026-05-30',
      '2026-06-02',
    )).toEqual([
      {
        user_id: 'seasonal-1',
        date: '2026-05-30',
        status: 'unavailable',
        notes: 'Fuera de temporada',
      },
      {
        user_id: 'seasonal-1',
        date: '2026-05-31',
        status: 'unavailable',
        notes: 'Fuera de temporada',
      },
    ]);
  });

  it('does not restrict ordinary house techs', () => {
    expect(isWithinSeasonalAvailability({
      ...seasonalProfile,
      seasonal_house_tech: false,
    }, '2026-01-01')).toBe(true);
  });

  it('treats a seasonal profile without a configured range as unavailable', () => {
    expect(isWithinSeasonalAvailability({
      ...seasonalProfile,
      seasonal_house_tech_start_date: null,
      seasonal_house_tech_end_date: null,
    }, '2026-07-01')).toBe(false);
  });

  it('validates complete Madrid date ranges without accepting normalized invalid dates', () => {
    expect(isSeasonalDateRangeValid('2026-06-01', '2026-08-31')).toBe(true);
    expect(isSeasonalDateRangeValid('2026-08-31', '2026-06-01')).toBe(false);
    expect(isSeasonalDateRangeValid('2026-02-31', '2026-08-31')).toBe(false);
    expect(isSeasonalDateRangeValid('', '2026-08-31')).toBe(false);
  });
});
