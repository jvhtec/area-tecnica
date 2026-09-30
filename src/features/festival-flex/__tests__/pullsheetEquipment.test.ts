import { describe, expect, it } from "vitest";

import { ALL_SECTIONS_ENABLED } from "@/components/festival/push-to-flex-pullsheet/model";
import type { GearSetupFormData } from "@/types/festival-gear";
import {
  collectGearLines,
  gearModelNames,
  iemQuantity,
  matchGearToResources,
  matchPresetToResources,
  mergeEquipmentToPush,
  wirelessQuantity,
} from "../pullsheetEquipment";

const gear = (overrides: Partial<GearSetupFormData> = {}) =>
  ({
    foh_consoles: [],
    mon_consoles: [],
    wireless_systems: [],
    iem_systems: [],
    wired_mics: [],
    ...overrides,
  }) as unknown as GearSetupFormData;

describe("quantities", () => {
  it("counts wireless channels plus transmitters, falling back to the legacy quantity", () => {
    expect(wirelessQuantity({ model: "x", quantity_ch: 8, quantity_hh: 2, quantity_bp: 4 } as never)).toBe(14);
    expect(wirelessQuantity({ model: "x", quantity: 6 } as never)).toBe(6);
    expect(wirelessQuantity({ model: "x" } as never)).toBe(0);
  });

  it("counts IEM handhelds (or the legacy quantity) plus bodypacks", () => {
    expect(iemQuantity({ model: "x", quantity_hh: 4, quantity_bp: 2 } as never)).toBe(6);
    expect(iemQuantity({ model: "x", quantity: 3 } as never)).toBe(3);
  });
});

describe("collectGearLines", () => {
  const setup = gear({
    foh_consoles: [{ model: "SD12", quantity: 1 }] as never,
    mon_consoles: [{ model: "SD10", quantity: 0 }, { model: "", quantity: 2 }] as never,
    wireless_systems: [{ model: "AD4Q", quantity_ch: 4 }] as never,
    iem_systems: [{ model: "PSM1000", quantity_hh: 2, quantity_bp: 2 }] as never,
    wired_mics: [{ model: "SM58", quantity: 12 }] as never,
  });

  it("keeps the gear with a model and a positive quantity, tagged with its category", () => {
    expect(collectGearLines(setup, ALL_SECTIONS_ENABLED)).toEqual([
      { model: "SD12", quantity: 1, category: "foh_console" },
      { model: "AD4Q", quantity: 4, category: "wireless" },
      { model: "PSM1000", quantity: 4, category: "iem" },
      { model: "SM58", quantity: 12, category: "wired_mics" },
    ]);
  });

  it("leaves out the sections that are switched off", () => {
    const lines = collectGearLines(setup, { ...ALL_SECTIONS_ENABLED, rf: false, wired_mics: false });
    expect(lines.map((line) => line.model)).toEqual(["SD12", "PSM1000"]);
  });

  it("lists each model once, sorted", () => {
    expect(gearModelNames([
      { model: "b", quantity: 1, category: "x" },
      { model: "a", quantity: 1, category: "x" },
      { model: "b", quantity: 2, category: "y" },
    ])).toEqual(["a", "b"]);
  });
});

describe("matchGearToResources", () => {
  it("adds up lines that share a resource and reports unlinked models once", () => {
    const result = matchGearToResources(
      [
        { model: "SM58", quantity: 4, category: "wired_mics" },
        { model: "SM58 (alt)", quantity: 6, category: "wired_mics" },
        { model: "Unlinked", quantity: 1, category: "iem" },
        { model: "Unlinked", quantity: 2, category: "iem" },
      ],
      new Map([
        ["SM58", "res-1"],
        ["SM58 (alt)", "res-1"],
      ]),
    );

    expect(result.found).toEqual([{ resourceId: "res-1", quantity: 10, name: "SM58", category: "wired_mics" }]);
    expect(result.missing).toEqual(["Unlinked"]);
  });
});

describe("matchPresetToResources", () => {
  const row = (overrides: Record<string, unknown>) =>
    ({
      quantity: 2,
      subsystem: null,
      equipment: { id: "e", name: "Main", category: "pa_mains", resource_id: "res-main" },
      ...overrides,
    }) as never;

  it("keeps PA items with a resource, merged per resource and subsystem", () => {
    const result = matchPresetToResources([row({}), row({ quantity: 4 })]);
    expect(result.found).toHaveLength(1);
    expect(result.found[0]).toMatchObject({ resourceId: "res-main", quantity: 6, name: "Main" });
  });

  it("reports PA items with no resource, and ignores other categories and empty quantities", () => {
    const result = matchPresetToResources([
      row({ equipment: { id: "e2", name: "Sub", category: "pa_subs", resource_id: null } }),
      row({ equipment: { id: "e3", name: "Mic", category: "wired_mics", resource_id: "res-mic" } }),
      row({ quantity: 0 }),
      row({ equipment: null }),
    ]);
    expect(result.missing).toEqual(["Sub"]);
    expect(result.found).toEqual([]);
  });

  it("accepts an embedded equipment row that arrives as an array", () => {
    const result = matchPresetToResources([
      row({ equipment: [{ id: "e", name: "Main", category: "pa_mains", resource_id: "res-main" }] }),
    ]);
    expect(result.found[0].resourceId).toBe("res-main");
  });
});

describe("mergeEquipmentToPush", () => {
  it("merges the same resource across groups and gives a line the subsystem its category implies", () => {
    const merged = mergeEquipmentToPush(
      [{ resourceId: "r", quantity: 1, name: "Main", category: "pa_mains" }],
      [{ resourceId: "r", quantity: 3, name: "Main", category: "pa_mains", subsystem: "mains" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(4);
    expect(merged[0].subsystem).toBeTruthy();
  });

  it("does not modify its input", () => {
    const input = [{ resourceId: "r", quantity: 1, name: "X", category: "wired_mics" }];
    mergeEquipmentToPush(input, input);
    expect(input[0].quantity).toBe(1);
  });
});
