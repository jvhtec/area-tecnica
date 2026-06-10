import type { Accommodation, EventData, RoomAssignment } from "@/types/hoja-de-ruta";

export type HojaStaffEntry = NonNullable<EventData["staff"]>[number];

const norm = (value?: string) => (value || "").trim().toLowerCase();
const nameKey = (entry: HojaStaffEntry) => `${norm(entry?.name)}|${norm(entry?.surname1)}`;

const mergeTwo = (assigned: HojaStaffEntry, saved: HojaStaffEntry): HojaStaffEntry => ({
  ...assigned,
  ...saved,
  // Prefer saved DNI/position if present; otherwise take the assignment-derived values
  dni: saved.dni || assigned.dni || "",
  position: saved.position || assigned.position || "",
  technician_id: saved.technician_id || assigned.technician_id,
  phone: saved.phone || assigned.phone || "",
  role: saved.role || assigned.role,
});

export type MergedStaffResult = {
  staff: HojaStaffEntry[];
  /**
   * Maps each index of the saved staff array to its index in the merged
   * array, or -1 when the entry was pruned (its assignment was removed).
   */
  savedIndexMap: number[];
};

/**
 * Merges the staff list saved with the hoja de ruta with the job's current
 * assignments:
 * - saved entries that reference a technician no longer assigned are pruned,
 *   so removing an assignment removes the person from the hoja (the bug this
 *   fixes); manual entries without technician_id are always preserved
 * - matched entries keep saved DNI/position edits
 * - newly assigned technicians are appended
 */
export const mergeStaffWithAssignments = (
  saved: HojaStaffEntry[] = [],
  assigned: HojaStaffEntry[] = [],
): MergedStaffResult => {
  const assignedTechIds = new Set(
    assigned.map((entry) => entry?.technician_id).filter(Boolean) as string[],
  );

  // Prune saved entries whose source assignment disappeared.
  const savedIndexMap: number[] = new Array(saved.length).fill(-1);
  const result: HojaStaffEntry[] = [];
  saved.forEach((entry, savedIndex) => {
    if (entry?.technician_id && !assignedTechIds.has(entry.technician_id)) return;
    savedIndexMap[savedIndex] = result.length;
    result.push({ ...entry });
  });

  const usedAssigned = new Set<number>();

  // PASS 1: match by technician_id (reliable)
  const keptIndexByTechId = new Map<string, number>();
  result.forEach((entry, index) => {
    if (entry?.technician_id) keptIndexByTechId.set(entry.technician_id, index);
  });

  assigned.forEach((entry, assignedIndex) => {
    const technicianId = entry?.technician_id;
    if (!technicianId) return;
    const keptIndex = keptIndexByTechId.get(technicianId);
    if (keptIndex == null) return;
    result[keptIndex] = mergeTwo(entry, result[keptIndex]);
    usedAssigned.add(assignedIndex);
  });

  // PASS 2: match remaining legacy saved entries (no technician_id) by name|surname1
  const legacySavedByName = new Map<string, number[]>();
  result.forEach((entry, index) => {
    if (entry?.technician_id) return;
    const key = nameKey(entry);
    if (!key || key === "|") return;
    const indexes = legacySavedByName.get(key) || [];
    indexes.push(index);
    legacySavedByName.set(key, indexes);
  });

  assigned.forEach((entry, assignedIndex) => {
    if (usedAssigned.has(assignedIndex)) return;
    const key = nameKey(entry);
    const indexes = legacySavedByName.get(key);
    if (!indexes || indexes.length === 0) return;
    const keptIndex = indexes.shift()!;
    result[keptIndex] = mergeTwo(entry, result[keptIndex]);
    usedAssigned.add(assignedIndex);
    if (indexes.length === 0) legacySavedByName.delete(key);
  });

  // Append any remaining assigned staff not present in saved data.
  assigned.forEach((entry, assignedIndex) => {
    if (usedAssigned.has(assignedIndex)) return;
    result.push({ ...entry });
  });

  return { staff: result, savedIndexMap };
};

/**
 * Stable select value for a staff member in room assignments: technician_id
 * when the entry comes from job staffing, the array index otherwise. The PDF
 * generator resolves both forms.
 */
export const staffOptionValue = (entry: HojaStaffEntry, index: number) =>
  entry?.technician_id || index.toString();

const isIndexReference = (value: string) => /^\d+$/.test(value);

