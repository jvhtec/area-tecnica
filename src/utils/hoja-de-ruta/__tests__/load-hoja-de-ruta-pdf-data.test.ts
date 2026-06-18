import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

import { loadHojaDeRutaPdfData } from "@/utils/hoja-de-ruta/load-hoja-de-ruta-pdf-data";

type QueryResult = {
  data: unknown;
  error: unknown;
};

const createQuery = (result: QueryResult) => {
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: Promise<QueryResult>["then"];
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    then: Promise.resolve(result).then.bind(Promise.resolve(result)),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);

  return query;
};

describe("loadHojaDeRutaPdfData", () => {
  beforeEach(() => {
    fromMock.mockReset();

    const results: Record<string, QueryResult> = {
      hoja_de_ruta: {
        data: {
          id: "hoja-1",
          event_name: "Fiestas Populares Torrejón",
          event_dates: "18-23 junio",
          venue_name: "Plaza Mayor",
          venue_address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
          venue_latitude: 40.4552,
          venue_longitude: -3.4776,
          schedule: "",
        },
        error: null,
      },
      hoja_de_ruta_contacts: { data: [], error: null },
      hoja_de_ruta_transport: { data: [], error: null },
      hoja_de_ruta_images: { data: [], error: null },
      jobs: {
        data: { location_id: "catalog-location" },
        error: null,
      },
      locations: {
        data: {
          name: "Wrong catalog venue",
          formatted_address: "Wrong catalog address",
          latitude: 40.1,
          longitude: -3.1,
        },
        error: null,
      },
    };

    fromMock.mockImplementation((table: string) => createQuery(results[table]));
  });

  it("keeps the saved Hoja venue when a department can also read the job catalog location", async () => {
    const result = await loadHojaDeRutaPdfData("job-1");

    expect(result?.eventData.venue).toEqual({
      name: "Plaza Mayor",
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    });
  });
});
