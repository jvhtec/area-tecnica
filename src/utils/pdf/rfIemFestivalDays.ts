import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { ArtistRfIemData } from '@/utils/pdf/rfIemTableTypes';

const FESTIVAL_DAY_ROLLOVER_HOUR = 7;
const MADRID_TIMEZONE = 'Europe/Madrid';

function parseTimeToMinutes(value: string | null | undefined): number {
  if (!value || typeof value !== 'string') return Number.NaN;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) return Number.NaN;

  const hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const second = Number(match[3] || '0');
  if (![hour, minute, second].every(Number.isFinite)) return Number.NaN;
  if (hour > 23 || minute > 59 || second > 59) return Number.NaN;
  return hour * 60 + minute + second / 60;
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const utcDate = fromZonedTime(`${value}T00:00:00`, MADRID_TIMEZONE);
  return Number.isNaN(utcDate.getTime()) ? null : utcDate;
}

function toMadridIsoDate(value: Date): string {
  return format(toZonedTime(value, MADRID_TIMEZONE), 'yyyy-MM-dd');
}

function getShowSortMinutes(artist: ArtistRfIemData): number {
  const parsed = parseTimeToMinutes(artist.showStart);
  if (!Number.isFinite(parsed)) return Number.MAX_SAFE_INTEGER;
  return parsed >= FESTIVAL_DAY_ROLLOVER_HOUR * 60
    ? parsed
    : parsed + 24 * 60;
}

export function computeRfIemFestivalDayKey(artist: ArtistRfIemData): string {
  const parsedDate = parseIsoDate(artist.date);
  if (!parsedDate) return 'Sin fecha';

  const showMinutes = parseTimeToMinutes(artist.showStart);
  const shouldUsePreviousDay = artist.isAfterMidnight !== true
    && Number.isFinite(showMinutes)
    && showMinutes < FESTIVAL_DAY_ROLLOVER_HOUR * 60;
  if (!shouldUsePreviousDay) return toMadridIsoDate(parsedDate);

  const madridDate = toZonedTime(parsedDate, MADRID_TIMEZONE);
  madridDate.setDate(madridDate.getDate() - 1);
  return format(madridDate, 'yyyy-MM-dd');
}

function formatFestivalDayLabel(dayKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey;
  const parsed = parseIsoDate(dayKey);
  return parsed
    ? format(toZonedTime(parsed, MADRID_TIMEZONE), 'dd/MM/yyyy', { locale: es })
    : dayKey;
}

export function groupArtistsByFestivalDay(artists: ArtistRfIemData[]): Array<{
  key: string;
  label: string;
  artists: ArtistRfIemData[];
}> {
  const sorted = [...artists].sort((first, second) => {
    const firstDay = computeRfIemFestivalDayKey(first);
    const secondDay = computeRfIemFestivalDayKey(second);
    if (firstDay !== secondDay) return firstDay.localeCompare(secondDay);

    const firstTime = getShowSortMinutes(first);
    const secondTime = getShowSortMinutes(second);
    if (firstTime !== secondTime) return firstTime - secondTime;
    if (first.stage !== second.stage) return first.stage - second.stage;
    return (first.name || '').localeCompare(second.name || '');
  });

  const grouped = new Map<string, ArtistRfIemData[]>();
  for (const artist of sorted) {
    const dayKey = computeRfIemFestivalDayKey(artist);
    const group = grouped.get(dayKey) || [];
    group.push(artist);
    grouped.set(dayKey, group);
  }

  return [...grouped.entries()].map(([key, groupArtists]) => ({
    key,
    label: formatFestivalDayLabel(key),
    artists: groupArtists,
  }));
}
