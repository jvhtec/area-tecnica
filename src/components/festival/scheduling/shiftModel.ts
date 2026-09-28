import { z } from "zod";

import type { FestivalStageOption } from "@/features/festival-management/types";
import { roleOptionsForDiscipline } from "@/types/roles";

// Shared rules for the festival shift planner (create/edit dialogs, table and
// list views, crew picker). Kept free of React so it can be unit tested.

export const SHIFT_DEPARTMENT_OPTIONS = [
  { value: "sound", label: "Sonido" },
  { value: "lights", label: "Luces" },
  { value: "video", label: "Vídeo" },
  { value: "production", label: "Producción" },
  { value: "logistics", label: "Logística" },
] as const;

const PRODUCTION_ALIASES = new Set(["production", "produccion", "producción"]);

export const normalizeShiftDepartment = (department: string | null | undefined): string | null => {
  const value = department?.trim().toLowerCase();
  if (!value) return null;
  return PRODUCTION_ALIASES.has(value) ? "production" : value;
};

export const shiftDepartmentLabel = (department: string | null | undefined): string => {
  const normalized = normalizeShiftDepartment(department);
  if (!normalized) return "Sin departamento";
  return SHIFT_DEPARTMENT_OPTIONS.find((option) => option.value === normalized)?.label ?? department ?? "";
};

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/** A shift ends the next day when its end time is not after its start time. */
export const isOvernightShift = (startTime: string, endTime: string): boolean =>
  toMinutes(endTime) <= toMinutes(startTime);

export const shiftDurationMinutes = (startTime: string, endTime: string): number => {
  const diff = toMinutes(endTime) - toMinutes(startTime);
  return diff > 0 ? diff : diff + 24 * 60;
};

export const formatShiftDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  if (hours === 0) return `${rest} min`;
  return `${hours} h ${rest} min`;
};

export const formatShiftTime = (time: string): string => time.slice(0, 5);

/**
 * Where a shift falls relative to its festival date. The festival day runs from
 * `dayStartTime` (07:00 by default) to the same time next morning, so a 02:00
 * shift on the 10th happens in the early hours of the 11th.
 */
export const shiftNextDayNote = (startTime: string, endTime: string, dayStartTime = "07:00"): string | null => {
  const dayStart = TIME_PATTERN.test(dayStartTime) ? toMinutes(dayStartTime) : 7 * 60;
  if (toMinutes(startTime) < dayStart) return "Se hace en la madrugada del día siguiente";
  if (isOvernightShift(startTime, endTime)) return "Termina al día siguiente";
  return null;
};

