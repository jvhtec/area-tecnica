import { describe, expect, it } from "vitest";

import {
  canonicalStaffDepartment,
  groupStaffByDepartment,
} from "@/features/hoja-de-ruta/model/groupStaffByDepartment";

type Staff = { name: string; department?: string | null };

describe("groupStaffByDepartment", () => {
  it("places each member in exactly one group, preserving original index", () => {
    const staff: Staff[] = [
      { name: "Ana", department: "sound" },
      { name: "Beto", department: "lights" },
      { name: "Carla", department: "sound" },
    ];

    const groups = groupStaffByDepartment(staff);
    const totalMembers = groups.reduce((sum, group) => sum + group.members.length, 0);
    expect(totalMembers).toBe(staff.length);

    const soundGroup = groups.find((g) => g.department === "sound");
    expect(soundGroup?.members.map((m) => m.index)).toEqual([0, 2]);
  });

  it("merges profile enum keys and Spanish manual entries into one Spanish-labelled group", () => {
    const staff: Staff[] = [
      { name: "A", department: "sound" },
      { name: "B", department: "Sonido" },
      { name: "C", department: "Iluminación" },
      { name: "D", department: "lights" },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups.map((g) => [g.department, g.label, g.members.length])).toEqual([
      ["sound", "Sonido", 2],
      ["lights", "Iluminación", 2],
    ]);
  });

  it("orders canonical departments first, in the fixed sequence", () => {
    const staff: Staff[] = [
      { name: "A", department: "logistica" },
      { name: "B", department: "video" },
      { name: "C", department: "produccion" },
      { name: "D", department: "sonido" },
      { name: "E", department: "luces" },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups.map((g) => g.department)).toEqual([
      "sound",
      "lights",
      "video",
      "production",
      "logistics",
    ]);
  });

  it("sorts unrecognized departments alphabetically after canonical ones", () => {
    const staff: Staff[] = [
      { name: "A", department: "catering" },
      { name: "B", department: "sonido" },
      { name: "C", department: "backline" },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups.map((g) => g.department)).toEqual(["sound", "backline", "catering"]);
  });

  it("collapses unknown/empty departments into a single group that always sorts last", () => {
    const staff: Staff[] = [
      { name: "A", department: "" },
      { name: "B", department: "sonido" },
      { name: "C" },
      { name: "D", department: "   " },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups[groups.length - 1].label).toBe("Sin departamento");
    expect(groups[groups.length - 1].members).toHaveLength(3);
    expect(groups[groups.length - 1].members.map((m) => m.index)).toEqual([0, 2, 3]);
  });

  it("is case- and accent-insensitive for unrecognized free text", () => {
    const staff: Staff[] = [
      { name: "A", department: "Backline" },
      { name: "B", department: "BACKLINE" },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Backline");
    expect(groups[0].members).toHaveLength(2);
  });

  it("resolves canonical keys from either language", () => {
    expect(canonicalStaffDepartment("Producción")).toBe("production");
    expect(canonicalStaffDepartment("logistics")).toBe("logistics");
    expect(canonicalStaffDepartment("catering")).toBeNull();
  });
});
