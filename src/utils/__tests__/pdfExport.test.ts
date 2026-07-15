import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { buildPowerCalculationSnapshot } from '@/features/technical-tools/power/powerCalculations';

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
    addFileToVFS: vi.fn(),
    addFont: vi.fn(),
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

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('uses each table snapshot and withholds invalid single-phase aggregate totals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
    }));
    const makeCalculation = (safetyMargin: number) =>
      buildPowerCalculationSnapshot({
        powerFactorSource: 'per-row',
        rawApparentPowerVa: 100,
        settings: { phaseMode: 'single', safetyMargin, voltage: 230 },
        totalWatts: 100,
      });
    const first = makeCalculation(10);
    const second = makeCalculation(20);

    await exportToPDF(
      'Potencia',
      [
        {
          name: 'A',
          rows: [{ quantity: '1', componentName: 'LED', watts: '100', totalWatts: 100, pf: '1.00' }],
          totalWatts: 100,
          adjustedWatts: first.adjustedWatts,
          totalVa: 9999,
          currentPerPhase: 99,
          phaseMode: 'three',
          calculation: first,
          pduType: 'Schuko 16A',
          toolType: 'consumos',
        },
        {
          name: 'B',
          rows: [{ quantity: '1', componentName: 'LED', watts: '100', totalWatts: 100, pf: '1.00' }],
          totalWatts: 100,
          adjustedWatts: second.adjustedWatts,
          totalVa: second.totalVa,
          currentPerPhase: second.currentLine,
          calculation: second,
          toolType: 'consumos',
        },
      ],
      'power',
      'Tour',
      '2026-07-10',
    );

    expect(pdf.text).toHaveBeenCalledWith(
      'Potencia: 100.00 W; ajustada (10%): 110.00 W',
      14,
      expect.any(Number),
    );
    expect(pdf.text).toHaveBeenCalledWith(
      'Potencia: 100.00 W; ajustada (20%): 120.00 W',
      14,
      expect.any(Number),
    );
    expect(pdf.text).toHaveBeenCalledWith(
      expect.stringContaining('no agregables'),
      14,
      expect.any(Number),
    );
    expect(pdf.text).toHaveBeenCalledWith(
      expect.stringContaining('1φ'),
      14,
      expect.any(Number),
    );
    expect(pdf.text).toHaveBeenCalledWith(
      expect.stringContaining('ΣP/ΣQ'),
      14,
      expect.any(Number),
    );
    expect(pdf.text).toHaveBeenCalledWith(
      'Aparente: 0.11 kVA; corriente de línea: 0.48 A',
      14,
      expect.any(Number),
    );
    expect(pdf.text).toHaveBeenCalledWith(
      'PDU: Schuko 16A; límite 80% 12.8 A; OK',
      14,
      expect.any(Number),
    );
    const unicodeFontCallIndex = pdf.setFont.mock.calls.findIndex(
      ([family]) => family === 'NotoSansPdf',
    );
    const unicodeTextCallIndex = pdf.text.mock.calls.findIndex(
      ([text]) => typeof text === 'string' && text.includes('1φ'),
    );
    expect(unicodeFontCallIndex).toBeGreaterThanOrEqual(0);
    expect(unicodeTextCallIndex).toBeGreaterThanOrEqual(0);
    expect(pdf.setFont.mock.invocationCallOrder[unicodeFontCallIndex]).toBeLessThan(
      pdf.text.mock.invocationCallOrder[unicodeTextCallIndex],
    );
    expect(pdfMocks.autoTable).toHaveBeenCalledWith(
      pdf,
      expect.objectContaining({
        head: [['Cantidad', 'Componente', 'Vatios (por unidad)', 'PF', 'Vatios Totales']],
      }),
    );
  });
});
