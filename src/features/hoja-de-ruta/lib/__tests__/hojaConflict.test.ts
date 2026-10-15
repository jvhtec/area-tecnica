import { describe, expect, it } from "vitest";

import { isHojaVersionConflict } from "@/features/hoja-de-ruta/lib/hojaConflict";

describe("isHojaVersionConflict", () => {
  it("recognises the PostgREST 409 conflict code", () => {
    expect(isHojaVersionConflict({ code: "PT409", message: "La Hoja de Ruta ha cambiado" })).toBe(true);
  });

  it("still recognises the legacy serialization_failure code", () => {
    expect(isHojaVersionConflict({ code: "40001" })).toBe(true);
  });

  it("ignores other errors and non-objects", () => {
    expect(isHojaVersionConflict({ code: "42501" })).toBe(false);
    expect(isHojaVersionConflict({ code: 409 })).toBe(false);
    expect(isHojaVersionConflict(new Error("boom"))).toBe(false);
    expect(isHojaVersionConflict(null)).toBe(false);
    expect(isHojaVersionConflict("PT409")).toBe(false);
  });
});
