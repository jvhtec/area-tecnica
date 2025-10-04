
import { Database } from "@/integrations/supabase/types";

export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type StockEntry = Database["public"]["Tables"]["global_stock_entries"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];

// Define the Preset and PresetItem types based on our new database schema
export type Preset = {
  id: string;
  name: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
};

export type PresetItem = {
  id: string;
  preset_id: string;
  equipment_id: string;
  quantity: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export interface PresetWithItems extends Preset {
  items: (PresetItem & {
    equipment: Equipment;
  })[];
}

export const EQUIPMENT_CATEGORIES = [
  'convencional', 'robotica', 'fx', 'rigging', 'controles', 'cuadros', 'led', 'strobo', 'canones', 'estructuras',
  'monitores', 'inalambricos'
] as const;
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
  estructuras: 'Estructuras',
  monitores: 'Monitores',
  inalambricos: 'Inalámbricos'
};

export type Department = 'lights' | 'sound' | 'video';

export const departmentLabels: Record<Department, string> = {
  lights: 'Iluminación',
  sound: 'Sonido',
  video: 'Video'
};
