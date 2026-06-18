import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMockQueryBuilder,
  mockSupabase,
  resetMockSupabase,
  type MockSupabaseResult,
} from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

import { loadHojaDeRutaPdfData } from "@/utils/hoja-de-ruta/load-hoja-de-ruta-pdf-data";

describe("loadHojaDeRutaPdfData", () => {
  beforeEach(() => {
    resetMockSupabase();

    const results: Record<string, MockSupabaseResult> = {
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

    mockSupabase.from.mockImplementation((table: string) => {
      const result = results[table];
      if (!result) {
        throw new Error(`Unexpected mocked table: ${table}`);
      }
      return createMockQueryBuilder(result);
    });
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
