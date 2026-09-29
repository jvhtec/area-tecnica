import type { GearSetupFormData } from "@/types/festival-gear";
import type { EquipmentCategory } from "@/types/equipment";
import { normalizePresetSubsystem, resolveSubsystemForEquipment } from "@/types/equipment";
import type { EquipmentItem } from "@/services/flexPullsheets";
import {
  isPaPresetCategory,
  type EquipmentLookupResult,
  type GearSection,
  type PullsheetPresetItemRow,
} from "@/components/festival/push-to-flex-pullsheet/model";

/** One piece of gear the festival's setup asks for, before it is matched to a Flex resource. */
export interface GearLine {
  model: string;
  quantity: number;
  category: string;
}

type SelectedSections = Record<GearSection, boolean>;

/** Wireless systems count channels plus transmitters; the legacy single quantity is the fallback. */
export const wirelessQuantity = (system: GearSetupFormData["wireless_systems"][number]): number => {
  const channels = system.quantity_ch || 0;
  const transmitters = (system.quantity_hh || 0) + (system.quantity_bp || 0);
  return channels + transmitters > 0 ? channels + transmitters : system.quantity || 0;
};

/** IEM systems count handheld channels (or the legacy quantity) plus bodypacks. */
export const iemQuantity = (system: GearSetupFormData["iem_systems"][number]): number =>
  (system.quantity_hh || system.quantity || 0) + (system.quantity_bp || 0);

/** The gear of the selected sections with a model and a positive quantity, in section order. */
export function collectGearLines(gearSetup: GearSetupFormData, sections: SelectedSections): GearLine[] {
  const lines: GearLine[] = [];
  const add = (model: string | undefined, quantity: number | undefined, category: string) => {
    if (model && (quantity ?? 0) > 0) lines.push({ model, quantity: quantity ?? 0, category });
  };

  if (sections.consolas) {
    for (const console of gearSetup.foh_consoles) add(console.model, console.quantity, "foh_console");
    for (const console of gearSetup.mon_consoles) add(console.model, console.quantity, "mon_console");
  }
  if (sections.rf) {
    for (const system of gearSetup.wireless_systems) add(system.model, wirelessQuantity(system), "wireless");
  }
  if (sections.iem) {
    for (const system of gearSetup.iem_systems) add(system.model, iemQuantity(system), "iem");
  }
  if (sections.wired_mics) {
    for (const mic of gearSetup.wired_mics) add(mic.model, mic.quantity, "wired_mics");
  }
  return lines;
}

/** The distinct models to look up in the equipment catalogue (sorted, so the query key is stable). */
export const gearModelNames = (lines: readonly GearLine[]): string[] =>
  [...new Set(lines.map((line) => line.model))].sort();

/**
 * Matches gear lines to Flex resources. Lines of the same resource add up; models with no Flex
 * resource id are reported as missing (once each) and left out of the push.
 */
export function matchGearToResources(
  lines: readonly GearLine[],
  resourceIdByName: ReadonlyMap<string, string>,
): EquipmentLookupResult {
  const found: EquipmentItem[] = [];
  const missing: string[] = [];

  for (const line of lines) {
    const resourceId = resourceIdByName.get(line.model);
    if (!resourceId) {
      if (!missing.includes(line.model)) missing.push(line.model);
      continue;
    }
    const existing = found.find((item) => item.resourceId === resourceId);
    if (existing) existing.quantity += line.quantity;
    else found.push({ resourceId, quantity: line.quantity, name: line.model, category: line.category });
  }
  return { found, missing };
}

/** The PA (speakers + amplification) items of a preset: those with a Flex resource, merged per subsystem. */
export function matchPresetToResources(rows: readonly PullsheetPresetItemRow[]): EquipmentLookupResult {
  const foundByKey = new Map<string, EquipmentItem>();
  const missing: string[] = [];

  for (const row of rows) {
    const equipment = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
    if (!equipment || !isPaPresetCategory(equipment.category)) continue;

    const quantity = Number(row.quantity) || 0;
    if (quantity <= 0) continue;

    if (!equipment.resource_id) {
      missing.push(equipment.name);
      continue;
    }

    const subsystem = normalizePresetSubsystem(row.subsystem) ?? resolveSubsystemForEquipment(equipment);
    const key = `${equipment.resource_id}:${subsystem ?? ""}`;
    const existing = foundByKey.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      foundByKey.set(key, {
        resourceId: equipment.resource_id,
        quantity,
        name: equipment.name,
        category: equipment.category,
        subsystem,
      });
    }
  }
  return { found: [...foundByKey.values()], missing };
}

/**
 * What is finally pushed: gear plus (optionally) the PA preset, one line per resource and
 * subsystem. A line without a stored subsystem takes the one its category implies.
 */
export function mergeEquipmentToPush(...groups: ReadonlyArray<readonly EquipmentItem[]>): EquipmentItem[] {
  const merged = new Map<string, EquipmentItem>();
  for (const item of groups.flat()) {
    const subsystem =
      item.subsystem ??
      resolveSubsystemForEquipment({ category: item.category as EquipmentCategory | null }) ??
      // PA preset categories are valid subsystem identifiers when no explicit subsystem is stored.
      normalizePresetSubsystem(item.category) ??
      null;
    const key = `${item.resourceId}:${subsystem ?? ""}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.subsystem && subsystem) existing.subsystem = subsystem;
    } else {
      merged.set(key, { ...item, subsystem });
    }
  }
  return [...merged.values()];
}
