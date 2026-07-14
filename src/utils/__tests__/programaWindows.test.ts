import { describe, expect, it } from "vitest";

import type { ProgramDay } from "@/types/hoja-de-ruta";
import { deriveProgramaWindow } from "@/utils/programaWindows";

const day = (rows: Array<{ time: string }>, date?: string): ProgramDay => ({
  date,
  rows: rows.map((row, index) => ({ id: `row-${index}`, item: `Item ${index}`, ...row })),
});

describe("deriveProgramaWindow", () => {
  it("returns null without programa days or valid times", () => {
    expect(deriveProgramaWindow(null, "2026-07-13")).toBeNull();
    expect(deriveProgramaWindow([], "2026-07-13")).toBeNull();
    expect(deriveProgramaWindow([day([{ time: "" }, { time: "luego" }])], "2026-07-13")).toBeNull();
  });

  it("takes first and last row time of the matching dated day", () => {
    const window = deriveProgramaWindow(
      [
        day([{ time: "18:00" }, { time: "09:30" }, { time: "23:45" }], "2026-07-13"),
        day([{ time: "07:00" }], "2026-07-14"),
      ],
      "2026-07-13",
    );

    expect(window).not.toBeNull();
    expect(window!.startLabel).toBe("09:30");
    expect(window!.endLabel).toBe("23:45");
    expect(window!.rowCount).toBe(3);
    // 09:30 Madrid in July is 07:30 UTC (CEST, UTC+2)
    expect(window!.start.toISOString()).toBe("2026-07-13T07:30:00.000Z");
    expect(window!.end.toISOString()).toBe("2026-07-13T21:45:00.000Z");
  });

  it("includes undated days on any requested date, like the push programa feed", () => {
    const window = deriveProgramaWindow(
      [day([{ time: "11:00" }, { time: "20:00" }])],
      "2026-07-15",
    );

    expect(window!.startLabel).toBe("11:00");
    expect(window!.endLabel).toBe("20:00");
  });

  it("excludes days dated for other dates and pads single-digit hours", () => {
    const window = deriveProgramaWindow(
      [
        day([{ time: "9:15" }], "2026-07-13"),
        day([{ time: "06:00" }], "2026-07-12"),
      ],
      "2026-07-13",
    );

    expect(window!.startLabel).toBe("09:15");
    expect(window!.endLabel).toBe("09:15");
    expect(window!.rowCount).toBe(1);
  });
});
