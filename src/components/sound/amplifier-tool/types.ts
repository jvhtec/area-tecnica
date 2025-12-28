export interface SpeakerConfig {
  speakerId: string;
  quantity: number;
  maxLinked: number;
}

export interface SpeakerSection {
  speakers: SpeakerConfig[];
  mirrored?: boolean;
}

export interface AmplifierResults {
  totalAmplifiersNeeded: number;
  completeRaks: number;
  looseAmplifiers: number;
  plmRacks: number;
  loosePLMAmps: number;
  laAmpsTotal: number;
  plmAmpsTotal: number;
  perSection: {
    [key: string]: {
      amps: number;
      details: string[];
      totalAmps: number;
      mirrored?: boolean;
      laAmps?: number;
      plmAmps?: number;
    };
  };
}

