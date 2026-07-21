import type { EquipmentItem } from '@/services/flexPullsheets';
import type { GearSetupFormData } from '@/types/festival-gear';
import {
  PA_PRESET_ALLOWED_CATEGORIES,
  type EquipmentCategory,
  type PresetSubsystem,
} from '@/types/equipment';

export interface PushToFlexPullsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gearSetup: GearSetupFormData;
  jobId: string;
}

export interface EquipmentLookupResult {
  found: EquipmentItem[];
  missing: string[];
}

export interface PaPresetOption {
  id: string;
  name: string;
  job_id: string | null;
}

export interface PresetEquipmentRow {
  id: string;
  name: string;
  category: EquipmentCategory | null;
  resource_id: string | null;
}

export interface PresetItemRow {
  quantity: number | null;
  subsystem?: string | null;
  equipment: PresetEquipmentRow | PresetEquipmentRow[] | null;
}

const PA_PRESET_CATEGORIES = new Set(PA_PRESET_ALLOWED_CATEGORIES);
const PRESET_SUBSYSTEMS: PresetSubsystem[] = [
  'mains',
  'outs',
  'subs',
  'fronts',
  'delays',
  'other',
  'amplification',
];

export function isPaPresetCategory(category: string | null): category is EquipmentCategory {
  return !!category && PA_PRESET_CATEGORIES.has(
    category as (typeof PA_PRESET_ALLOWED_CATEGORIES)[number],
  );
}

export function normalizePresetSubsystem(
  value: string | null | undefined,
): PresetSubsystem | null {
  return PRESET_SUBSYSTEMS.includes(value as PresetSubsystem)
    ? (value as PresetSubsystem)
    : null;
}

export type GearSection = 'consolas' | 'rf' | 'iem' | 'wired_mics';

export const GEAR_SECTIONS: { key: GearSection; label: string }[] = [
  { key: 'consolas', label: 'Consolas' },
  { key: 'rf', label: 'Microfonía RF' },
  { key: 'iem', label: 'IEM' },
  { key: 'wired_mics', label: 'Microfonía Cableada' },
];

export const ALL_SECTIONS_ENABLED: Record<GearSection, boolean> = {
  consolas: true,
  rf: true,
  iem: true,
  wired_mics: true,
};
