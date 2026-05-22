import { describe, expect, it } from "vitest";

import {
  inferDepartmentFromFestivalAssignmentRole,
  resolveFestivalWhatsappStageTechnicianIds,
  type StageAssignmentRecipientRow,
  type StageProfileRecipientRow,
  type StageShiftRecipientRow,
} from "../recipientUtils.ts";

describe("festival WhatsApp stage recipient resolution", () => {
  it("infers departments from scheduling role codes", () => {
    expect(inferDepartmentFromFestivalAssignmentRole("SND-FOH-R")).toBe("sound");
    expect(inferDepartmentFromFestivalAssignmentRole("LGT-BRD-R")).toBe("lights");
    expect(inferDepartmentFromFestivalAssignmentRole("VID-SW-R")).toBe("video");
    expect(inferDepartmentFromFestivalAssignmentRole("FOH")).toBeNull();
  });

  it("uses scheduling shifts and assignments to resolve department recipients for a stage", () => {
    const shifts = new Map<string, StageShiftRecipientRow>([
      ["shift-sound", { id: "shift-sound", department: "sound" }],
      ["shift-open-role", { id: "shift-open-role", department: null }],
      ["shift-open-profile", { id: "shift-open-profile", department: null }],
      ["shift-video", { id: "shift-video", department: "video" }],
    ]);

    const profiles = new Map<string, StageProfileRecipientRow>([
      ["tech-1", { id: "tech-1", department: "sound" }],
      ["tech-2", { id: "tech-2", department: "video" }],
      ["tech-3", { id: "tech-3", department: "sound" }],
      ["tech-4", { id: "tech-4", department: "video" }],
    ]);

    const assignments: StageAssignmentRecipientRow[] = [
      { shift_id: "shift-sound", technician_id: "tech-1", role: "SND-FOH-R" },
      { shift_id: "shift-open-role", technician_id: "tech-3", role: "SND-MON-R" },
      { shift_id: "shift-open-profile", technician_id: "tech-1", role: "legacy-role" },
      { shift_id: "shift-open-role", technician_id: "tech-2", role: "VID-SW-R" },
      { shift_id: "shift-video", technician_id: "tech-4", role: "SND-FOH-R" },
    ];

    expect(
      resolveFestivalWhatsappStageTechnicianIds({
        assignments,
        department: "sound",
        profilesById: profiles,
        shiftsById: shifts,
      }),
    ).toEqual(["tech-1", "tech-3"]);
  });
});
