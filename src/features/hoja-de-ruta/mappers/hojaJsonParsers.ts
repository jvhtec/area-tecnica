// Parsers for the Hoja's JSON columns (program schedule, weather snapshot and
// restaurant search results). They narrow stored JSON field by field instead of
// trusting its shape, and drop entries that cannot be used.
import { ACTIVE_DEPARTMENTS, type ActiveDepartment } from "@/types/department";
import type {
  ProgramDay,
  ProgramRow,
  Restaurant,
  WeatherData,
} from "@/types/hoja-de-ruta";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const finite = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const stringList = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : undefined;

const isActiveDepartment = (value: unknown): value is ActiveDepartment =>
  ACTIVE_DEPARTMENTS.some((department) => department === value);

const parseProgramRow = (value: unknown): ProgramRow | null => {
  if (!isRecord(value)) return null;
  const departments = Array.isArray(value.departments)
    ? value.departments.filter(isActiveDepartment)
    : undefined;
  return {
    time: text(value.time) ?? "",
    item: text(value.item) ?? "",
    dept: text(value.dept),
    notes: text(value.notes),
    id: text(value.id),
    notify: typeof value.notify === "boolean" ? value.notify : undefined,
    departments,
  };
};

export const parseProgramDays = (value: unknown): ProgramDay[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((day): ProgramDay[] => {
    if (!isRecord(day)) return [];
    const rows = Array.isArray(day.rows)
      ? day.rows.map(parseProgramRow).filter((row): row is ProgramRow => row !== null)
      : [];
    return [{ id: text(day.id), label: text(day.label), date: text(day.date), rows }];
  });
};

export const parseWeatherData = (value: unknown): WeatherData[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry): WeatherData[] => {
    if (!isRecord(entry) || typeof entry.date !== "string") return [];
    return [{
      date: entry.date,
      condition: text(entry.condition) ?? "",
      weatherCode: finite(entry.weatherCode) ?? 0,
      maxTemp: finite(entry.maxTemp) ?? 0,
      minTemp: finite(entry.minTemp) ?? 0,
      precipitationProbability: finite(entry.precipitationProbability) ?? 0,
      icon: text(entry.icon) ?? "",
    }];
  });
};

const parseOriginType = (value: unknown): Restaurant["originType"] =>
  value === "venue" || value === "hotel" || value === "custom" ? value : undefined;

export const parseRestaurants = (value: unknown): Restaurant[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry): Restaurant[] => {
    if (!isRecord(entry) || typeof entry.id !== "string") return [];
    const coordinates = isRecord(entry.coordinates)
      && finite(entry.coordinates.lat) !== undefined
      && finite(entry.coordinates.lng) !== undefined
      ? { lat: Number(entry.coordinates.lat), lng: Number(entry.coordinates.lng) }
      : undefined;
    return [{
      id: entry.id,
      name: text(entry.name) ?? "",
      address: text(entry.address) ?? "",
      rating: finite(entry.rating),
      priceLevel: finite(entry.priceLevel),
      photos: stringList(entry.photos),
      cuisine: stringList(entry.cuisine),
      phone: text(entry.phone),
      website: text(entry.website),
      coordinates,
      distance: finite(entry.distance),
      googlePlaceId: text(entry.googlePlaceId) ?? entry.id,
      isSelected: typeof entry.isSelected === "boolean" ? entry.isSelected : undefined,
      originType: parseOriginType(entry.originType),
      originLabel: text(entry.originLabel),
    }];
  });
};
