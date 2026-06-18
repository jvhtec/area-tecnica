import type { EventData } from "@/types/hoja-de-ruta";

type VenueCoordinatesInput = {
  lat?: unknown;
  lng?: unknown;
};

export type HojaVenueSource = {
  name?: string | null;
  address?: string | null;
  coordinates?: VenueCoordinatesInput | null;
};

const normalizeText = (value: string | null | undefined): string => value?.trim() || "";

const normalizeAddressForComparison = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const parseCoordinate = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const normalizeVenueCoordinates = (
  value: VenueCoordinatesInput | null | undefined
): { lat: number; lng: number } | undefined => {
  const lat = parseCoordinate(value?.lat);
  const lng = parseCoordinate(value?.lng);

  if (lat === undefined || lng === undefined) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;

  return { lat, lng };
};

/**
 * Resolves the venue stored in Hoja de Ruta against the job location fallback.
 *
 * A saved Hoja venue is authoritative because it may intentionally differ from
 * the job's catalog location. Job coordinates are only reused when the saved
 * address is empty or clearly matches the job address; otherwise mixing them
 * would make the displayed address and PDF map point to different places.
 */
export const resolveHojaVenue = (
  savedVenue: HojaVenueSource | null | undefined,
  jobVenue: HojaVenueSource | null | undefined
): NonNullable<EventData["venue"]> => {
  const savedName = normalizeText(savedVenue?.name);
  const savedAddress = normalizeText(savedVenue?.address);
  const savedCoordinates = normalizeVenueCoordinates(savedVenue?.coordinates);

  const jobName = normalizeText(jobVenue?.name);
  const jobAddress = normalizeText(jobVenue?.address);
  const jobCoordinates = normalizeVenueCoordinates(jobVenue?.coordinates);

  const addressesMatch =
    Boolean(savedAddress && jobAddress) &&
    normalizeAddressForComparison(savedAddress) === normalizeAddressForComparison(jobAddress);

  // Coordinates identify a location even when no formatted address was saved.
  // In that case, do not attach an unrelated job-catalog address to them.
  const address = savedAddress || (!savedCoordinates ? jobAddress : "");
  const coordinates =
    savedCoordinates ||
    (!savedAddress || addressesMatch ? jobCoordinates : undefined);

  return {
    name: savedName || jobName,
    address,
    ...(coordinates ? { coordinates } : {}),
  };
};
