import { describe, expect, it } from "vitest";

import {
  normalizeVenueCoordinates,
  resolveHojaVenue,
} from "@/utils/hoja-de-ruta/venue-resolution";

describe("resolveHojaVenue", () => {
  const jobVenue = {
    name: "Catalog venue",
    address: "Wrong catalog address",
    coordinates: { lat: 40.1, lng: -3.1 },
  };

  it("keeps a saved Hoja venue authoritative over the job location", () => {
    expect(resolveHojaVenue({
      name: "Plaza Mayor",
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    }, jobVenue)).toEqual({
      name: "Plaza Mayor",
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    });
  });

  it("does not mix job coordinates with a different saved address", () => {
    expect(resolveHojaVenue({
      name: "Plaza Mayor",
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
    }, jobVenue)).toEqual({
      name: "Plaza Mayor",
      address: "Pl. Mayor, 28850 Torrejón de Ardoz, Madrid, España",
    });
  });

  it("uses job coordinates when both sources refer to the same address", () => {
    expect(resolveHojaVenue({
      name: "Plaza Mayor",
      address: "PL. MAYOR, 28850 TORREJÓN DE ARDOZ, MADRID, ESPAÑA",
    }, {
      ...jobVenue,
      address: "Pl. Mayor, 28850 Torrejon de Ardoz, Madrid, Espana",
    })).toEqual({
      name: "Plaza Mayor",
      address: "PL. MAYOR, 28850 TORREJÓN DE ARDOZ, MADRID, ESPAÑA",
      coordinates: { lat: 40.1, lng: -3.1 },
    });
  });

  it("does not attach a job address to saved coordinates without an address", () => {
    expect(resolveHojaVenue({
      name: "Pinned venue",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    }, jobVenue)).toEqual({
      name: "Pinned venue",
      address: "",
      coordinates: { lat: 40.4552, lng: -3.4776 },
    });
  });

  it("falls back to the job venue when Hoja has no venue data", () => {
    expect(resolveHojaVenue(null, jobVenue)).toEqual(jobVenue);
  });
});

describe("normalizeVenueCoordinates", () => {
  it("accepts numeric database strings and rejects invalid ranges", () => {
    expect(normalizeVenueCoordinates({ lat: "40.4552", lng: "-3.4776" })).toEqual({
      lat: 40.4552,
      lng: -3.4776,
    });
    expect(normalizeVenueCoordinates({ lat: 120, lng: -3.4776 })).toBeUndefined();
  });

  it("rejects partially numeric coordinate strings", () => {
    expect(normalizeVenueCoordinates({
      lat: "40.4552abc",
      lng: "-3.4776",
    })).toBeUndefined();
  });
});
