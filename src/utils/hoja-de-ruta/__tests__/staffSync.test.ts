import { describe, expect, it } from "vitest";
import {
  adjustAccommodationsForStaffRemoval,
  mergeStaffWithAssignments,
  remapAccommodationStaffReferences,
  staffOptionValue,
  syncTransportsWithLogistics,
} from "@/utils/hoja-de-ruta/staffSync";

const assigned = (technicianId: string, name: string, position = "Técnico") => ({
  technician_id: technicianId,
  name,
  surname1: `${name}-S`,
  surname2: "",
  position,
  dni: "",
  phone: "",
  role: "house_tech",
});

describe("mergeStaffWithAssignments", () => {
  it("prunes saved entries whose assignment was removed", () => {
    const saved = [
      { technician_id: "t1", name: "Ana", surname1: "A", dni: "111A" },
      { technician_id: "t2", name: "Bea", surname1: "B", dni: "222B" },
    ];
    const { staff, savedIndexMap } = mergeStaffWithAssignments(saved, [
      assigned("t2", "Bea"),
    ]);

    expect(staff).toHaveLength(1);
    expect(staff[0].technician_id).toBe("t2");
    // saved DNI is preserved on the surviving entry
    expect(staff[0].dni).toBe("222B");
    expect(savedIndexMap).toEqual([-1, 0]);
  });

  it("keeps manual entries (no technician_id) and appends new assignments", () => {
    const saved = [
      { name: "Manual", surname1: "Guy", position: "Runner", dni: "" },
      { technician_id: "t1", name: "Ana", surname1: "A", dni: "111A" },
    ];
    const { staff, savedIndexMap } = mergeStaffWithAssignments(saved, [
      assigned("t1", "Ana"),
      assigned("t3", "Carlos"),
    ]);

    expect(staff.map((s) => s.name)).toEqual(["Manual", "Ana", "Carlos"]);
    expect(savedIndexMap).toEqual([0, 1]);
  });

  it("matches legacy saved entries by name and enriches them with technician_id", () => {
    const saved = [{ name: "Ana", surname1: "Ana-S", position: "FoH", dni: "111A" }];
    const { staff } = mergeStaffWithAssignments(saved, [assigned("t1", "Ana", "Mon")]);

    expect(staff).toHaveLength(1);
    expect(staff[0].technician_id).toBe("t1");
    // saved position and DNI win over assignment-derived values
    expect(staff[0].position).toBe("FoH");
    expect(staff[0].dni).toBe("111A");
  });
});

describe("remapAccommodationStaffReferences", () => {
  const savedStaff = [
    { technician_id: "t1", name: "Ana", surname1: "A" },
    { name: "Manual", surname1: "Guy" },
    { technician_id: "t2", name: "Bea", surname1: "B" },
  ];

  it("migrates index references to technician_id and shifts manual indexes", () => {
    // t1 was unassigned → pruned; Manual moves to index 0, t2 to index 1
    const { staff: merged, savedIndexMap } = mergeStaffWithAssignments(savedStaff, [
      assigned("t2", "Bea"),
    ]);
    const accommodations = [
      {
        hotel_name: "Hotel",
        rooms: [
          { room_type: "double" as const, staff_member1_id: "0", staff_member2_id: "1" },
          { room_type: "single" as const, staff_member1_id: "2", staff_member2_id: "" },
        ],
      },
    ];

    const remapped = remapAccommodationStaffReferences(
      accommodations,
      savedStaff,
      savedIndexMap,
      merged,
    );

    // index 0 referenced t1 (pruned) → cleared
    expect(remapped[0].rooms[0].staff_member1_id).toBe("");
    // index 1 was the manual entry → its new index
    expect(remapped[0].rooms[0].staff_member2_id).toBe("0");
    // index 2 referenced t2 → migrated to stable technician_id
    expect(remapped[0].rooms[1].staff_member1_id).toBe("t2");
  });

  it("clears technician_id references to pruned staff and keeps valid ones", () => {
    const { staff: merged, savedIndexMap } = mergeStaffWithAssignments(savedStaff, [
      assigned("t2", "Bea"),
    ]);
    const accommodations = [
      {
        rooms: [
          { room_type: "double" as const, staff_member1_id: "t1", staff_member2_id: "t2" },
        ],
      },
    ];

    const remapped = remapAccommodationStaffReferences(
      accommodations,
      savedStaff,
      savedIndexMap,
      merged,
    );

    expect(remapped[0].rooms[0].staff_member1_id).toBe("");
    expect(remapped[0].rooms[0].staff_member2_id).toBe("t2");
  });
});

describe("adjustAccommodationsForStaffRemoval", () => {
  it("clears references to the removed member and shifts higher indexes", () => {
    const accommodations = [
      {
        rooms: [
          { room_type: "double" as const, staff_member1_id: "1", staff_member2_id: "2" },
          { room_type: "single" as const, staff_member1_id: "0", staff_member2_id: "" },
          { room_type: "single" as const, staff_member1_id: "t9", staff_member2_id: "" },
        ],
      },
    ];

    const adjusted = adjustAccommodationsForStaffRemoval(accommodations, 1, {
      technician_id: "t9",
      name: "Bea",
    });

    expect(adjusted[0].rooms[0].staff_member1_id).toBe("");
    expect(adjusted[0].rooms[0].staff_member2_id).toBe("1");
    expect(adjusted[0].rooms[1].staff_member1_id).toBe("0");
    // technician_id reference to the removed member is cleared too
    expect(adjusted[0].rooms[2].staff_member1_id).toBe("");
  });
});

describe("staffOptionValue", () => {
  it("uses technician_id when present, the index otherwise", () => {
    expect(staffOptionValue({ technician_id: "t1", name: "Ana" }, 3)).toBe("t1");
    expect(staffOptionValue({ name: "Manual" }, 3)).toBe("3");
  });
});

describe("syncTransportsWithLogistics", () => {
  const sourced = (sourceId: string, extra: Record<string, unknown> = {}) => ({
    id: `local-${sourceId}`,
    transport_type: "trailer",
    source_logistics_event_id: sourceId,
    date_time: "",
    ...extra,
  });

  it("prunes transports whose logistics event disappeared and keeps manual rows", () => {
    const current = [
      sourced("ev1"),
      sourced("ev2"),
      { id: "manual-1", transport_type: "furgoneta", date_time: "2026-06-10T08:00" },
    ];

    const next = syncTransportsWithLogistics(current, [sourced("ev2")]);

    expect(next.map((t) => t.id)).toEqual(["local-ev2", "manual-1"]);
  });

  it("clears all sourced transports when the snapshot is empty", () => {
    const current = [sourced("ev1"), { id: "manual-1", transport_type: "4m" }];
    const next = syncTransportsWithLogistics(current, []);
    expect(next.map((t) => t.id)).toEqual(["manual-1"]);
  });

  it("preserves manually edited datetime on matched transports and appends new events", () => {
    const current = [sourced("ev1", { date_time: "2026-06-10T07:30" })];
    const incoming = [
      sourced("ev1", { date_time: "2026-06-10T09:00", license_plate: "1234-ABC" }),
      sourced("ev3", { date_time: "2026-06-11T10:00" }),
    ];

    const next = syncTransportsWithLogistics(current, incoming);

    expect(next).toHaveLength(2);
    expect(next[0].date_time).toBe("2026-06-10T07:30");
    expect(next[0].license_plate).toBe("1234-ABC");
    expect(next[1].source_logistics_event_id).toBe("ev3");
  });
});
