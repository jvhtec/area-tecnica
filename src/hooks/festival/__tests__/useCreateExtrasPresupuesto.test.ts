import { describe, expect, it, vi } from "vitest";
import { formatArtistDateTimeForFlex } from "../useCreateExtrasPresupuesto";

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
});