const remapRoomReference = (
  value: string | undefined,
  savedStaff: HojaStaffEntry[],
  savedIndexMap: number[],
  mergedStaff: HojaStaffEntry[],
): string => {
  if (!value) return "";

  if (isIndexReference(value)) {
    const savedIndex = Number(value);
    if (savedIndex < 0 || savedIndex >= savedStaff.length) return "";
    const mergedIndex = savedIndexMap[savedIndex];
    if (mergedIndex == null || mergedIndex < 0) return "";
    return staffOptionValue(mergedStaff[mergedIndex], mergedIndex);
  }

  // technician_id reference: clear it when that technician was pruned
  const stillPresent = mergedStaff.some((entry) => entry?.technician_id === value);
  return stillPresent ? value : "";
};

/**
 * Room assignments historically stored the staff array index, which breaks as
 * soon as the staff list shrinks or reorders. This remaps every reference
 * against the saved staff order, migrating index references to the stable
 * technician_id where available and clearing references to pruned staff.
 */
export const remapAccommodationStaffReferences = (
  accommodations: Accommodation[],
  savedStaff: HojaStaffEntry[],
  savedIndexMap: number[],
  mergedStaff: HojaStaffEntry[],
): Accommodation[] =>
  accommodations.map((accommodation) => ({
    ...accommodation,
    rooms: (accommodation.rooms || []).map((room: RoomAssignment) => ({
      ...room,
      staff_member1_id: remapRoomReference(
        room.staff_member1_id,
        savedStaff,
        savedIndexMap,
        mergedStaff,
      ),
      staff_member2_id: remapRoomReference(
        room.staff_member2_id,
        savedStaff,
        savedIndexMap,
        mergedStaff,
      ),
    })),
  }));

const adjustReferenceForRemoval = (
  value: string | undefined,
  removedIndex: number,
  removedEntry?: HojaStaffEntry,
): string => {
  if (!value) return "";
  if (isIndexReference(value)) {
    const index = Number(value);
    if (index === removedIndex) return "";
    return index > removedIndex ? String(index - 1) : value;
  }
  if (removedEntry?.technician_id && value === removedEntry.technician_id) return "";
  return value;
};

/**
 * Keeps room assignments consistent when a staff member is removed from the
 * hoja: references to the removed person are cleared and index-based
 * references after them shift down by one.
 */
export const adjustAccommodationsForStaffRemoval = (
  accommodations: Accommodation[],
  removedIndex: number,
  removedEntry?: HojaStaffEntry,
): Accommodation[] =>
  accommodations.map((accommodation) => ({
    ...accommodation,
    rooms: (accommodation.rooms || []).map((room: RoomAssignment) => ({
      ...room,
      staff_member1_id: adjustReferenceForRemoval(
        room.staff_member1_id,
        removedIndex,
        removedEntry,
      ),
      staff_member2_id: adjustReferenceForRemoval(
        room.staff_member2_id,
        removedIndex,
        removedEntry,
      ),
    })),
  }));

/**
 * Synchronizes hoja transports with a fresh snapshot of the job's logistics
 * events: transports imported from logistics that no longer exist (or are no
 * longer hoja-relevant) are pruned, matched ones keep manual edits, and new
 * events are appended. Manually created transports are untouched.
 */
export const syncTransportsWithLogistics = <
  T extends {
    source_logistics_event_id?: string;
    date_time?: string;
    [key: string]: unknown;
  },
>(
  current: T[],
  incoming: T[],
): T[] => {
  const incomingSourceIds = new Set(
    incoming
      .map((transport) => transport.source_logistics_event_id)
      .filter(Boolean) as string[],
  );

  // Drop sourced transports whose logistics event disappeared from the snapshot
  const next = current.filter(
    (transport) =>
      !transport.source_logistics_event_id ||
      incomingSourceIds.has(transport.source_logistics_event_id),
  );

  incoming.forEach((incomingTransport) => {
    const sourceId = incomingTransport.source_logistics_event_id || null;
    if (sourceId) {
      const existingIndex = next.findIndex(
        (transport) => transport.source_logistics_event_id === sourceId,
      );
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        const shouldSyncDateTime =
          !existing.date_time || !String(existing.date_time).trim();
        next[existingIndex] = {
          ...existing,
          transport_type: incomingTransport.transport_type,
          license_plate: incomingTransport.license_plate,
          company: incomingTransport.company,
          // Preserve any manually-edited Hoja de Ruta datetime; only sync if empty.
          date_time: shouldSyncDateTime ? incomingTransport.date_time : existing.date_time,
          source_logistics_event_id: sourceId,
          is_hoja_relevant: incomingTransport.is_hoja_relevant ?? true,
          logistics_categories: incomingTransport.logistics_categories || [],
          driver_name: incomingTransport.driver_name ?? existing.driver_name,
          driver_phone: incomingTransport.driver_phone ?? existing.driver_phone,
          has_return: incomingTransport.has_return ?? existing.has_return,
        } as T;
        return;
      }
    }
    next.push(incomingTransport);
  });

  return next;
};
