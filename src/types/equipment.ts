
import { Database } from "@/integrations/supabase/types";

export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type StockEntry = Database["public"]["Tables"]["global_stock_entries"]["Row"];
export type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];

// Define the Preset and PresetItem types based on our new database schema
export type Preset = {
  id: string;
  name: string;
  user_id: string;
  department?: string;
  created_by?: string | null;
  job_id?: string | null;
  tour_id?: string | null;
  is_template?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type PresetSubsystem =
  | 'mains'
  | 'outs'
  | 'subs'
  | 'fronts'
  | 'delays'
  | 'other'
  | 'amplification';

export type PresetItem = {
  id: string;
  preset_id: string;
  equipment_id: string;
  quantity: number;
  subsystem?: PresetSubsystem | null;
  source?: string | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export interface PresetWithItems extends Preset {
  items: (PresetItem & {
    equipment: Equipment;
  })[];
}

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
  'foh_console',
  'mon_console',
  'wireless',
  'iem',
  'wired_mics',
  'speakers',
  'monitors',
  'amplificacion',
  'pa_mains',
  'pa_outfill',
  'pa_subs',
  'pa_frontfill',
  'pa_delays',
  'pa_amp'
] as const;

export const EQUIPMENT_CATEGORIES = [
  ...LIGHTS_CATEGORIES,
  ...SOUND_CATEGORIES,
] as const;

export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number];
export type LightsCategory = typeof LIGHTS_CATEGORIES[number];
export type SoundCategory = typeof SOUND_CATEGORIES[number];
export type AllCategories = LightsCategory | SoundCategory;

const lightsCategoryLabels: Record<LightsCategory, string> = {
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
};

// Add label mappings for sound categories (includes legacy + PA-specific)
export const soundCategoryLabels: Record<SoundCategory, string> = {
  foh_console: 'FOH Console',
  mon_console: 'Monitor Console',
  wireless: 'Wireless',
  iem: 'IEM',
  wired_mics: 'Wired Mics',
  speakers: 'Speakers',
  monitors: 'Monitors',
  amplificacion: 'Amplificación',
  pa_mains: 'PA - Mains',
  pa_outfill: 'PA - Outfill',
  pa_subs: 'PA - Subs',
  pa_frontfill: 'PA - Frontfill',
  pa_delays: 'PA - Delays',
  pa_amp: 'PA - Amplificación'
};

// Combined category labels
export const categoryLabels: Record<EquipmentCategory, string> = {
  ...lightsCategoryLabels,
  ...soundCategoryLabels
};
export const allCategoryLabels: Record<AllCategories, string> = categoryLabels;

export const getCategoriesForDepartment = (department: Department): readonly AllCategories[] => {
  switch (department) {
    case 'lights':
      return LIGHTS_CATEGORIES as readonly AllCategories[];
    case 'sound':
      return SOUND_CATEGORIES as readonly AllCategories[];
    case 'video':
      return []; // Video categories can be added later
    default:
      return EQUIPMENT_CATEGORIES as readonly AllCategories[];
  }
};

// Equipment model categories (for the equipment table - sound department)
export const SOUND_MODEL_CATEGORIES = [
  { value: 'pa_mains', label: 'PA - Mains' },
  { value: 'pa_outfill', label: 'PA - Outfill' },
  { value: 'pa_subs', label: 'PA - Subs' },
  { value: 'pa_frontfill', label: 'PA - Frontfill' },
  { value: 'pa_delays', label: 'PA - Delays' },
  { value: 'pa_amp', label: 'PA - Amplificación' },
  { value: 'foh_console', label: 'FOH Consoles' },
  { value: 'mon_console', label: 'Monitor Consoles' },
  { value: 'wireless', label: 'Wireless Systems' },
  { value: 'iem', label: 'IEM Systems' },
  { value: 'wired_mics', label: 'Wired Microphones' },
  { value: 'speakers', label: 'Speakers (legacy)' },
  { value: 'monitors', label: 'Monitors (legacy)' },
  { value: 'amplificacion', label: 'Amplificación (legacy)' }
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

const PRESET_SUBSYSTEMS: PresetSubsystem[] = [
  'mains',
  'outs',
  'subs',
  'fronts',
  'delays',
  'other',
  'amplification',
];

const CATEGORY_TO_SUBSYSTEM: Partial<Record<SoundCategory, PresetSubsystem>> = {
  pa_mains: 'mains',
  pa_outfill: 'outs',
  pa_subs: 'subs',
  pa_frontfill: 'fronts',
  pa_delays: 'delays',
  pa_amp: 'amplification',
  amplificacion: 'amplification',
  speakers: 'mains',
};

const isSoundCategory = (category: string): category is SoundCategory =>
  (SOUND_CATEGORIES as readonly string[]).includes(category);

export const resolveSubsystemForEquipment = (
  equipment?: Pick<Equipment, 'category'> | null
): PresetSubsystem | null => {
  if (!equipment?.category) return null;
  if (!isSoundCategory(equipment.category)) return null;
  return CATEGORY_TO_SUBSYSTEM[equipment.category] ?? null;
};

export const PA_PRESET_ALLOWED_CATEGORIES: SoundCategory[] = [
  'pa_mains',
  'pa_outfill',
  'pa_subs',
  'pa_frontfill',
  'pa_delays',
  'pa_amp',
  'speakers',
  'amplificacion',
];

type PresetItemRow = Database["public"]["Tables"]["preset_items"]["Row"] & {
  equipment: Equipment;
};

type PresetWithItemsRow = Database["public"]["Tables"]["presets"]["Row"] & {
  items: PresetItemRow[];
};

const normalizePresetSubsystem = (value: string | null): PresetSubsystem | null =>
  PRESET_SUBSYSTEMS.includes(value as PresetSubsystem) ? (value as PresetSubsystem) : null;

export const mapPresetItemRow = (row: PresetItemRow): PresetItem & { equipment: Equipment } => ({
  id: row.id,
  preset_id: row.preset_id,
  equipment_id: row.equipment_id,
  quantity: row.quantity,
  subsystem: normalizePresetSubsystem(row.subsystem),
  source: row.source ?? null,
  notes: row.notes ?? undefined,
  created_at: row.created_at ?? undefined,
  updated_at: row.updated_at ?? undefined,
  equipment: row.equipment,
});

export const mapPresetWithItemsRow = (row: PresetWithItemsRow): PresetWithItems => ({
  id: row.id,
  name: row.name,
  user_id: row.user_id ?? '',
  department: row.department,
  created_by: row.created_by,
  job_id: row.job_id,
  tour_id: row.tour_id,
  is_template: row.is_template,
  created_at: row.created_at ?? undefined,
  updated_at: row.updated_at ?? undefined,
  items: (row.items || []).map(mapPresetItemRow),
});
