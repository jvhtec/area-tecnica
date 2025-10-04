
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
  'speakers', 'monitors'
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
  speakers: 'Speakers',
  monitors: 'Monitors'
};

export type Department = 'lights' | 'sound' | 'video';

export const departmentLabels: Record<Department, string> = {
  lights: 'Iluminación',
  sound: 'Sonido',
  video: 'Video'
};

// Categories by department
export const LIGHTS_CATEGORIES = [
  'convencional', 'robotica', 'fx', 'rigging', 'controles', 'cuadros', 'led', 'strobo', 'canones', 'estructuras'
] as const;

export const SOUND_CATEGORIES = [
  'foh_console', 'mon_console', 'wireless', 'iem', 'wired_mics', 'speakers', 'monitors'
] as const;

export type LightsCategory = typeof LIGHTS_CATEGORIES[number];
export type SoundCategory = typeof SOUND_CATEGORIES[number];
export type AllCategories = LightsCategory | SoundCategory;

// Add label mappings for sound categories
export const soundCategoryLabels: Record<SoundCategory, string> = {
  foh_console: 'FOH Console',
  mon_console: 'Monitor Console',
  wireless: 'Wireless',
  iem: 'IEM',
  wired_mics: 'Wired Mics',
  speakers: 'Speakers',
  monitors: 'Monitors'
};

// Combined category labels
export const allCategoryLabels: Record<AllCategories, string> = {
  ...categoryLabels,
  ...soundCategoryLabels
};

export const getCategoriesForDepartment = (department: Department): readonly EquipmentCategory[] => {
  switch (department) {
    case 'lights':
      return LIGHTS_CATEGORIES as readonly EquipmentCategory[];
    case 'sound':
      return SOUND_CATEGORIES as readonly EquipmentCategory[];
    case 'video':
      return []; // Video categories can be added later
    default:
      return EQUIPMENT_CATEGORIES;
  }
};

// Equipment model categories (for the equipment_models table - text field)
export const SOUND_MODEL_CATEGORIES = [
  { value: 'foh_console', label: 'FOH Consoles' },
  { value: 'mon_console', label: 'Monitor Consoles' },
  { value: 'wireless', label: 'Wireless Systems' },
  { value: 'iem', label: 'IEM Systems' },
  { value: 'wired_mics', label: 'Wired Microphones' }
] as const;

export const LIGHTS_MODEL_CATEGORIES = [
  { value: 'convencional', label: 'Convencional' },
  { value: 'robotica', label: 'Robótica' },
  { value: 'fx', label: 'FX' },
  { value: 'rigging', label: 'Rigging' },
  { value: 'controles', label: 'Controles' }
] as const;

export const getModelCategoriesForDepartment = (department: Department) => {
  switch (department) {
    case 'sound':
      return SOUND_MODEL_CATEGORIES;
    case 'lights':
      return LIGHTS_MODEL_CATEGORIES;
    default:
      return [];
  }
};
