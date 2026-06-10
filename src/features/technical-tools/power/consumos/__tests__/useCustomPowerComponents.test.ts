import { describe, expect, it, vi } from "vitest";
import {
  customPowerComponentsStorageKey,
  readCustomPowerComponents,
  writeCustomPowerComponents,
} from "../useCustomPowerComponents";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("custom power component storage", () => {
  it("persists valid components independently by department", () => {
    const storage = new MemoryStorage();
    const soundComponent = {
      id: "custom:sound:1",
      name: "Amp rack",
      watts: 2400,
    };

    writeCustomPowerComponents("sound", [soundComponent], storage, "user-1");

    expect(readCustomPowerComponents("sound", storage, "user-1")).toEqual([
      soundComponent,
    ]);
    expect(readCustomPowerComponents("sound", storage, "user-2")).toEqual([]);
    expect(readCustomPowerComponents("video", storage, "user-1")).toEqual([]);
    expect(storage.getItem(customPowerComponentsStorageKey("sound", "user-1"))).toContain(
      "Amp rack",
    );
  });

  it("sanitizes invalid entries and defaults missing light fixture types", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      customPowerComponentsStorageKey("lights", "user-1"),
      JSON.stringify([
        {
          id: "custom:lights:1",
          name: "  LED bar  ",
          watts: "300",
          // weight was stored by the first localStorage implementation; it is
          // ignored now that the catalog has no weight parameter
          weightKg: "12.5",
          fixtureType: "not-a-fixture",
        },
        { id: "bad", name: "", watts: 0 },
      ]),
    );

    expect(readCustomPowerComponents("lights", storage, "user-1")).toEqual([
      {
        id: "custom:lights:1",
        name: "LED bar",
        watts: 300,
        fixtureType: "led",
      },
    ]);
  });

  it("returns an empty catalog for malformed storage", () => {
    const storage = new MemoryStorage();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    storage.setItem(customPowerComponentsStorageKey("video"), "not json");

    expect(readCustomPowerComponents("video", storage)).toEqual([]);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
