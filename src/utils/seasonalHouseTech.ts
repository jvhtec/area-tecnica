import { addDays, isAfter, isValid } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const MADRID_TIMEZONE = 'Europe/Madrid';

export interface SeasonalHouseTechProfile {
  id: string;
  role?: string | null;
  seasonal_house_tech?: boolean | null;
  seasonal_house_tech_start_date?: string | null;
  seasonal_house_tech_end_date?: string | null;
}

export interface SeasonalUnavailabilityDay {
  user_id: string;
  date: string;
  status: 'unavailable';
  notes: string;
}

export const isSeasonalHouseTech = (profile: SeasonalHouseTechProfile): boolean =>
  profile.role === 'house_tech' && profile.seasonal_house_tech === true;

export const isWithinSeasonalAvailability = (
  profile: SeasonalHouseTechProfile,
  dateKey: string,
): boolean => {
  if (!isSeasonalHouseTech(profile)) return true;

  const startDate = profile.seasonal_house_tech_start_date;
  const endDate = profile.seasonal_house_tech_end_date;
  return Boolean(startDate && endDate && dateKey >= startDate && dateKey <= endDate);
};

const parseMadridDateKey = (dateKey: string): Date =>
  fromZonedTime(`${dateKey}T12:00:00`, MADRID_TIMEZONE);

const isValidMadridDateKey = (dateKey: string, date: Date): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
  && isValid(date)
  && formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd') === dateKey;

export const isSeasonalDateRangeValid = (startDateKey: string, endDateKey: string): boolean => {
  if (!startDateKey || !endDateKey) return false;

  const startDate = parseMadridDateKey(startDateKey);
  const endDate = parseMadridDateKey(endDateKey);
  return isValidMadridDateKey(startDateKey, startDate)
    && isValidMadridDateKey(endDateKey, endDate)
    && !isAfter(startDate, endDate);
};

const nextDateKey = (dateKey: string): string => {
  const madridNoonUtc = parseMadridDateKey(dateKey);
  if (!isValid(madridNoonUtc)) return dateKey;
  return formatInTimeZone(addDays(madridNoonUtc, 1), MADRID_TIMEZONE, 'yyyy-MM-dd');
};

export const buildSeasonalUnavailability = (
  profiles: SeasonalHouseTechProfile[],
  startDateKey: string,
  endDateKey: string,
): SeasonalUnavailabilityDay[] => {
  if (!startDateKey || !endDateKey || startDateKey > endDateKey) return [];

  const unavailable: SeasonalUnavailabilityDay[] = [];
  for (const profile of profiles.filter(isSeasonalHouseTech)) {
    let dateKey = startDateKey;
    while (dateKey <= endDateKey) {
      if (!isWithinSeasonalAvailability(profile, dateKey)) {
        unavailable.push({
          user_id: profile.id,
          date: dateKey,
          status: 'unavailable',
          notes: 'Fuera de temporada',
        });
      }

      const next = nextDateKey(dateKey);
      if (next === dateKey) break;
      dateKey = next;
    }
  }

  return unavailable;
};
