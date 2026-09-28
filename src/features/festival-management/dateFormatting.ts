import { isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

import {
  formatMadridDayKey,
  MADRID_TIMEZONE,
  madridDateKeyToCalendarDate,
} from "@/utils/timezoneUtils";

const UNKNOWN_DATE_LABEL = "Fecha desconocida";

export const formatFestivalInstant = (
  value: Date | string | null | undefined,
  pattern: string,
  fallback = UNKNOWN_DATE_LABEL,
): string => {
  if (!value) return fallback;

  const parsed = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(parsed)) return fallback;

  return formatInTimeZone(parsed, MADRID_TIMEZONE, pattern, { locale: es });
};

export const formatFestivalDayKey = (
  dateKey: string | null | undefined,
  pattern: string,
  fallback = UNKNOWN_DATE_LABEL,
): string => {
  if (!dateKey || !madridDateKeyToCalendarDate(dateKey)) return fallback;

  return formatMadridDayKey(dateKey, pattern, { locale: es });
};
