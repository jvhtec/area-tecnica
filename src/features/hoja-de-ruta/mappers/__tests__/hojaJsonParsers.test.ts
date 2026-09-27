import { describe, expect, it } from "vitest";

import {
  parseProgramDays,
  parseRestaurants,
  parseWeatherData,
} from "@/features/hoja-de-ruta/mappers/hojaJsonParsers";
import { isHojaAggregate, toHojaStatus } from "@/features/hoja-de-ruta/api/hojaDocumentApi";

describe("Hoja JSON column parsers", () => {
  it("keeps valid program rows and drops malformed entries and departments", () => {
    const days = parseProgramDays([
      {
        id: "day-1",
        label: "Montaje",
        rows: [
          { time: "09:00", item: "Descarga", notify: true, departments: ["sound", "catering"] },
          "not-a-row",
        ],
      },
      42,
    ]);

    expect(days).toEqual([
      {
        id: "day-1",
        label: "Montaje",
        date: undefined,
        rows: [{
          time: "09:00",
          item: "Descarga",
          dept: undefined,
          notes: undefined,
          id: undefined,
          notify: true,
          departments: ["sound"],
        }],
      },
    ]);
    expect(parseProgramDays(null)).toBeUndefined();
  });

  it("requires a date for weather entries and defaults missing numbers", () => {
    expect(parseWeatherData([{ date: "2032-03-01", maxTemp: 21 }, { maxTemp: 30 }])).toEqual([
      {
        date: "2032-03-01",
        condition: "",
        weatherCode: 0,
        maxTemp: 21,
        minTemp: 0,
        precipitationProbability: 0,
        icon: "",
      },
    ]);
  });

  it("keeps restaurants with an id and narrows their optional fields", () => {
    const [restaurant, ...rest] = parseRestaurants([
      {
        id: "place-1",
        name: "Casa Pepe",
        rating: 4.5,
        photos: ["a", 3],
        coordinates: { lat: 40.4, lng: -3.7 },
        originType: "hotel",
      },
      { name: "Sin id" },
    ]) ?? [];

    expect(rest).toHaveLength(0);
    expect(restaurant).toMatchObject({
      id: "place-1",
      name: "Casa Pepe",
      address: "",
      rating: 4.5,
      photos: ["a"],
      coordinates: { lat: 40.4, lng: -3.7 },
      googlePlaceId: "place-1",
      originType: "hotel",
    });
  });
});

describe("Hoja aggregate guard", () => {
  it("accepts the RPC projection shape and rejects anything else", () => {
    expect(isHojaAggregate({ main: { id: "h" }, staff: [], images: [{ id: "i" }] })).toBe(true);
    expect(isHojaAggregate({ main: null })).toBe(false);
    expect(isHojaAggregate({ main: {}, staff: ["x"] })).toBe(false);
    expect(isHojaAggregate([])).toBe(false);
  });

  it("maps unknown statuses to draft", () => {
    expect(toHojaStatus("final")).toBe("final");
    expect(toHojaStatus("published")).toBe("draft");
    expect(toHojaStatus(undefined)).toBe("draft");
  });
});
