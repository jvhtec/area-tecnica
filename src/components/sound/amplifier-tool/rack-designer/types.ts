export type AmpModel = 'LA4' | 'LA4X' | 'LA8' | 'LA12X' | 'PLM20000D' | 'OTRO';

/** Side of the PA the amp feeds: left, right or center/mono (subs, delays, fills…). */
export type RackSide = 'L' | 'R' | 'C';

export interface RackDesignerAmp {
  id: string;
  presetName: string;
  ip: string;
  model: AmpModel;
}

export interface RackDesignerBlock {
  id: string;
  label: string;
  /** Hex fill color shared by every amp cell in the rack. */
  color: string;
  x: number;
  y: number;
  amps: RackDesignerAmp[];
}

export interface RackDesignerLayout {
  version: 1;
  title: string;
  /** Fingerprint of the calculator results this layout was generated from. */
  resultsFingerprint?: string;
  blocks: RackDesignerBlock[];
}
