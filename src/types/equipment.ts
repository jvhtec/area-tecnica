
import { Database } from "@/integrations/supabase/types";

export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type Preset = Database["public"]["Tables"]["presets"]["Row"];
export type PresetItem = Database["public"]["Tables"]["preset_items"]["Row"];
export type StockEntry = Database["public"]["Tables"]["stock_entries"]["Row"];
export type DayAssignment = Database["public"]["Tables"]["day_assignments"]["Row"];

export interface PresetWithItems extends Preset {
  items: (PresetItem & {
    equipment: Equipment;
  })[];
}
