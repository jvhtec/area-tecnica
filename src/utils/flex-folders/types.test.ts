import { describe, expect, it } from "vitest";

import { normalizeCreateFoldersOptions } from "./types";

describe("normalizeCreateFoldersOptions", () => {
  it("discards a non-array custom pullsheet entries value", () => {
    expect(normalizeCreateFoldersOptions({
      sound: { customPullsheet: { enabled: true, name: "Custom", entries: { name: "bad" } } },
    })).toEqual({
      sound: { customPullsheet: { enabled: true, name: "Custom" } },
    });
  });

  it("discards a non-array extras budget entries value", () => {
    expect(normalizeCreateFoldersOptions({
      comercial: { extrasPresupuesto: { startDate: "2026-09-08", entries: "bad" } },
    })).toEqual({
      comercial: { extrasPresupuesto: { startDate: "2026-09-08" } },
    });
  });
});
