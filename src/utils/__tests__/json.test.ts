import { describe, expect, it } from "vitest";

import { toJsonValue } from "@/utils/json";

describe("toJsonValue", () => {
  it("matches JSON.stringify semantics for plain payloads", () => {
    const input = {
      name: "Hoja",
      count: 2,
      flag: false,
      missing: undefined,
      nested: { coordinates: undefined, lat: 40.4 },
      list: [1, undefined, "a"],
      bad: Number.NaN,
      when: new Date("2032-03-01T09:00:00.000Z"),
    };

    expect(toJsonValue(input)).toEqual(JSON.parse(JSON.stringify(input)));
  });

  it("maps top-level undefined to null", () => {
    expect(toJsonValue(undefined)).toBeNull();
  });
});
