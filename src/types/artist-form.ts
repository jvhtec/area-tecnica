
import { FestivalGearSetup } from "./festival";
import { WiredMic } from "@/components/festival/gear-setup/WiredMicConfig";
import type { ProviderValue } from "@/features/festival-artists/model";
import type { WavesModelSelection } from "@/constants/wavesModels";
import type { IEMSystem, WirelessSystem } from '@/types/festival-equipment';

/**
 * Fields the shared form sections read and write. The editors' `ArtistFormValues`
 * (features/festival-artists/model) and the public form state both satisfy it.
 */
export interface ArtistSectionFormData {
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_date?: string;
  soundcheck_start?: string;
  soundcheck_end?: string;
  line_check: boolean;
  line_check_start?: string;
  line_check_end?: string;
  load_in_time?: string;
  foh_console: string;
  foh_console_provided_by: ProviderValue;
  foh_drive?: string;
  foh_drive_position?: string;
  mon_console: string;
  mon_console_provided_by: ProviderValue;
  mon_position?: string;
  monitors_from_foh: boolean;
  foh_waves_models: WavesModelSelection[];
  foh_outboard: string;
  foh_waves_provided_by: ProviderValue;
  mon_waves_models: WavesModelSelection[];
  mon_outboard: string;
  mon_waves_provided_by: ProviderValue;
  wireless_systems: WirelessSystem[];
  iem_systems: IEMSystem[];
  wireless_provided_by: ProviderValue;
  iem_provided_by: ProviderValue;
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  extras_wired: string;
  infra_cat6: boolean;
  infra_cat6_quantity: number;
  infra_hma: boolean;
  infra_hma_quantity: number;
  infra_coax: boolean;
  infra_coax_quantity: number;
  infra_opticalcon_duo: boolean;
  infra_opticalcon_duo_quantity: number;
  infra_analog: number;
  infrastructure_provided_by: ProviderValue;
  other_infrastructure: string;
  notes: string;
  foh_tech?: boolean;
  mon_tech?: boolean;
  rider_missing?: boolean;
  isaftermidnight?: boolean;
  mic_kit: 'festival' | 'band' | 'mixed';
  wired_mics: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
}

export interface ArtistSectionProps {
  formData: ArtistSectionFormData;
  onChange: (changes: Partial<ArtistSectionFormData>) => void;
  gearSetup?: FestivalGearSetup | null;
  isFieldLocked?: (field: string) => boolean;
  readOnly?: boolean;
  language?: 'es' | 'en';
}
