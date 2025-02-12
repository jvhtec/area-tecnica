
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

export type WirelessSystem = typeof WIRELESS_SYSTEMS[number];
export type IEMSystem = typeof IEM_SYSTEMS[number];

export interface WirelessSetup {
  model: WirelessSystem;
  quantity: number;
  band?: string;
}

export interface IEMSetup {
  model: IEMSystem;
  quantity: number;
  band?: string;
}
