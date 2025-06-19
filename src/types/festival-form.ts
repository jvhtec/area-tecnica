
import { FestivalGearSetup } from "./festival";
import { GearSetupFormData } from "./festival-gear";

export interface SectionProps {
  formData: GearSetupFormData;
  onChange: (changes: Partial<GearSetupFormData>) => void;
  gearSetup?: FestivalGearSetup | null;
  stageNumber?: number;
}

export interface ProviderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
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
}
