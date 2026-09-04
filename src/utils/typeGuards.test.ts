import { describe, expect, it } from "vitest";

import { isNonBlankString } from "@/utils/typeGuards";

describe("isNonBlankString", () => {
  it("keeps visible strings and rejects missing or whitespace-only values", () => {
    expect([null, undefined, "", "   ", " sound "].filter(isNonBlankString)).toEqual([" sound "]);
  });
});
