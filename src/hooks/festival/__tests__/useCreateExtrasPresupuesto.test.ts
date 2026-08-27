import { describe, expect, it, vi } from "vitest";
import { parseISO } from "date-fns";
import {
  buildArtistFlexDateRange,
  formatArtistDateTimeForFlex,
  formatArtistExtrasFolderDocumentNumber,
} from "@/hooks/festival/useCreateExtrasPresupuesto";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/utils/flex-folders/api", () => ({
  createFlexFolder: vi.fn(),
}));

describe("formatArtistDateTimeForFlex", () => {
  it("formats artist local time in the Flex timestamp shape", () => {
    expect(formatArtistDateTimeForFlex("2026-07-18", "20:30")).toBe(
      "2026-07-18T20:30:00.000Z"
    );
  });

  it("preserves explicit seconds when present", () => {
    expect(formatArtistDateTimeForFlex("2026-07-18", "20:30:45")).toBe(
      "2026-07-18T20:30:45.000Z"
    );
  });

  it("rejects invalid artist times", () => {
    expect(() => formatArtistDateTimeForFlex("2026-07-18", "24:00")).toThrow(
      "Hora de artista invalida"
    );
  });

  it("reports a domain error instead of crashing when a time is null", () => {
    expect(() => formatArtistDateTimeForFlex("2026-07-18", null)).toThrow(
      "Hora de artista invalida para Flex: (vacia)"
    );
  });
});

describe("buildArtistFlexDateRange", () => {
  it("uses the festival operating day when the artist has no show times", () => {
    expect(
      buildArtistFlexDateRange("2026-08-05", null, null, false, "07:00")
    ).toEqual({
      plannedStartDate: "2026-08-05T07:00:00.000Z",
      plannedEndDate: "2026-08-06T07:00:00.000Z",
    });
  });

  it("preserves the artist show range when both times are available", () => {
    expect(
      buildArtistFlexDateRange("2026-08-05", "20:00", "21:30", false, "07:00")
    ).toEqual({
      plannedStartDate: "2026-08-05T20:00:00.000Z",
      plannedEndDate: "2026-08-05T21:30:00.000Z",
    });
  });
});

describe("formatArtistExtrasFolderDocumentNumber", () => {
  // The hook documents artistDate as YYYY-MM-DD and reaches this function via
  // parseISO(artistDate), i.e. a local-midnight calendar value. Building the
  // argument as a UTC-noon instant instead — as this test used to — asserted a
  // contract the function never sees, and only agreed with it below UTC+13:
  // at UTC+14 that instant is already the next local day, so the number read
  // "080526ESQT". Drive it the way the hook does.
  const fromArtistDate = (artistDate: string) =>
    formatArtistExtrasFolderDocumentNumber(parseISO(artistDate));

  it("uses the extras sound quote document number for the shared extras folder", () => {
    expect(fromArtistDate("2026-05-07")).toBe("070526ESQT");
  });

  it("names the artist's own day in any browser timezone", () => {
    // Regression guard: the day in the number must come from the key, not from
    // wherever the browser happens to be.
    expect(fromArtistDate("2026-01-01")).toBe("010126ESQT");
    expect(fromArtistDate("2026-12-31")).toBe("311226ESQT");
  });
});
