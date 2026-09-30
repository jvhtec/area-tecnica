import { z } from "zod";

import {
  DEFAULT_FESTIVAL_DAY_START_TIME,
  getFestivalDayOffset,
  getFestivalDayStartMinutes,
} from "@/features/festival-management/dayStart";
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
 * the configured `dayStartTime` to the same time next morning, so an early
 * shift on the 10th happens in the early hours of the 11th.
 */
export const shiftNextDayNote = (
  startTime: string,
  endTime: string,
  dayStartTime = DEFAULT_FESTIVAL_DAY_START_TIME,
): string | null => {
  const dayStart = getFestivalDayStartMinutes(dayStartTime);
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
 * and runs past midnight: an early-morning shift belongs after an evening
 * 20:00 one, not first.
 */
export const sortShiftsForFestivalDay = <T extends { start_time: string; end_time: string; name: string }>(
  shifts: readonly T[],
  dayStartTime = DEFAULT_FESTIVAL_DAY_START_TIME,
): T[] => {
  const position = (time: string) => getFestivalDayOffset(time, dayStartTime) ?? Number.MAX_SAFE_INTEGER;
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

/** The first role a person holds on the job, in any department (sound, lights, video, production). */
const firstJobRole = (assignment: JobCrewAssignment): string | null =>
  assignment.sound_role || assignment.lights_role || assignment.video_role || assignment.production_role || null;

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
 * Crew who can be put on a shift: everyone with an assignment to the job,
 * regardless of status or assignment source, minus those already on this shift. Whether someone belongs to
 * the shift's department comes from the role they hold on the job, and only
 * falls back to their profile department when the assignment has no role at
 * all.
 */
export const buildShiftCrewCandidates = ({
  jobAssignments,
  directory,
  shiftDepartment,
  excludeIds,
}: {
  jobAssignments: readonly JobCrewAssignment[];
  directory: readonly CrewDirectoryEntry[];
  shiftDepartment: string | null | undefined;
  excludeIds: readonly string[];
}): ShiftCrewCandidate[] => {
  const department = normalizeShiftDepartment(shiftDepartment);
  const roleColumn = department ? ROLE_COLUMN_BY_DEPARTMENT[department] : undefined;
  const directoryById = new Map(directory.map((entry) => [entry.id, entry]));
  const assignmentById = new Map(
    jobAssignments.map((assignment) => [assignment.technician_id, assignment]),
  );
  const excluded = new Set(excludeIds);
  const ids = new Set(assignmentById.keys());

  const candidates: ShiftCrewCandidate[] = [];
  for (const id of ids) {
    if (excluded.has(id)) continue;
    const profile = directoryById.get(id);
    const assignment = assignmentById.get(id);
    // Without a department on the shift, the role they hold on the job (in whichever department) is the default.
    const jobRoleValue = !assignment
      ? null
      : roleColumn
        ? (assignment[roleColumn] as string | null | undefined)
        : department
          ? null
          : firstJobRole(assignment);
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

/** User-facing copy for database invariants enforced on shift assignments. */
export const festivalAssignmentErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "No se pudo asignar el técnico";

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  if (code === "23505") return "Este técnico ya está asignado al turno.";
  if (code === "23514" && message.includes("festival_shift_technician_not_on_job")) {
    return "Este técnico no pertenece al trabajo.";
  }

  return "No se pudo asignar el técnico";
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
  if (candidate?.jobRole) {
    // A shift without a department accepts whatever role the person holds; one with a department
    // only the roles that department offers.
    if (!normalizeShiftDepartment(shiftDepartment) || options.some((option) => option.code === candidate.jobRole)) {
      return candidate.jobRole;
    }
  }
  if (currentRole) return currentRole;
  return options[0]?.code ?? "";
};

// ---------------------------------------------------------------------------
// Crew picker of the shift sheet
// ---------------------------------------------------------------------------

/** Lower-case, accent-free text for searching names ("Sánchez" matches "sanchez"). */
export const normalizeSearchText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const filterByName = <T extends { name: string }>(items: readonly T[], query: string): T[] => {
  const needle = normalizeSearchText(query);
  if (!needle) return [...items];
  return items.filter((item) => normalizeSearchText(item.name).includes(needle));
};

export type CrewPickerGroup = { key: "department" | "rest"; label: string; candidates: ShiftCrewCandidate[] };

/**
 * The picker's sections: the people who work the shift's department on this job, then the rest of
 * the team. Without a department everyone is one section. Empty sections are left out.
 */
export const groupCrewCandidates = (
  candidates: readonly ShiftCrewCandidate[],
  shiftDepartment: string | null | undefined,
): CrewPickerGroup[] => {
  const department = normalizeShiftDepartment(shiftDepartment);
  if (!department) {
    return candidates.length ? [{ key: "rest", label: "Equipo del trabajo", candidates: [...candidates] }] : [];
  }
  const inDepartment = candidates.filter((candidate) => candidate.inShiftDepartment);
  const rest = candidates.filter((candidate) => !candidate.inShiftDepartment);
  const groups: CrewPickerGroup[] = [];
  if (inDepartment.length) {
    groups.push({ key: "department", label: `${shiftDepartmentLabel(department)} en este trabajo`, candidates: inDepartment });
  }
  if (rest.length) groups.push({ key: "rest", label: "Resto del equipo", candidates: rest });
  return groups;
};

/** External names used on this festival that are not already on the shift, matching what is typed. */
export const suggestExternalNames = (
  externalNames: readonly string[],
  onShift: readonly string[],
  query: string,
): string[] => {
  const taken = new Set(onShift.map(normalizeSearchText));
  return filterByName(
    externalNames.filter((name) => !taken.has(normalizeSearchText(name))).map((name) => ({ name })),
    query,
  ).map((item) => item.name);
};

export type NewShiftAssignment = {
  shift_id: string;
  role: string;
  technician_id?: string;
  external_technician_name?: string;
};

/**
 * The rows to insert for the people chosen in the picker. Each person keeps the role they hold on
 * the job when it is one the shift's department offers; everyone else gets `fallbackRole`.
 */
export const buildNewAssignments = ({
  shiftId,
  shiftDepartment,
  technicianIds,
  externalNames,
  candidates,
  fallbackRole,
}: {
  shiftId: string;
  shiftDepartment: string | null | undefined;
  technicianIds: readonly string[];
  externalNames: readonly string[];
  candidates: readonly ShiftCrewCandidate[];
  fallbackRole: string;
}): NewShiftAssignment[] => {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const rows: NewShiftAssignment[] = [];
  for (const id of technicianIds) {
    rows.push({
      shift_id: shiftId,
      technician_id: id,
      role: defaultShiftRole(byId.get(id), shiftDepartment, fallbackRole),
    });
  }
  const seen = new Set<string>();
  for (const raw of externalNames) {
    const name = raw.trim();
    const key = normalizeSearchText(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    rows.push({ shift_id: shiftId, external_technician_name: name, role: fallbackRole });
  }
  return rows.filter((row) => row.role.trim() !== "");
};
