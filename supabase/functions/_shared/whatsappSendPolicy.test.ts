import { describe, expect, it } from "vitest";

import { resolveWhatsappSendConcurrency } from "./whatsappSendPolicy";

describe("resolveWhatsappSendConcurrency", () => {
  it("defaults bulk sends to one sequential worker", () => {
    expect(resolveWhatsappSendConcurrency(undefined)).toBe(1);
  });

  it("honors an explicit bounded override", () => {
    expect(resolveWhatsappSendConcurrency("3")).toBe(3);
    expect(resolveWhatsappSendConcurrency("20")).toBe(4);
  });

  it("uses the sequential default for invalid values", () => {
    expect(resolveWhatsappSendConcurrency("not-a-number")).toBe(1);
  });
});
