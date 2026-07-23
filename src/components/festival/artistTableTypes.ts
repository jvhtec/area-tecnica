/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck: boolean;
  soundcheck_start?: string;
  soundcheck_end?: string;
  line_check?: boolean;
  line_check_start?: string;
  line_check_end?: string;
  load_in_time?: string;
  foh_console: string;
  foh_console_provided_by?: 'festival' | 'band' | 'mixed';
  foh_drive?: string;
  foh_drive_position?: string;
  mon_console: string;
  mon_console_provided_by?: 'festival' | 'band' | 'mixed';
  mon_position?: string;
  monitors_from_foh?: boolean;
  foh_waves_models?: any[];
  foh_outboard?: string;
  foh_waves_provided_by?: 'festival' | 'band' | 'mixed';
  mon_waves_models?: any[];
  mon_outboard?: string;
  mon_waves_provided_by?: 'festival' | 'band' | 'mixed';
  wireless_systems: any[];
  wireless_provided_by?: 'festival' | 'band' | 'mixed';
  iem_systems: any[];
  iem_provided_by?: 'festival' | 'band' | 'mixed';
  monitors_enabled: boolean;
  monitors_quantity: number;
  extras_sf: boolean;
  extras_df: boolean;
  extras_djbooth: boolean;
  notes?: string;
  rider_missing?: boolean;
  rider_copied_from_date?: string | null;
  rider_outdated?: boolean;
  rider_outdated_dismissed?: boolean;
  foh_tech?: boolean;
  mon_tech?: boolean;
  isaftermidnight?: boolean;
  mic_kit?: 'festival' | 'band' | 'mixed';
  wired_mics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
  job_id?: string;
  // Infrastructure fields
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
  infrastructure_provided_by?: 'festival' | 'band' | 'mixed';
  artist_submitted?: boolean;
  form_language?: "es" | "en";
  stage_plot_file_path?: string | null;
  stage_plot_file_name?: string | null;
  stage_plot_file_type?: string | null;
  stage_plot_uploaded_at?: string | null;
}

export interface ArtistTableProps {
  artists: Artist[];
  isLoading: boolean;
  onEditArtist: (artist: Artist) => void;
  onDeleteArtist: (artist: Artist) => void;
  searchTerm: string;
  stageFilter: string;
  riderFilter: string;
  dayStartTime: string;
  jobId?: string;
  selectedDate?: string;
  /** True while the search box is matching artists across every festival date, not just `selectedDate`. */
  crossDateSearch?: boolean;
  onArtistStagePlotUpdated?: () => void;
  canDelete: boolean;
  canCreateExtras: boolean;
}
