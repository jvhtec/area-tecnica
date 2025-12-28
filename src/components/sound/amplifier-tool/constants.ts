export const soundComponentDatabase = [
  { id: 1, name: "K1", weight: 56 },
  { id: 2, name: "K2", weight: 43 },
  { id: 3, name: "K3", weight: 35 },
  { id: 4, name: "KARA II", weight: 26 },
  { id: 5, name: "KIVA", weight: 13 },
  { id: 6, name: "KS28", weight: 79 },
  { id: 7, name: "SB28", weight: 93 },
  { id: 8, name: "K1-SB", weight: 83 },
  { id: 9, name: "KS21", weight: 49 },
  { id: 10, name: "X15", weight: 21 },
  { id: 11, name: "115HiQ", weight: 35 },
  { id: 12, name: "TFS900H", weight: 45 },
  { id: 13, name: "TFS600A", weight: 35 },
  { id: 14, name: "TFS550H", weight: 28 },
  { id: 15, name: "TFS900B", weight: 65 },
  { id: 16, name: "TFS550L", weight: 42 },
];

export const sectionSpeakers = {
  mains: ["K1", "K2", "K3", "KARA II", "TFS900H", "TFS600A", "TFS550H"],
  outs: ["K1", "K2", "K3", "KARA II", "TFS900H", "TFS600A", "TFS550H"],
  subs: ["KS28", "SB28", "K1-SB", "KS21", "TFS900B", "TFS550L"],
  fronts: ["KARA II", "KIVA"],
  delays: ["K1", "K2", "K3", "KARA II", "TFS900H", "TFS600A", "TFS550H"],
  other: ["KIVA", "X15", "115HiQ"],
};

export const speakerAmplifierConfig: Record<
  string,
  { maxLink: number; maxPerAmp: number; channelsRequired: number }
> = {
  K1: { maxLink: 2, maxPerAmp: 2, channelsRequired: 4 },
  K2: { maxLink: 3, maxPerAmp: 3, channelsRequired: 4 },
  K3: { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  "KARA II": { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  KIVA: { maxLink: 4, maxPerAmp: 12, channelsRequired: 1 },
  KS28: { maxLink: 1, maxPerAmp: 4, channelsRequired: 1 },
  SB28: { maxLink: 1, maxPerAmp: 4, channelsRequired: 1 },
  "K1-SB": { maxLink: 1, maxPerAmp: 4, channelsRequired: 1 },
  KS21: { maxLink: 2, maxPerAmp: 8, channelsRequired: 0.5 },
  X15: { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  "115HiQ": { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  TFS900H: { maxLink: 3, maxPerAmp: 3, channelsRequired: 4 },
  TFS600A: { maxLink: 3, maxPerAmp: 3, channelsRequired: 3 },
  TFS550H: { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  TFS900B: { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  TFS550L: { maxLink: 3, maxPerAmp: 12, channelsRequired: 1 },
};

export const isTFSpeaker = (speakerName: string): boolean => {
  return speakerName.trim().startsWith("TFS");
};
