import { describe, expect, it, vi } from "vitest";

vi.mock("./config.ts", () => ({ EVENT_TYPES: {} }));

import { validateInternalUrl } from "./urls.ts";

describe("validateInternalUrl", () => {
  it("accepts and normalizes app-local destinations", () => {
    expect(validateInternalUrl("/dashboard?showMessages=true#latest"))
      .toBe("/dashboard?showMessages=true#latest");
  });

  it.each([
    "https://outside.invalid/path",
    "//outside.invalid/path",
    "/\\outside.invalid/path",
    "/%5coutside.invalid/path",
    " /dashboard",
    "/dashboard\n",
  ])("rejects unsafe destination %s", (url) => {
    expect(validateInternalUrl(url)).toBeUndefined();
  });
});
