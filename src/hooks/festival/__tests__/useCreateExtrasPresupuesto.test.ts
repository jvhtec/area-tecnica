import { describe, expect, it, vi } from "vitest";
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
  it("uses the extras sound quote document number for the shared extras folder", () => {
    expect(formatArtistExtrasFolderDocumentNumber(new Date("2026-05-07T12:00:00.000Z"))).toBe(
      "070526ESQT"
    );
  });
});
