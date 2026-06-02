import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWeatherForJob, parseEventDates } from "@/utils/weather/weatherApi";

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const weatherResponse = {
  daily: {
    time: ["2026-06-03"],
    temperature_2m_max: [28],
    temperature_2m_min: [17],
    precipitation_sum: [0],
    weathercode: [0],
  },
  timezone: "Europe/Madrid",
};

describe("parseEventDates", () => {
  it("parses es-ES numeric dates as day-month-year", () => {
    const range = parseEventDates("3/6/2026");

    expect(range).not.toBeNull();
    expect(dateKey(range!.startDate)).toBe("2026-06-03");
    expect(dateKey(range!.endDate)).toBe("2026-06-03");
  });

  it("parses explicit ISO date ranges", () => {
    const range = parseEventDates("2026-06-03 - 2026-06-05");

    expect(range).not.toBeNull();
    expect(dateKey(range!.startDate)).toBe("2026-06-03");
    expect(dateKey(range!.endDate)).toBe("2026-06-05");
  });

  it("parses Spanish month day ranges from the event placeholder format", () => {
    const range = parseEventDates("15-17 Junio 2026");

    expect(range).not.toBeNull();
    expect(dateKey(range!.startDate)).toBe("2026-06-15");
    expect(dateKey(range!.endDate)).toBe("2026-06-17");
  });

  it("rejects invalid calendar dates instead of normalizing them", () => {
    expect(parseEventDates("31/2/2026")).toBeNull();
  });
});

describe("getWeatherForJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 2, 12));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests Open-Meteo with local calendar dates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(weatherResponse), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWeatherForJob(
      { coordinates: { lat: 40.3448304, lng: -3.5147915 } },
      "3/6/2026"
    );

    expect(result).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("start_date=2026-06-03");
    expect(url).toContain("end_date=2026-06-03");
  });

  it("does not call the forecast API for past event dates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWeatherForJob(
      { coordinates: { lat: 40.3448304, lng: -3.5147915 } },
      "3/6/2006"
    );

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
