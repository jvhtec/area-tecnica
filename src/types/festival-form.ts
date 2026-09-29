
import { FestivalGearSetup } from "./festival";
import { GearSetupFormData } from "./festival-gear";

/**
 * Props of a form section. `F` is the slice of form data the section reads and writes, so
 * the same section serves the gear setup form and the artist editors (which have different
 * models) without either casting to the other.
 */
export interface SectionProps<F = GearSetupFormData> {
  formData: F;
  onChange: (changes: Partial<F>) => void;
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
