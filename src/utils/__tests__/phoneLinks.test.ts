import { describe, expect, it } from "vitest";

import { buildTelHref, buildWhatsAppHref, normalizePhoneToE164 } from "@/utils/phoneLinks";

describe("normalizePhoneToE164", () => {
  it("keeps numbers that already carry a country code", () => {
    expect(normalizePhoneToE164("+34600111222")).toBe("+34600111222");
  });

  it("strips the separators crew type into their profile", () => {
    expect(normalizePhoneToE164(" +34 600 11 12 22 ")).toBe("+34600111222");
    expect(normalizePhoneToE164("+34-600-111-222")).toBe("+34600111222");
    expect(normalizePhoneToE164("(+34) 600.111.222")).toBe("+34600111222");
  });

  it("rewrites the international 00 prefix", () => {
    expect(normalizePhoneToE164("0034600111222")).toBe("+34600111222");
  });

  it("prepends +34 for Spanish mobile numbers written without a country code", () => {
    expect(normalizePhoneToE164("600111222")).toBe("+34600111222");
    expect(normalizePhoneToE164("711222333")).toBe("+34711222333");
  });

  it("passes through a country code typed without + or 00", () => {
    // Regression: this used to become +3434600111222, which still satisfies the
    // E.164 shape and so silently produced a link to the wrong number.
    expect(normalizePhoneToE164("34600111222")).toBe("+34600111222");
    expect(normalizePhoneToE164("34 600 11 12 22")).toBe("+34600111222");
    expect(normalizePhoneToE164("34911222333")).toBe("+34911222333");
  });

  it("falls back to the default country code for other local numbers", () => {
    expect(normalizePhoneToE164("911222333")).toBe("+34911222333");
  });

  it("rejects values that are not dialable", () => {
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(undefined)).toBeNull();
    expect(normalizePhoneToE164("   ")).toBeNull();
    expect(normalizePhoneToE164("no tiene")).toBeNull();
    expect(normalizePhoneToE164("+34600")).toBeNull();
    expect(normalizePhoneToE164("+3460011122233445566")).toBeNull();
  });
});

describe("buildTelHref", () => {
  it("builds a tel href from a normalized number", () => {
    expect(buildTelHref("600 111 222")).toBe("tel:+34600111222");
  });

  it("returns null when the number is unusable", () => {
    expect(buildTelHref("")).toBeNull();
  });
});

describe("buildWhatsAppHref", () => {
  it("drops the leading plus because wa.me expects bare digits", () => {
    expect(buildWhatsAppHref("+34600111222")).toBe("https://wa.me/34600111222");
  });

  it("encodes a prefilled message", () => {
    expect(buildWhatsAppHref("600111222", "Hola Ana, soy Luis (Festival Río)")).toBe(
      "https://wa.me/34600111222?text=Hola%20Ana%2C%20soy%20Luis%20(Festival%20R%C3%ADo)",
    );
  });

  it("returns null when the number is unusable", () => {
    expect(buildWhatsAppHref("sin teléfono")).toBeNull();
  });
});
