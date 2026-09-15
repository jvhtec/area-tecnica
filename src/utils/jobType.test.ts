import { describe, expect, it } from "vitest";

import { isDryHireJobType } from "./jobType";

describe("isDryHireJobType", () => {
  it("is true only for the canonical dry-hire job type", () => {
    expect(isDryHireJobType("dryhire")).toBe(true);
  });

  it("is false for other known job types", () => {
    expect(isDryHireJobType("single")).toBe(false);
    expect(isDryHireJobType("tourdate")).toBe(false);
  });

  it("is false for unknown or absent job types without throwing", () => {
    expect(isDryHireJobType("something-unexpected")).toBe(false);
    expect(isDryHireJobType(null)).toBe(false);
    expect(isDryHireJobType(undefined)).toBe(false);
  });
});
