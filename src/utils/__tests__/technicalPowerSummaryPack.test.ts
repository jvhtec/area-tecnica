import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadPdfLibsMock,
  getCompanyLogoMock,
  jsPdfConstructorMock,
  autoTableMock,
  docMock,
} = vi.hoisted(() => {
  const doc = {
    setFillColor: vi.fn(),
    rect: vi.fn(),
    addImage: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    setPage: vi.fn(),
    addPage: vi.fn(function (this: any) {
      doc.internal.pages.push({});
      return this;
    }),
    output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
    internal: {
      pages: [undefined, {}],
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    lastAutoTable: {
      finalY: 120,
    },
  };

  return {
    loadPdfLibsMock: vi.fn(),
    getCompanyLogoMock: vi.fn(),
    jsPdfConstructorMock: vi.fn(() => doc),
    autoTableMock: vi.fn((instance: any, options: any) => {
      options.didDrawPage?.();
      instance.lastAutoTable = { finalY: 120 };
    }),
    docMock: doc,
  };
});

vi.mock('@/utils/pdf/lazyPdf', () => ({
  loadPdfLibs: loadPdfLibsMock,
}));

vi.mock('@/utils/pdf/logoUtils', () => ({
  getCompanyLogo: getCompanyLogoMock,
}));

import {
  buildTechnicalPowerSummaryPackFilename,
  generateTechnicalPowerSummaryPack,
} from '@/utils/pdf/technicalPowerSummaryPack';

describe('technicalPowerSummaryPack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPdfLibsMock.mockResolvedValue({
      jsPDF: jsPdfConstructorMock,
      autoTable: autoTableMock,
    });
    getCompanyLogoMock.mockResolvedValue(null);
    docMock.internal.pages = [undefined, {}];
    docMock.lastAutoTable = { finalY: 120 };
  });

  it('builds a stable filename for the export', () => {
    expect(buildTechnicalPowerSummaryPackFilename('Festival Test')).toContain(
      'Resumen Potencia Tecnica'
    );
  });

  it('returns a PDF blob and writes the expected section title', async () => {
    const blob = await generateTechnicalPowerSummaryPack({
      jobTitle: 'Festival Test',
      jobDate: '2026-04-07T10:00:00.000Z',
      jobLocation: 'Madrid Arena',
      summary: {
        departments: {
          sound: {
            department: 'sound',
            rows: [
              {
                name: 'FoH',
                pduLabel: '32A',
                positionLabel: 'FOH',
                totalWatts: 1000,
                currentPerPhase: 4,
                totalVa: 1052,
                notes: '',
                source: 'job',
              },
            ],
            safetyMargin: null,
            totalWatts: 1000,
            totalAmps: 4,
            totalKva: 1.05,
          },
          lights: {
            department: 'lights',
            rows: [],
            safetyMargin: null,
            totalWatts: 0,
            totalAmps: 0,
            totalKva: 0,
          },
          video: {
            department: 'video',
            rows: [],
            safetyMargin: null,
            totalWatts: 0,
            totalAmps: 0,
            totalKva: 0,
          },
        },
        totalSystemWatts: 1000,
        totalSystemAmps: 4,
        totalSystemKva: 1.05,
      },
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(jsPdfConstructorMock).toHaveBeenCalled();
    expect(autoTableMock).toHaveBeenCalled();
    expect(docMock.text).toHaveBeenCalledWith(
      'Resumen Tecnico de Potencia',
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
    expect(autoTableMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        head: [['Nombre Cuadro', 'PDU', 'Posición', 'Potencia', 'Corriente', 'Notas']],
      })
    );
  });

  it('formats job and created dates in Europe/Madrid', async () => {
    await generateTechnicalPowerSummaryPack({
      jobTitle: 'Festival Test',
      jobDate: '2026-04-06T22:30:00.000Z',
      generatedAt: new Date('2026-04-06T22:30:00.000Z'),
      summary: {
        departments: {
          sound: {
            department: 'sound',
            rows: [],
            safetyMargin: null,
            totalWatts: 0,
            totalAmps: 0,
            totalKva: 0,
          },
          lights: {
            department: 'lights',
            rows: [],
            safetyMargin: null,
            totalWatts: 0,
            totalAmps: 0,
            totalKva: 0,
          },
          video: {
            department: 'video',
            rows: [],
            safetyMargin: null,
            totalWatts: 0,
            totalAmps: 0,
            totalKva: 0,
          },
        },
        totalSystemWatts: 0,
        totalSystemAmps: 0,
        totalSystemKva: 0,
      },
    });

    expect(docMock.text).toHaveBeenCalledWith(
      'Fecha del trabajo: 07/04/2026',
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
    expect(docMock.text).toHaveBeenCalledWith(
      'Creado: 07/04/2026',
      expect.any(Number),
      expect.any(Number),
      expect.any(Object)
    );
  });
});
