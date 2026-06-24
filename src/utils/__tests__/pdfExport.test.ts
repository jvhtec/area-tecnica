import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMocks = vi.hoisted(() => {
  const autoTable = vi.fn();
  const loadPdfLibs = vi.fn();

  return { autoTable, loadPdfLibs };
});

vi.mock('@/utils/pdf/lazyPdf', () => ({
  loadPdfLibs: pdfMocks.loadPdfLibs,
}));

vi.mock('@/utils/pdf/powerStagePlotPdf', () => ({
  drawPowerStagePlot: vi.fn((_doc, _plot, options) => options.startY + 10),
}));

import { exportToPDF } from '@/utils/pdfExport';

type MockPdf = ReturnType<typeof makePdf>;

const makePdf = () => {
  const pdf = {
    internal: {
      pageSize: {
        width: 210,
        height: 297,
      },
      pages: [null, {}],
    },
    addImage: vi.fn(),
    addPage: vi.fn(() => {
      pdf.internal.pages.push({});
    }),
    output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
    rect: vi.fn(),
    setFillColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setPage: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    lastAutoTable: {
      finalY: 80,
    },
  };

  return pdf;
};

class FailingImage {
  crossOrigin = '';
  height = 1;
  width = 1;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onerror?.());
  }
}

describe('exportToPDF', () => {
  let pdf: MockPdf;

  beforeEach(() => {
    vi.clearAllMocks();
    pdf = makePdf();
    vi.stubGlobal('Image', FailingImage);
    pdfMocks.loadPdfLibs.mockResolvedValue({
      jsPDF: vi.fn(() => pdf),
      autoTable: pdfMocks.autoTable,
    });
    pdfMocks.autoTable.mockImplementation((doc, options) => {
      doc.lastAutoTable = { finalY: (options.startY || 70) + 20 };
      options.didDrawPage?.({ cursor: { y: doc.lastAutoTable.finalY } });
    });
  });

  it('labels weight summary rigging points as motors', async () => {
    await exportToPDF(
      'Peso XL',
      [
        {
          name: 'Main PA',
          rows: [],
          totalWeight: 250,
          riggingPoint: 'SX01, SX02',
          toolType: 'pesos',
        },
      ],
      'weight',
      'Tour',
      '2026-07-10'
    );

    expect(pdfMocks.autoTable).toHaveBeenCalledWith(
      pdf,
      expect.objectContaining({
        head: [['Truss', 'Motores', 'Peso Total (kg)']],
        body: [['Main PA', '2', '250.00']],
      })
    );
  });

  it('prints the FOH schuko note on power summaries when requested', async () => {
    await exportToPDF(
      'Potencia XL',
      [
        {
          name: 'FoH',
          rows: [
            {
              quantity: '1',
              componentName: 'Control',
              watts: '100',
              totalWatts: 100,
            },
          ],
          totalWatts: 100,
          currentPerPhase: 1,
          pduType: 'Schuko 16A',
          position: 'FOH',
          toolType: 'consumos',
        },
      ],
      'power',
      'Tour',
      '2026-07-10',
      undefined,
      { totalSystemWatts: 100, totalSystemAmps: 1, totalSystemKva: 0.1 },
      0,
      undefined,
      true
    );

    expect(pdf.text).toHaveBeenCalledWith(
      expect.stringContaining('formato schuko hembra'),
      14,
      expect.any(Number)
    );
  });
});
