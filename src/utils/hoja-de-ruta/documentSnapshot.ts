import type { Accommodation, EventData, TravelArrangement } from "@/types/hoja-de-ruta";

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const next = (value as Record<string, unknown>)[key];
        if (next !== undefined) acc[key] = normalize(next);
        return acc;
      }, {});
  }
  return value;
};

export const createHojaDocumentSnapshot = (
  eventData: EventData,
  travelArrangements: TravelArrangement[],
  accommodations: Accommodation[],
): string => JSON.stringify(normalize({
  eventData,
  travelArrangements,
  accommodations,
}));
