
import { FestivalGearSetup } from "./festival";

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

export interface SectionProps {
  formData: any;
  onChange: (changes: Partial<any>) => void;
  gearSetup?: FestivalGearSetup;
}
