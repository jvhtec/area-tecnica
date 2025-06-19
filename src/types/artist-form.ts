
import { FestivalGearSetup } from "./festival";

export interface ArtistSectionProps {
  formData: any;
  onChange: (changes: any) => void;
  gearSetup?: FestivalGearSetup | null;
}
