import { describe, expect, it } from 'vitest';
import {
  buildSoundvisionReportFilename,
  formatSoundvisionDateRange,
  parseSoundvisionEquipment,
  SOUNDVISION_PLOT_DEFINITIONS,
  validateSoundvisionReport,
  type SoundvisionPdfImage,
  type SoundvisionReportModel,
} from '@/features/technical-tools/soundvision/reportModel';
import {
  createSoundvisionReportDocument,
  fitImageWithin,
} from '@/utils/pdf/soundvisionReportPdf';

const PIXEL: SoundvisionPdfImage = {
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  width: 1000,
  height: 900,
  format: 'PNG',
};

const makeModel = (): SoundvisionReportModel => ({
  system: 'LA',
  eventTitle: 'Festival Rio Babel',
  stageLabel: 'Escenario Principal',
  eventDate: '02-04 July 2026',
  issuedDate: '01 July 2026',
  revision: 'A',
  equipment: [
    { quantity: '20', model: 'K2', role: 'Main hang' },
    { quantity: '12', model: 'KS28', role: 'Subwoofer' },
  ],
  conditions: {
    temperatureC: '15',
    humidityPercent: '70',
    inputLevelDbu: '0',
    audiencePlaneM: '1.60',
  },
  plots: SOUNDVISION_PLOT_DEFINITIONS.map((plot) => ({
    id: plot.id,
    title: plot.title,
    descriptor: plot.descriptor,
    weighting: plot.weighting,
    band: plot.band,
    topView: PIXEL,
    isoView: plot.isoFileBase ? PIXEL : null,
  })),
});

describe('soundvision report model', () => {
  it('parses quantity, model and optional role without losing free-form lines', () => {
    expect(parseSoundvisionEquipment([
      '24 K2 (Main hang)',
      '12 x KS28 (Subwoofer)',
      'GALAXY 816',
      '',
    ].join('\n'))).toEqual([
      { quantity: '24', model: 'K2', role: 'Main hang' },
      { quantity: '12', model: 'KS28', role: 'Subwoofer' },
      { quantity: '-', model: 'GALAXY 816', role: '' },
    ]);
  });

  it('formats single-day and multi-day event ranges in Madrid time', () => {
    expect(formatSoundvisionDateRange(
      '2026-07-02T10:00:00.000Z',
      '2026-07-02T22:00:00.000Z',
    )).toBe('02 July 2026');
    expect(formatSoundvisionDateRange(
      '2026-07-02T10:00:00.000Z',
      '2026-07-04T18:00:00.000Z',
    )).toBe('02-04 July 2026');
  });

  it('builds a stable, filesystem-safe filename', () => {
    expect(buildSoundvisionReportFilename(
      'LA',
      'Río Babel / 2026',
      'Escenario Principal',
    )).toBe('Soundvision_Report_Rio_Babel_2026_-_Escenario_Principal.pdf');
  });

  it('reports missing required content before rendering', () => {
    const model = makeModel();
    model.equipment = [];
    model.plots[1].topView = null;
    expect(validateSoundvisionReport(model)).toEqual([
      'Añada al menos una línea de equipamiento.',
      'Faltan vistas en planta: SPL(Z) 250 Hz - 16 kHz.',
    ]);
  });
});

describe('soundvision report PDF layout', () => {
  it('fits images without changing their aspect ratio', () => {
    expect(fitImageWithin(1600, 900, 10, 20, 100, 100)).toEqual({
      x: 10,
      y: 41.875,
      width: 100,
      height: 56.25,
    });
    expect(fitImageWithin(800, 1200, 10, 20, 100, 50)).toEqual({
      x: 43.333333333333336,
      y: 20,
      width: 33.33333333333333,
      height: 50,
    });
  });

  it('creates a complete four-page A4 report', async () => {
    const pdf = await createSoundvisionReportDocument(makeModel());
    expect(pdf.getNumberOfPages()).toBe(4);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
  });
});
