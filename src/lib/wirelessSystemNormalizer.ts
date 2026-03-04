import type { WirelessSetup } from "@/types/festival";
import { coerceBandSelection, type FrequencyBandCategory } from "@/lib/frequencyBands";

const toSafeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeWirelessSystem = (
  system: Partial<WirelessSetup> | null | undefined,
  category: FrequencyBandCategory,
): WirelessSetup => {
  const quantityHh = toSafeNumber(system?.quantity_hh);
  const quantityBp = toSafeNumber(system?.quantity_bp);
  const quantity =
    category === "iem" ? toSafeNumber(system?.quantity ?? quantityHh) : toSafeNumber(system?.quantity ?? quantityHh + quantityBp);
  const quantityCh = category === "wireless" ? toSafeNumber(system?.quantity_ch) : undefined;

  return {
    _id: system?._id || crypto.randomUUID(),
    model: typeof system?.model === "string" ? system.model : "",
    quantity,
    quantity_hh: quantityHh,
    quantity_bp: quantityBp,
    quantity_ch: quantityCh,
    band: coerceBandSelection(category, typeof system?.model === "string" ? system.model : "", system?.band),
    notes: typeof system?.notes === "string" ? system.notes : undefined,
    provided_by:
      system?.provided_by === "festival" || system?.provided_by === "band" || system?.provided_by === "mixed"
        ? system.provided_by
        : "festival",
  };
};

export const normalizeWirelessSystems = (
  systems: unknown,
  category: FrequencyBandCategory,
): WirelessSetup[] => {
  if (!Array.isArray(systems)) return [];
  return systems.map((system) => normalizeWirelessSystem(system as Partial<WirelessSetup>, category));
};
