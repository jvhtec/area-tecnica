
import { FestivalGearSetup } from "./festival";

export type Provider = 'festival' | 'band';

export interface ProviderSelectorProps {
  value: Provider;
  onChange: (value: Provider) => void;
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

export interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  provider: Provider;
  festivalOptions?: Array<{ model: string; quantity?: number }>;
  bandOptions: string[];
  placeholder?: string;
}

export interface SectionProps {
  formData: any;
  onChange: (changes: Partial<any>) => void;
  gearSetup?: FestivalGearSetup;
}
