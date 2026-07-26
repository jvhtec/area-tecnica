
import { FestivalGearSetup } from "./festival";
import { GearSetupFormData } from "./festival-gear";

export interface SectionProps {
  formData: GearSetupFormData;
  onChange: (changes: Partial<GearSetupFormData>) => void;
  gearSetup?: FestivalGearSetup | null;
  stageNumber?: number;
  isFieldLocked?: (field: string) => boolean;
  language?: 'es' | 'en';
}

export type ProviderValue = 'festival' | 'band' | 'mixed';

/**
 * `T` lets call sites keep a narrow provider union (e.g. `ProviderValue`) instead of
 * widening to `string`; it defaults to `string` for call sites reading raw DB columns.
 */
export interface ProviderSelectorProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  label: string;
  id: string;
  showMixed?: boolean;
  disabled?: boolean;
  language?: 'es' | 'en';
}

export interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  id: string;
  available?: number;
  validate?: (value: number) => boolean;
  min?: number;
  className?: string;
  disabled?: boolean;
  language?: 'es' | 'en';
}
