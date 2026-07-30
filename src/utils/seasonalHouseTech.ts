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

const nextDateKey = (dateKey: string): string => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
