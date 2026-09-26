import { describe, expect, it } from "vitest";

import { groupStaffByDepartment } from "@/features/hoja-de-ruta/model/groupStaffByDepartment";

type Staff = { name: string; department?: string | null };

describe("groupStaffByDepartment", () => {
  it("places each member in exactly one group, preserving original index", () => {
    const staff: Staff[] = [
      { name: "Ana", department: "sonido" },
      { name: "Beto", department: "luces" },
      { name: "Carla", department: "sonido" },
    ];

    const groups = groupStaffByDepartment(staff);
    const totalMembers = groups.reduce((sum, group) => sum + group.members.length, 0);
    expect(totalMembers).toBe(staff.length);

    const sonidoGroup = groups.find((g) => g.department === "sonido");
    expect(sonidoGroup?.members.map((m) => m.index)).toEqual([0, 2]);
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
      "sonido",
      "luces",
      "video",
      "produccion",
      "logistica",
    ]);
  });

  it("sorts unrecognized departments alphabetically after canonical ones", () => {
    const staff: Staff[] = [
      { name: "A", department: "catering" },
      { name: "B", department: "sonido" },
      { name: "C", department: "backline" },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups.map((g) => g.department)).toEqual(["sonido", "backline", "catering"]);
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

  it("is case-insensitive when grouping but keeps the first-seen casing for the label", () => {
    const staff: Staff[] = [
      { name: "A", department: "Sonido" },
      { name: "B", department: "SONIDO" },
    ];

    const groups = groupStaffByDepartment(staff);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Sonido");
    expect(groups[0].members).toHaveLength(2);
  });
});