export const shiftFormSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre del turno es obligatorio"),
    start_time: z.string().regex(TIME_PATTERN, "Introduce una hora válida (HH:MM)"),
    end_time: z.string().regex(TIME_PATTERN, "Introduce una hora válida (HH:MM)"),
    stage: z.string().optional(),
    department: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((values) => toMinutes(values.start_time) !== toMinutes(values.end_time), {
    message: "La hora de fin no puede ser igual a la de inicio",
    path: ["end_time"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

/** Select value for "no stage" / "no department" in the shift form. */
export const SHIFT_FORM_NONE = "none";

/** Converts the shift form's values into `festival_shifts` columns. */
export const shiftFormToRow = (values: ShiftFormValues) => ({
  name: values.name.trim(),
  start_time: values.start_time,
  end_time: values.end_time,
  stage: values.stage && values.stage !== SHIFT_FORM_NONE ? Number.parseInt(values.stage, 10) : null,
  department: values.department && values.department !== SHIFT_FORM_NONE ? values.department : null,
  notes: values.notes?.trim() ? values.notes.trim() : null,
});

/** Initial form values, optionally from an existing shift. */
export const shiftFormDefaults = (shift?: {
  name: string;
  start_time: string;
  end_time: string;
  stage?: number | null;
  department?: string | null;
  notes?: string | null;
}): ShiftFormValues => ({
  name: shift?.name ?? "",
  start_time: shift ? formatShiftTime(shift.start_time) : "09:00",
  end_time: shift ? formatShiftTime(shift.end_time) : "18:00",
  stage: shift?.stage ? String(shift.stage) : SHIFT_FORM_NONE,
  department: normalizeShiftDepartment(shift?.department) ?? SHIFT_FORM_NONE,
  notes: shift?.notes ?? "",
});

/**
 * Orders shifts along the festival day, which starts at `dayStartTime`
 * (07:00 by default) and runs past midnight: a 02:00 shift belongs after a
 * 20:00 one, not first.
 */
export const sortShiftsForFestivalDay = <T extends { start_time: string; end_time: string; name: string }>(
  shifts: readonly T[],
  dayStartTime = "07:00",
): T[] => {
  const dayStart = TIME_PATTERN.test(dayStartTime) ? toMinutes(dayStartTime) : 7 * 60;
  const position = (time: string) => (toMinutes(time) - dayStart + 24 * 60) % (24 * 60);
  return [...shifts].sort(
    (a, b) =>
      position(a.start_time) - position(b.start_time) ||
      shiftDurationMinutes(a.start_time, a.end_time) - shiftDurationMinutes(b.start_time, b.end_time) ||
      a.name.localeCompare(b.name, "es"),
  );
};

export const shiftStageLabel = (
  stage: number | null | undefined,
  stageOptions: readonly FestivalStageOption[],
): string => {
  if (!stage) return "Sin stage";
  return stageOptions.find((option) => option.number === stage)?.name ?? `Stage ${stage}`;
};

/** Stage choices for a shift: the festival's stages, keeping any number already stored. */
export const shiftStageChoices = (
  stageOptions: readonly FestivalStageOption[],
  currentStage?: number | null,
): FestivalStageOption[] => {
  const choices = [...stageOptions];
  if (currentStage && !choices.some((option) => option.number === currentStage)) {
    choices.push({ number: currentStage, name: `Stage ${currentStage}` });
  }
  return choices.sort((a, b) => a.number - b.number);
};

// ---------------------------------------------------------------------------
// Crew picker
// ---------------------------------------------------------------------------

export type JobCrewAssignment = {
  technician_id: string;
  status?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  production_role?: string | null;
};

export type CrewDirectoryEntry = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  department?: string | null;
  role?: string | null;
};

export type ShiftCrewCandidate = {
  id: string;
  name: string;
  isHouseTech: boolean;
  /** The person works this shift's department on this job. */
  inShiftDepartment: boolean;
  /** Their role code for the shift's department on this job, when they have one. */
  jobRole: string | null;
};

const ROLE_COLUMN_BY_DEPARTMENT: Record<string, keyof JobCrewAssignment> = {
  sound: "sound_role",
  lights: "lights_role",
  video: "video_role",
  production: "production_role",
};

export const crewDisplayName = (entry: CrewDirectoryEntry | null | undefined, fallback = "Sin nombre"): string => {
  if (!entry) return fallback;
  const fullName = [entry.first_name, entry.last_name].filter(Boolean).join(" ").trim();
  return fullName || entry.nickname || fallback;
};

const hasAnyJobRole = (assignment: JobCrewAssignment | undefined) =>
  Boolean(
    assignment &&
      (assignment.sound_role || assignment.lights_role || assignment.video_role || assignment.production_role),
  );

/**
 * Crew who can be put on a shift: everyone on the job (not declined) plus
 * people already on another shift of the job, minus those already on this
 * shift. Whether someone belongs to the shift's department comes from the
 * role they hold on the job, and only falls back to their profile department
 * when the assignment has no role at all.
 */
export const buildShiftCrewCandidates = ({
  jobAssignments,
  shiftCrewIds,
  directory,
  shiftDepartment,
  excludeIds,
}: {
  jobAssignments: readonly JobCrewAssignment[];
  shiftCrewIds: readonly string[];
  directory: readonly CrewDirectoryEntry[];
  shiftDepartment: string | null | undefined;
  excludeIds: readonly string[];
}): ShiftCrewCandidate[] => {
  const department = normalizeShiftDepartment(shiftDepartment);
  const roleColumn = department ? ROLE_COLUMN_BY_DEPARTMENT[department] : undefined;
  const directoryById = new Map(directory.map((entry) => [entry.id, entry]));
  const assignmentById = new Map(
    jobAssignments
      .filter((assignment) => assignment.status !== "declined")
      .map((assignment) => [assignment.technician_id, assignment]),
  );
  const excluded = new Set(excludeIds);
  const ids = new Set([...assignmentById.keys(), ...shiftCrewIds]);

  const candidates: ShiftCrewCandidate[] = [];
  for (const id of ids) {
    if (excluded.has(id)) continue;
    const profile = directoryById.get(id);
    const assignment = assignmentById.get(id);
    const jobRoleValue = roleColumn && assignment ? (assignment[roleColumn] as string | null | undefined) : null;
    const inShiftDepartment = !department
      ? true
      : Boolean(jobRoleValue) ||
        (!hasAnyJobRole(assignment) && normalizeShiftDepartment(profile?.department) === department);

    candidates.push({
      id,
      name: crewDisplayName(profile),
      isHouseTech: profile?.role === "house_tech",
      inShiftDepartment,
      jobRole: jobRoleValue || null,
    });
  }

  return candidates.sort(
    (a, b) =>
      Number(b.inShiftDepartment) - Number(a.inShiftDepartment) ||
      Number(b.isHouseTech) - Number(a.isHouseTech) ||
      a.name.localeCompare(b.name, "es"),
  );
};

/** Role options for a shift's department; empty means the role is typed freely. */
export const shiftRoleOptions = (shiftDepartment: string | null | undefined) =>
  roleOptionsForDiscipline(normalizeShiftDepartment(shiftDepartment));

/** The role to preselect for a candidate: their job role when it is a known option. */
export const defaultShiftRole = (
  candidate: ShiftCrewCandidate | undefined,
  shiftDepartment: string | null | undefined,
  currentRole: string,
): string => {
  const options = shiftRoleOptions(shiftDepartment);
  if (candidate?.jobRole && options.some((option) => option.code === candidate.jobRole)) {
    return candidate.jobRole;
  }
  if (currentRole) return currentRole;
  return options[0]?.code ?? "";
};
