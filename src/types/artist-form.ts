
import { FestivalGearSetup } from "./festival";
import { WiredMic } from "@/components/festival/gear-setup/WiredMicConfig";

export interface ArtistSectionProps {
  formData: {
    name: string;
    stage: number;
    date: string;
    show_start: string;
    show_end: string;
    soundcheck: boolean;
    soundcheck_start?: string;
    soundcheck_end?: string;
    foh_console: string;
    foh_console_provided_by: string;
    mon_console: string;
    mon_console_provided_by: string;
    wireless_systems: any[];
    iem_systems: any[];
    wireless_provided_by: string;
    iem_provided_by: string;
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
    infrastructure_provided_by: string;
    other_infrastructure: string;
    notes: string;
    foh_tech?: boolean;
    mon_tech?: boolean;
    rider_missing?: boolean;
    isaftermidnight?: boolean;
    mic_kit: 'festival' | 'band';
    wired_mics: WiredMic[];
    // Add GearSetupFormData compatibility fields
    max_stages?: number;
    foh_consoles?: any[];
    mon_consoles?: any[];
  };
  onChange: (changes: any) => void;
  gearSetup?: FestivalGearSetup | null;
}
