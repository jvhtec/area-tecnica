
import type { FrequencyBandSelection } from "@/lib/frequencyBands";

export const WIRELESS_SYSTEMS = [
  'Shure AD Series',
  'Shure AXT Series',
  'Shure UR Series',
  'Shure ULX Series',
  'Shure QLX Series',
  'Audio-Technica 3000 Series',
  'Sound Devices Astral Series',
  'Sennheiser 2000 Series',
  'Sennheiser EW500 Series',
  'Sennheiser EW300 Series',
  'Sennheiser EW100 Series',
  'Sennheiser Spectera',
  'Sennheiser 6000 Series',
  'Sony UWP Series',
  'Other'
] as const;

export const IEM_SYSTEMS = [
  'Shure Digital PSM Series',
  'Shure PSM1000 Series',
  'Shure PSM900 Series',
  'Shure PSM300 Series',
  'Audio-Technica 3000 IEM Series',
  'Sennheiser 2000 series',
  'Sennheiser 300 G4 Series',
  'Sennheiser 300 G3 Series',
  'Sennheiser Spectera',
  'Wysicom MTK',
  'Other'
] as const;

export type WirelessSystemModel = typeof WIRELESS_SYSTEMS[number];
export type IEMSystemModel = typeof IEM_SYSTEMS[number];

// Persisted into jsonb columns, so this must stay a `type` alias: only aliases get
// the implicit index signature that makes them assignable to the generated `Json`.
export type WirelessSystem = {
  _id?: string;
  model: WirelessSystemModel | string;
  quantity?: number;
  quantity_hh?: number;
  quantity_bp?: number;
  quantity_ch?: number;
  band?: FrequencyBandSelection | string;
  provided_by?: 'festival' | 'band' | 'mixed';
  notes?: string;
}

// See WirelessSystem: `type`, not `interface`, so it stays assignable to `Json`.
export type IEMSystem = {
  _id?: string;
  model: IEMSystemModel | string;
  quantity?: number;  // Keep for backward compatibility
  quantity_hh?: number;  // Channels
  quantity_bp?: number;  // Bodypacks
  quantity_ch?: number;
  band?: FrequencyBandSelection | string;
  provided_by?: 'festival' | 'band' | 'mixed';
  notes?: string;
}

export type FestivalRadioSystem = WirelessSystem | IEMSystem;
