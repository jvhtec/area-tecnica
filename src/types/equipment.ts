
import { Database } from "@/integrations/supabase/types";

export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type Preset = Database["public"]["Tables"]["presets"]["Row"];
export type PresetItem = Database["public"]["Tables"]["preset_items"]["Row"];
export type StockEntry = {
  id: string;
  equipment_id: string;
  base_quantity: number;
  created_at?: string;
  updated_at?: string;
};
export type DayAssignment = Database["public"]["Tables"]["day_assignments"]["Row"];

export interface PresetWithItems extends Preset {
  items: (PresetItem & {
    equipment: Equipment;
  })[];
}

export const EQUIPMENT_CATEGORIES = ['convencional', 'robotica', 'fx', 'rigging', 'controles', 'cuadros', 'led', 'strobo', 'canones', 'estructuras'] as const;
export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number];

export const categoryLabels: Record<EquipmentCategory, string> = {
  convencional: 'Convencional',
  robotica: 'Robótica',
  controles: 'Controles',
  fx: 'FX',
  cuadros: 'Cuadros',
  rigging: 'Rigging',
  led: 'LED',
  strobo: 'Strobo',
  canones: 'Cañones',
  estructuras: 'Estructuras'
};
