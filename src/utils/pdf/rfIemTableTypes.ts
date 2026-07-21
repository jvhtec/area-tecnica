import type { FrequencyBandSelection } from '@/lib/frequencyBands';
import type { RawRfIemScheduleFields, RfIemScheduleFields } from '@/utils/rfIemScheduleFields';

export interface RfIemSystemData {
  model: string;
  quantity?: number;
  quantity_ch?: number;
  quantity_hh?: number;
  quantity_bp?: number;
  band?: FrequencyBandSelection | string;
  provided_by?: 'festival' | 'band' | 'mixed';
}

export interface ArtistRfIemData extends RfIemScheduleFields {
  id?: string;
  name: string;
  stage: number;
  wirelessSystems: RfIemSystemData[];
  iemSystems: RfIemSystemData[];
  date?: string;
  isAfterMidnight?: boolean;
}

export interface RfIemTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistRfIemData[];
}

export type RawArtistLike = RawRfIemScheduleFields & {
  id?: string;
  name: string;
  stage: number;
  wirelessSystems?: RfIemSystemData[];
  iemSystems?: RfIemSystemData[];
  wireless_systems?: unknown;
  iem_systems?: unknown;
  wireless_provided_by?: unknown;
  iem_provided_by?: unknown;
  date?: unknown;
  isaftermidnight?: unknown;
  isAfterMidnight?: unknown;
};
