import type { WirelessSystem, IEMSystem } from '@/types/festival-equipment';
import type { FrequencyBandSelection } from '@/lib/frequencyBands';

export interface ArtistTechnicalInfo {
  fohTech: boolean;
  monTech: boolean;
  fohConsole: { model: string; providedBy: string };
  monConsole: { model: string; providedBy: string };
  monitorsFromFoh?: boolean;
  fohWavesOutboard?: string;
  monWavesOutboard?: string;
  wireless: {
    systems?: WirelessSystem[];
    model?: string;
    providedBy: string;
    handhelds?: number;
    bodypacks?: number;
    band?: FrequencyBandSelection | string;
    channels?: number;
    hh?: number;
    bp?: number;
  };
  iem: {
    systems?: IEMSystem[];
    model?: string;
    providedBy: string;
    quantity?: number;
    band?: FrequencyBandSelection | string;
  };
  monitors: {
    enabled: boolean;
    quantity: number;
  };
}

export interface ArtistInfrastructure {
  providedBy: string;
  cat6: { enabled: boolean; quantity: number };
  hma: { enabled: boolean; quantity: number };
  coax: { enabled: boolean; quantity: number };
  opticalconDuo: { enabled: boolean; quantity: number };
  analog: number;
  other: string;
}

export interface PdfFestivalGearOptions {
  fohConsoles?: Array<{ model: string; quantity: number }>;
  monConsoles?: Array<{ model: string; quantity: number }>;
  fohWavesOutboard?: string;
  monWavesOutboard?: string;
  wirelessSystems?: Array<{
    model: string;
    quantity_hh: number;
    quantity_bp: number;
    quantity_ch?: number;
    band?: FrequencyBandSelection | string;
  }>;
  iemSystems?: Array<{
    model: string;
    quantity_hh: number;
    quantity_bp: number;
    band?: FrequencyBandSelection | string;
  }>;
  wiredMics?: Array<{ model: string; quantity: number }>;
  monitorsQuantity?: number;
  hasSideFill?: boolean;
  hasDrumFill?: boolean;
  hasDjBooth?: boolean;
  availableCat6Runs?: number;
  availableHmaRuns?: number;
  availableCoaxRuns?: number;
  availableOpticalconDuoRuns?: number;
  availableAnalogRuns?: number;
}

export interface ArtistPdfData {
  name: string;
  stage: number;
  date: string;
  schedule: {
    loadIn?: string;
    show: { start: string; end: string };
    soundcheck?: { start: string; end: string };
    lineCheck?: { start: string; end: string };
  };
  technical: ArtistTechnicalInfo;
  infrastructure: ArtistInfrastructure;
  extras: {
    sideFill: boolean;
    drumFill: boolean;
    djBooth: boolean;
    wired: string;
  };
  notes?: string;
  logoUrl?: string;
  wiredMics?: Array<{
    model: string;
    quantity: number;
    exclusive_use?: boolean;
    notes?: string;
  }>;
  micKit?: 'festival' | 'band' | 'mixed';
  riderMissing?: boolean;
  festivalOptions?: PdfFestivalGearOptions;
  publicFormUrl?: string;
  publicFormQrDataUrl?: string;
  stagePlotUrl?: string;
  stagePlotFileType?: string;
}

export interface ArtistPdfOptions {
  templateMode?: boolean;
  language?: 'es' | 'en';
}
