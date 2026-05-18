import { beforeEach, describe, expect, it, vi } from 'vitest';
import type jsPDF from 'jspdf';

const pdfMocks = vi.hoisted(() => {
  const autoTable = vi.fn();
  const constructor = vi.fn();
  const loadPdfLibs = vi.fn();

  return { autoTable, constructor, loadPdfLibs };
});

vi.mock('@/utils/pdf/lazyPdf', () => ({
  loadPdfLibs: pdfMocks.loadPdfLibs,
}));

import {
  blobToDataUrl,
  createPdfExportDocument,
  drawCorporatePdfHeader,
  drawGeneratedPdfFooter,
  getLastAutoTableY,
  loadFirstImageAsDataUrl,
  pdfToBlob,
  safeAddPdfImage,
} from '@/utils/pdf/exportHelpers';

const makePdf = () => ({
  internal: {
    pageSize: {
      width: 210,
      height: 297,
    },
  },
  setFillColor: vi.fn(),
  rect: vi.fn(),
  addImage: vi.fn(),
  setTextColor: vi.fn(),
  setFontSize: vi.fn(),
  text: vi.fn(),
  output: vi.fn(() => new Blob(['pdf'], { type: 'application/pdf' })),
  lastAutoTable: {
    finalY: 123,
  },
});

describe('PDF export helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a jsPDF document through the lazy PDF loader', async () => {
    const pdf = makePdf();
    pdfMocks.constructor.mockReturnValue(pdf);
    pdfMocks.loadPdfLibs.mockResolvedValue({
      jsPDF: pdfMocks.constructor,
      autoTable: pdfMocks.autoTable,
    });

    const result = await createPdfExportDocument({ orientation: 'landscape' });

    expect(pdfMocks.loadPdfLibs).toHaveBeenCalledTimes(1);
    expect(pdfMocks.constructor).toHaveBeenCalledWith({ orientation: 'landscape' });
    expect(result.pdf).toBe(pdf);
    expect(result.autoTable).toBe(pdfMocks.autoTable);
  });

  it('reads AutoTable finalY without local any casts', () => {
    const pdf = makePdf();

    expect(getLastAutoTableY(pdf as unknown as jsPDF, 40)).toBe(123);
    expect(getLastAutoTableY({} as jsPDF, 40)).toBe(40);
  });

  it('returns jsPDF blob output through a typed helper', () => {
    const pdf = makePdf();

    const blob = pdfToBlob(pdf as unknown as jsPDF);

    expect(pdf.output).toHaveBeenCalledWith('blob');
    expect(blob.type).toBe('application/pdf');
  });

  it('draws the shared corporate header and safely adds the logo', () => {
    const pdf = makePdf();

    drawCorporatePdfHeader(pdf as unknown as jsPDF, {
      title: 'Tour Name',
      subtitle: 'Tour Schedule',
      logo: 'data:image/png;base64,logo',
    });

    expect(pdf.setFillColor).toHaveBeenCalledWith(125, 1, 1);
    expect(pdf.rect).toHaveBeenCalledWith(0, 0, 210, 30, 'F');
    expect(pdf.addImage).toHaveBeenCalledWith('data:image/png;base64,logo', 'PNG', 5, 5, 25, 20);
    expect(pdf.text).toHaveBeenCalledWith('Tour Name', 105, 15, { align: 'center' });
    expect(pdf.text).toHaveBeenCalledWith('Tour Schedule', 105, 25, { align: 'center' });
  });

  it('draws the generated footer with logo and page number', () => {
    const pdf = makePdf();

    drawGeneratedPdfFooter(pdf as unknown as jsPDF, {
      generatedAt: new Date(Date.UTC(2026, 0, 2, 2, 4)),
      logo: 'data:image/png;base64,logo',
      pageNumber: 7,
    });

    expect(pdf.addImage).toHaveBeenCalledWith('data:image/png;base64,logo', 'PNG', 85, 272, 40, 15);
    expect(pdf.text).toHaveBeenCalledWith(
      'Generado el 2 de enero de 2026 a las 03:04',
      10,
      287,
    );
    expect(pdf.text).toHaveBeenCalledWith('Página 7', 180, 287);
  });

  it('keeps image failures local to the failed image', () => {
    const pdf = makePdf();
    pdf.addImage.mockImplementation(() => {
      throw new Error('bad image');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(safeAddPdfImage(pdf as unknown as jsPDF, 'broken', 'PNG', 1, 2, 3, 4)).toBe(false);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('loads the first available image path as a data URL', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(new Blob(['logo'], { type: 'image/png' }), { status: 200 }),
      );

    const dataUrl = await loadFirstImageAsDataUrl(['/missing.png', '/logo.png']);

    expect(fetch).toHaveBeenNthCalledWith(1, '/missing.png');
    expect(fetch).toHaveBeenNthCalledWith(2, '/logo.png');
    expect(dataUrl).toBe(await blobToDataUrl(new Blob(['logo'], { type: 'image/png' })));
  });
});
