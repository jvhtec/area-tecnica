import type { NwmMap } from './nwm-import';

export interface ImportedLaSession {
  sourceFileName: string;
  sourceType: 'xmlp' | 'nwm';
  importedAt: string;
  map: NwmMap;
  flysheet: NwmMap['flysheet'];
  units: NwmMap['units'];
  jobId?: string;
  tourId?: string;
  storageScope: string;
}

export function createImportedLaSession(
  fileName: string,
  map: NwmMap,
  context: Pick<ImportedLaSession, 'jobId' | 'tourId' | 'storageScope'>,
): ImportedLaSession {
  return {
    sourceFileName: fileName,
    sourceType: fileName.toLowerCase().endsWith('.xmlp') ? 'xmlp' : 'nwm',
    importedAt: new Date().toISOString(),
    map,
    flysheet: map.flysheet,
    units: map.units,
    ...context,
  };
}

export const canExportCompleteXmlpPackage = (session: ImportedLaSession | null) =>
  session?.sourceType === 'xmlp' &&
  Boolean(session.flysheet?.arrays.length) &&
  Boolean(session.units.length || session.flysheet?.arrays.some((array) => array.enclosures.length));
