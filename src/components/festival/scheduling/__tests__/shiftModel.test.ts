import { describe, expect, it } from "vitest";

import {
  buildShiftCrewCandidates,
  defaultShiftRole,
  festivalAssignmentErrorMessage,
  formatShiftDuration,
  isOvernightShift,
  normalizeShiftDepartment,
  shiftDepartmentLabel,
  shiftDurationMinutes,
  shiftFormSchema,
  shiftNextDayNote,
  shiftStageChoices,
  shiftStageLabel,
  sortShiftsForFestivalDay,
} from "../shiftModel";

const shift = (name: string, start_time: string, end_time: string) => ({ name, start_time, end_time });

describe("shift times", () => {
  it("treats an end time at or before the start as the next day", () => {
    expect(isOvernightShift("22:00", "06:00")).toBe(true);
    expect(isOvernightShift("09:00", "18:00")).toBe(false);
    expect(shiftDurationMinutes("22:00", "06:00")).toBe(8 * 60);
    expect(shiftDurationMinutes("09:00:00", "17:30:00")).toBe(8 * 60 + 30);
  });

  it("formats durations in Spanish", () => {
    expect(formatShiftDuration(480)).toBe("8 h");
    expect(formatShiftDuration(510)).toBe("8 h 30 min");
    expect(formatShiftDuration(45)).toBe("45 min");
  });

  it("rejects a shift that starts and ends at the same time", () => {
    const result = shiftFormSchema.safeParse({ name: "Noche", start_time: "22:00", end_time: "22:00" });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0].message).toBe(
      "La hora de fin no puede ser igual a la de inicio",
    );
    expect(shiftFormSchema.safeParse({ name: "Noche", start_time: "22:00", end_time: "06:00" }).success).toBe(true);
  });

  it("orders shifts along the festival day, overnight ones last", () => {
    const sorted = sortShiftsForFestivalDay(
      [shift("Madrugada", "02:00", "07:00"), shift("Noche", "20:00", "04:00"), shift("Mañana", "09:00", "15:00")],
      "07:00",
    );
    expect(sorted.map((item) => item.name)).toEqual(["Mañana", "Noche", "Madrugada"]);
  });

  it("marks shifts that happen on the next calendar day", () => {
    expect(shiftNextDayNote("22:00", "06:00")).toBe("Termina al día siguiente");
    expect(shiftNextDayNote("02:00", "07:30")).toBe("Se hace en la madrugada del día siguiente");
    expect(shiftNextDayNote("09:00", "15:00")).toBeNull();
    expect(shiftNextDayNote("06:00", "12:00", "05:00")).toBeNull();
  });

  it("uses the configured festival day start", () => {
    const sorted = sortShiftsForFestivalDay([shift("A", "08:00", "10:00"), shift("B", "10:00", "12:00")], "09:00");
    expect(sorted.map((item) => item.name)).toEqual(["B", "A"]);
  });
});

describe("stages and departments", () => {
  const stageOptions = [
    { number: 1, name: "Principal" },
    { number: 2, name: "Carpa" },
  ];

  it("labels stages by name and keeps unknown stored numbers selectable", () => {
    expect(shiftStageLabel(2, stageOptions)).toBe("Carpa");
    expect(shiftStageLabel(null, stageOptions)).toBe("Sin stage");
    expect(shiftStageLabel(4, stageOptions)).toBe("Stage 4");
    expect(shiftStageChoices(stageOptions, 4).map((option) => option.number)).toEqual([1, 2, 4]);
  });

  it("labels departments in Spanish and folds production spellings", () => {
    expect(shiftDepartmentLabel("sound")).toBe("Sonido");
    expect(shiftDepartmentLabel("Producción")).toBe("Producción");
    expect(normalizeShiftDepartment("produccion")).toBe("production");
    expect(shiftDepartmentLabel(null)).toBe("Sin departamento");
  });
});

describe("crew candidates", () => {
  const directory = [
    { id: "sound-profile-lights-role", first_name: "Cruz", last_name: "Cruzado", department: "sound", role: "technician" },
    { id: "sound-tech", first_name: "Sonia", last_name: "Sonido", department: "sound", role: "technician" },
    { id: "house", first_name: "Hugo", last_name: "Casa", department: "sound", role: "house_tech" },
    { id: "no-role", first_name: "Rita", last_name: "Rol", department: "lights", role: "technician" },
    { id: "shift-only", first_name: "Tomás", last_name: "Turno", department: "sound", role: "technician" },
    { id: "declined", first_name: "Diego", last_name: "Declina", department: "lights", role: "technician" },
    { id: "already-on-shift", first_name: "Ana", last_name: "Ya", department: "lights", role: "technician" },
  ];
  const jobAssignments = [
    { technician_id: "sound-profile-lights-role", status: "confirmed", lights_role: "LGT-BRD-E" },
    { technician_id: "sound-tech", status: "confirmed", sound_role: "SND-FOH-R" },
    { technician_id: "house", status: "confirmed", sound_role: "SND-MON-E" },
    { technician_id: "no-role", status: "invited" },
    { technician_id: "declined", status: "declined", lights_role: "LGT-SYS-E" },
    { technician_id: "already-on-shift", status: "confirmed", lights_role: "LGT-SYS-E" },
  ];

  const candidates = buildShiftCrewCandidates({
    jobAssignments,
    directory,
    shiftDepartment: "lights",
    excludeIds: ["already-on-shift"],
  });

  it("puts people working the shift's department on this job first", () => {
    const inDepartment = candidates.filter((candidate) => candidate.inShiftDepartment).map((candidate) => candidate.id);
    expect(inDepartment).toEqual(["sound-profile-lights-role", "declined", "no-role"]);
  });

  it("keeps every job member available regardless of status and drops non-members and existing crew", () => {
    const ids = candidates.map((candidate) => candidate.id);
    expect(ids).toContain("sound-tech");
    expect(ids).toContain("declined");
    expect(ids).not.toContain("shift-only");
    expect(ids).not.toContain("already-on-shift");
    expect(candidates.find((candidate) => candidate.id === "house")?.isHouseTech).toBe(true);
  });

  it("translates assignment integrity failures", () => {
    expect(festivalAssignmentErrorMessage({ code: "23505", message: "duplicate" })).toBe(
      "Este técnico ya está asignado al turno.",
    );
    expect(
      festivalAssignmentErrorMessage({
        code: "23514",
        message: "festival_shift_technician_not_on_job",
      }),
    ).toBe("Este técnico no pertenece al trabajo.");
  });

  it("preselects the person's job role and otherwise keeps the current role", () => {
    const withRole = candidates.find((candidate) => candidate.id === "sound-profile-lights-role");
    const withoutRole = candidates.find((candidate) => candidate.id === "no-role");
    expect(defaultShiftRole(withRole, "lights", "LGT-PA-T")).toBe("LGT-BRD-E");
    expect(defaultShiftRole(withoutRole, "lights", "LGT-PA-T")).toBe("LGT-PA-T");
    expect(defaultShiftRole(withoutRole, "lights", "")).toBe("LGT-BRD-R");
    expect(defaultShiftRole(undefined, "logistics", "")).toBe("");
  });
});
