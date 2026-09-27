// Deterministic grouping of Hoja de Ruta staff rows by their persisted
// `department` field, for display purposes only (the array order/indices
// that drive onStaffChange/onRemoveStaff callbacks are untouched).
//
// Each staff member is placed in exactly one group. Stored values come from
// `profiles.department` (English enum keys such as "sound") or from manual
// entries in Spanish ("Sonido", "luces"), so both are normalized onto the
// canonical department key and labelled in Spanish. Unknown/empty values
// collapse into a single "Sin departamento" group that always sorts last.
// Recognized departments render first, in a fixed canonical order; anything
// else sorts alphabetically (locale "es") after them.
import { DEPARTMENT_LABELS, type ActiveDepartment } from "@/types/department";

export type StaffGroupMember<T> = {
  staff: T;
  /** Original index in the source array, needed by index-based callbacks. */
  index: number;
};

export type StaffGroup<T> = {
  /** Canonical department key, normalized free text for others, "" for unknown. */
  department: string;
  /** Human-facing Spanish label. */
  label: string;
  members: StaffGroupMember<T>[];
};

const CANONICAL_DEPARTMENTS: readonly ActiveDepartment[] = [
  "sound",
  "lights",
  "video",
  "production",
  "logistics",
  "administrative",
];

const DEPARTMENT_ALIASES: Record<string, ActiveDepartment> = {
  sound: "sound",
  sonido: "sound",
  lights: "lights",
  luces: "lights",
  iluminacion: "lights",
  video: "video",
  production: "production",
  produccion: "production",
  logistics: "logistics",
  logistica: "logistics",
  administrative: "administrative",
  administracion: "administrative",
};

export const UNKNOWN_DEPARTMENT_LABEL = "Sin departamento";
const UNKNOWN_DEPARTMENT_KEY = "";

const normalizeDepartmentKey = (value: string | null | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const canonicalStaffDepartment = (
  value: string | null | undefined,
): ActiveDepartment | null => DEPARTMENT_ALIASES[normalizeDepartmentKey(value)] ?? null;

/** Spanish label for a stored department value; free text is shown as typed. */
export const staffDepartmentLabel = (value: string | null | undefined): string => {
  const canonical = canonicalStaffDepartment(value);
  return canonical ? DEPARTMENT_LABELS[canonical] : (value ?? "").trim();
};

export function groupStaffByDepartment<T extends { department?: string | null }>(
  staff: T[],
): StaffGroup<T>[] {
  const groups = new Map<string, StaffGroup<T>>();

  staff.forEach((member, index) => {
    const rawDepartment = member.department ?? "";
    const canonical = canonicalStaffDepartment(rawDepartment);
    const groupKey = canonical ?? normalizeDepartmentKey(rawDepartment);

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        department: groupKey,
        label: canonical
          ? DEPARTMENT_LABELS[canonical]
          : groupKey
            ? rawDepartment.trim()
            : UNKNOWN_DEPARTMENT_LABEL,
        members: [],
      };
      groups.set(groupKey, group);
    }
    group.members.push({ staff: member, index });
  });

  const canonicalOrder = new Map<string, number>(
    CANONICAL_DEPARTMENTS.map((department, order) => [department, order]),
  );

  return Array.from(groups.values()).sort((a, b) => {
    if (a.department === UNKNOWN_DEPARTMENT_KEY) return 1;
    if (b.department === UNKNOWN_DEPARTMENT_KEY) return -1;

    const aOrder = canonicalOrder.get(a.department) ?? CANONICAL_DEPARTMENTS.length;
    const bOrder = canonicalOrder.get(b.department) ?? CANONICAL_DEPARTMENTS.length;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return a.label.localeCompare(b.label, "es");
  });
}
