import { describe, expect, it } from "vitest";

import {
  formatCalendarArtistSummary,
  getCalendarArtistNamesForDate,
  getCalendarJobDisplayTitle,
} from "@/utils/calendarArtists";

describe("calendar artist helpers", () => {
  const job = {
    title: "Fiestas Populares Torrejon",
    festival_artists: [
      {
        id: "artist-1",
        name: "Alpha",
        date: "2026-06-19",
        show_start: "21:00",
        stage: 2,
      },
      {
        id: "artist-2",
        name: "Beta",
        date: "2026-06-18",
        show_start: "20:00",
        stage: 1,
      },
      {
        id: "artist-3",
        name: "Gamma",
        date: "2026-06-19",
        show_start: "23:30",
        stage: 1,
      },
      {
        id: "artist-4",
        name: "After Midnight",
        date: "2026-06-19",
        show_start: "01:00",
        stage: 1,
        isaftermidnight: true,
      },
    ],
  };

  it("returns artist names for the selected calendar day only", () => {
    expect(getCalendarArtistNamesForDate(job, new Date(2026, 5, 19))).toEqual([
      "Alpha",
      "Gamma",
      "After Midnight",
    ]);
  });

  it("adds a compact artist suffix to calendar job titles", () => {
    expect(getCalendarJobDisplayTitle(job, new Date(2026, 5, 19))).toBe(
      "Fiestas Populares Torrejon - Alpha, Gamma +1",
    );
  });

  it("omits the artist suffix when no artist is configured for the date", () => {
    expect(getCalendarJobDisplayTitle(job, new Date(2026, 5, 20))).toBe("Fiestas Populares Torrejon");
  });

  it("uses a Spanish fallback title when a job title is missing", () => {
    expect(getCalendarJobDisplayTitle({ festival_artists: [] }, new Date(2026, 5, 20))).toBe("Trabajo sin título");
  });

  it("formats all artists when the summary fits inside the visible limit", () => {
    expect(formatCalendarArtistSummary(["Alpha", "Beta"], 2)).toBe("Alpha, Beta");
  });
});
