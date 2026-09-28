import { describe, expect, it } from "vitest";

import {
  formatFestivalDayKey,
  formatFestivalInstant,
} from "@/features/festival-management/dateFormatting";

describe("festival date formatting", () => {
  it("renders instants in Madrid with the Spanish locale", () => {
    expect(
      formatFestivalInstant(
        "2026-06-03T22:30:00.000Z",
        "EEEE, d 'de' MMMM 'de' yyyy, HH:mm",
      ),
    ).toBe("jueves, 4 de junio de 2026, 00:30");
  });

  it("respects the Madrid DST boundary", () => {
    expect(formatFestivalInstant("2026-03-29T00:30:00.000Z", "dd/MM/yyyy HH:mm")).toBe(
      "29/03/2026 01:30",
    );
    expect(formatFestivalInstant("2026-03-29T22:30:00.000Z", "dd/MM/yyyy HH:mm")).toBe(
      "30/03/2026 00:30",
    );
  });

  it("keeps date-only values on their named Madrid calendar day", () => {
    expect(formatFestivalDayKey("2026-06-04", "EEEE, d 'de' MMMM 'de' yyyy")).toBe(
      "jueves, 4 de junio de 2026",
    );
  });

  it("returns explicit fallbacks for invalid values", () => {
    expect(formatFestivalInstant("not-a-date", "dd/MM/yyyy")).toBe("Fecha desconocida");
    expect(formatFestivalDayKey("2026-02-30", "dd/MM/yyyy", "Sin fecha")).toBe("Sin fecha");
  });
});
