import { describe, expect, it } from "vitest";

import { joinedMany, joinedSingle } from "./joins.ts";

describe("PostgREST embedded join normalization", () => {
  it("returns the first row from array-shaped to-one joins", () => {
    expect(joinedSingle([{ id: "first" }, { id: "second" }])).toEqual({ id: "first" });
  });

  it("preserves object-shaped to-one joins and normalizes missing values", () => {
    const row = { id: "only" };

    expect(joinedSingle(row)).toBe(row);
    expect(joinedSingle([])).toBeNull();
    expect(joinedSingle(null)).toBeNull();
    expect(joinedSingle(undefined)).toBeNull();
  });

  it("preserves array-shaped to-many joins and wraps a single object", () => {
    const rows = [{ id: "one" }, { id: "two" }];
    const row = { id: "only" };

    expect(joinedMany(rows)).toBe(rows);
    expect(joinedMany(row)).toEqual([row]);
  });

  it("normalizes missing to-many joins to an empty array", () => {
    expect(joinedMany(null)).toEqual([]);
    expect(joinedMany(undefined)).toEqual([]);
  });
});
