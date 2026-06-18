import { describe, expect, it } from "vitest";

import { resolveFestivalVenueData } from "@/features/festival-management/queries";

describe("resolveFestivalVenueData", () => {
  const catalogLocation = {
    name: "Catalog venue",
    formatted_address: "Wrong catalog address",
    latitude: 40.1,
    longitude: -3.1,
  };

  it("uses the saved Hoja venue for production/festival outputs", () => {
    expect(resolveFestivalVenueData({
      venue_name: "Plaza Mayor",
      venue_address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
      venue_latitude: 40.4552,
      venue_longitude: -3.4776,
    }, catalogLocation)).toEqual({
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    });
  });

  it("uses the catalog location only when the Hoja has no venue", () => {
    expect(resolveFestivalVenueData(null, catalogLocation)).toEqual({
      address: "Wrong catalog address",
      coordinates: { lat: 40.1, lng: -3.1 },
    });
  });
});
