import type { Database } from "@/integrations/supabase/types";
import type {
  TourDefaultTable,
} from "@/hooks/useTourDefaultSets";
import type {
  TourPowerDefault as StoredTourPowerDefault,
} from "@/hooks/useTourPowerDefaults";
import type {
  TourWeightDefault as StoredTourWeightDefault,
} from "@/hooks/useTourWeightDefaults";
import type { TourPackageSize } from "@/utils/tourPackages";

const UNKNOWN_LOCATION_LABEL = "Ubicación desconocida";

export type TourDefaultsTour = {
  id: string;
  name: string;
};

export interface TourDateWithLocation {
  id: string;
  date: string;
  tour_id?: string | null;
  is_tour_pack_only?: boolean | null;
  sound_package_size?: TourPackageSize | null;
  lights_package_size?: TourPackageSize | null;
  video_package_size?: TourPackageSize | null;
  sound_default_set_id?: string | null;
  lights_default_set_id?: string | null;
  video_default_set_id?: string | null;
  locations?: { name: string | null } | Array<{ name: string | null }> | null;
}

export type TourPowerDefault = StoredTourPowerDefault & {
  item_name?: string;
};

export type TourWeightDefault = StoredTourWeightDefault & {
  table_name?: string;
};

export type CombinedDefaultType =
  | TourDefaultTable
  | TourPowerDefault
  | TourWeightDefault;

type TourPowerDefaultRow =
  Database["public"]["Tables"]["tour_power_defaults"]["Row"];

export const isNewFormatTable = (
  item: CombinedDefaultType,
): item is TourDefaultTable => "set_id" in item || "table_data" in item;

export const isLegacyPowerDefault = (
  item: CombinedDefaultType,
): item is TourPowerDefault => "total_watts" in item && !("set_id" in item);

export const isLegacyWeightDefault = (
  item: CombinedDefaultType,
): item is TourWeightDefault => "weight_kg" in item && !("set_id" in item);

export const toTourPowerDefaultRows = (
  items: TourPowerDefault[],
  tourId: string,
): TourPowerDefaultRow[] =>
  items.map(
    (item): TourPowerDefaultRow => ({
      id: item.id,
      tour_id: item.tour_id || tourId,
      table_name: item.table_name || item.item_name || "Unnamed",
      total_watts: item.total_watts || 0,
      current_per_phase: item.current_per_phase || 0,
      pdu_type: item.pdu_type || "",
      custom_pdu_type: item.custom_pdu_type ?? null,
      custom_position: item.custom_position ?? null,
      position: item.position ?? null,
      includes_hoist: item.includes_hoist ?? false,
      department: item.department ?? null,
      created_at: item.created_at ?? null,
      updated_at: null,
    }),
  );

export const getTourDateLocationName = (
  tourDate: TourDateWithLocation,
): string => {
  const location = Array.isArray(tourDate.locations)
    ? tourDate.locations[0]
    : tourDate.locations;
  return location?.name || UNKNOWN_LOCATION_LABEL;
};

export const getTableName = (table: CombinedDefaultType): string => {
  if (isNewFormatTable(table)) return table.table_name || "Unnamed";
  if (isLegacyPowerDefault(table)) {
    return table.table_name || table.item_name || "Unnamed";
  }
  if (isLegacyWeightDefault(table)) {
    return table.table_name || table.item_name || "Unnamed";
  }
  return "Unnamed";
};

export const getPowerValue = (table: CombinedDefaultType): number => {
  if (isNewFormatTable(table)) return table.total_value || 0;
  if (isLegacyPowerDefault(table)) return table.total_watts || 0;
  return 0;
};

export const getWeightValue = (table: CombinedDefaultType): number => {
  if (isNewFormatTable(table)) return table.total_value || 0;
  if (isLegacyWeightDefault(table)) {
    return (table.weight_kg || 0) * (table.quantity || 1);
  }
  return 0;
};

export const getLegacyWeightQuantity = (
  table: CombinedDefaultType,
): number =>
  isLegacyWeightDefault(table) ? table.quantity || 1 : 1;

export const getCurrentPerPhase = (
  table: CombinedDefaultType,
): number | undefined => {
  if (isNewFormatTable(table)) return table.metadata?.current_per_phase;
  if (isLegacyPowerDefault(table)) return table.current_per_phase;
  return undefined;
};
