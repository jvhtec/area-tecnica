
export const WIRELESS_SYSTEMS = [
  'Shure AD Series',
  'Shure AXT Series',
  'Shure UR Series',
  'Shure ULX Series',
  'Shure QLX Series',
  'Sennheiser 2000 Series',
  'Sennheiser EW500 Series',
  'Sennheiser EW300 Series',
  'Sennheiser EW100 Series',
  'Other'
] as const;

export const IEM_SYSTEMS = [
  'Shure Digital PSM Series',
  'Shure PSM1000 Series',
  'Shure PSM900 Series',
  'Shure PSM300 Series',
  'Sennheiser 2000 series',
  'Sennheiser 300 G4 Series',
  'Sennheiser 300 G3 Series',
  'Wysicom MTK',
  'Other'
] as const;

export type WirelessSystemModel = typeof WIRELESS_SYSTEMS[number];
export type IEMSystemModel = typeof IEM_SYSTEMS[number];

// Base interface for wireless system
export interface WirelessSystem {
  model: WirelessSystemModel | string;
  quantity_hh?: number;
  quantity_bp?: number;
  band?: string;
  provided_by?: 'festival' | 'band';
}

// Base interface for IEM system
export interface IEMSystem {
  model: IEMSystemModel | string;
  quantity?: number;  // Keep for backward compatibility
  quantity_hh?: number;  // Channels
  quantity_bp?: number;  // Bodypacks
  band?: string;
  provided_by?: 'festival' | 'band';
}
