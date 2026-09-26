import { describe, expect, it } from "vitest";

import { maskDni } from "@/utils/hoja-de-ruta/maskDni";

describe("maskDni", () => {
  it("returns an empty string for empty or missing input", () => {
    expect(maskDni("")).toBe("");
    expect(maskDni(undefined)).toBe("");
    expect(maskDni(null)).toBe("");
    expect(maskDni("   ")).toBe("");
  });

  it("masks every character but the last four", () => {
    expect(maskDni("12345678A")).toBe("•••••678A");
  });

  it("masks short values entirely", () => {
    expect(maskDni("123")).toBe("•••");
    expect(maskDni("1234")).toBe("••••");
  });

  it("trims surrounding whitespace before masking", () => {
    expect(maskDni("  12345678A  ")).toBe("•••••678A");
  });
});
