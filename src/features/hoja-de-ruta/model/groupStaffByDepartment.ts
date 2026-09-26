// Deterministic grouping of Hoja de Ruta staff rows by their persisted
// `department` field, for display purposes only (the array order/indices
// that drive onStaffChange/onRemoveStaff callbacks are untouched).
//
// Each staff member is placed in exactly one group: unknown/empty department
// values collapse into a single "Sin departamento" group that always sorts
// last. Recognized departments render first, in a fixed canonical order;
// anything else sorts alphabetically (locale "es") after them.
export type StaffGroupMember<T> = {
  staff: T;
  /** Original index in the source array, needed by index-based callbacks. */
  index: number;
};

export type StaffGroup<T> = {
  /** Normalized (lowercased, trimmed) department key; "" for the unknown bucket. */
  department: string;
  /** Human-facing label, using the original casing when recognized. */
  label: string;
  members: StaffGroupMember<T>[];
};

const CANONICAL_DEPARTMENTS = ["sonido", "luces", "video", "produccion", "logistica"] as const;

export const UNKNOWN_DEPARTMENT_LABEL = "Sin departamento";
const UNKNOWN_DEPARTMENT_KEY = "";

const normalizeDepartmentKey = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

export function groupStaffByDepartment<T extends { department?: string | null }>(
  staff: T[],
): StaffGroup<T>[] {
  const groups = new Map<string, StaffGroup<T>>();

  staff.forEach((member, index) => {
    const rawDepartment = member.department ?? "";
    const key = normalizeDepartmentKey(rawDepartment);
    const groupKey = key || UNKNOWN_DEPARTMENT_KEY;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        department: groupKey,
        label: key ? rawDepartment.trim() : UNKNOWN_DEPARTMENT_LABEL,
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
