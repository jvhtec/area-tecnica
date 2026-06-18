import { describe, expect, it } from "vitest";

import { MapService } from "@/utils/hoja-de-ruta/pdf/services/map-service";

describe("MapService venue destinations", () => {
  it("prefers exact venue coordinates over address geocoding", () => {
    const url = MapService.generateVenueDestinationUrl({
      address: "An ambiguous plaza name",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    });

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.4552%2C-3.4776"
    );
  });

  it("falls back to the saved address when coordinates are unavailable", () => {
    const url = MapService.generateVenueDestinationUrl({
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
    });

    expect(url).toContain(
      "destination=Pl.%20Mayor%2C%2028850%20Torrej%C3%B3n%20de%20Ardoz"
    );
  });
});
