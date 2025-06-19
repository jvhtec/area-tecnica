
import { FestivalGearSetup } from "./festival";
import { GearSetupFormData } from "./festival-gear";

export interface SectionProps {
  formData: GearSetupFormData;
  onChange: (changes: Partial<GearSetupFormData>) => void;
  gearSetup?: FestivalGearSetup | null;
  stageNumber?: number;
}
