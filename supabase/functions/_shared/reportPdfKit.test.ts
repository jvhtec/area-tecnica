import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { drawReportProse, embedIssuerMark, embedReportFonts, REPORT_PAGE } from './reportPdfKit.ts';
import { buildMemoriaFrontMatter } from './memoriaAssembly.ts';
import { generateVacationPDF } from '../send-vacation-decision/index.ts';

vi.mock('https://esm.sh/pdf-lib@1.17.1', async () => await import('pdf-lib'));
vi.mock('https://esm.sh/date-fns@3.6.0', async () => await import('date-fns'));
vi.mock('https://deno.land/std@0.224.0/http/server.ts', () => ({ serve: vi.fn() }));
vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: vi.fn() }));

describe('server PDF review regressions', () => {
  it('retains the decision after long reasons in the actual emailed vacation PDF', async () => {
    const drawn = vi.spyOn(PDFPage.prototype, 'drawText');
    try {
      const { bytes } = await generateVacationPDF({
        id: 'v', technician_id: 't', start_date: '2026-09-10', end_date: '2026-09-12',
        created_at: '2026-09-06', updated_at: null, approved_at: '2026-09-06', approved_by: 'a',
        status: 'rejected', reason: 'Motivo de la solicitud. '.repeat(1000),
        rejection_reason: 'Motivo del rechazo. '.repeat(500) + 'FIN DEL RECHAZO',
      }, { storage: { from: () => ({ download: async () => ({ data: null, error: null }) }) } });
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(3);
      expect(drawn.mock.calls.map(([text]) => text).join(' ')).toContain('FIN DEL RECHAZO');
      for (const [, options] of drawn.mock.calls) expect(options?.y).toBeGreaterThanOrEqual(30);
    } finally { drawn.mockRestore(); }
  });
  it('continues long vacation reasons above the footer on new pages', async () => {
    const doc = await PDFDocument.create();
    const fonts = await embedReportFonts(doc);
    const baselines: number[] = [];
    const nextPage = () => {
      const page = doc.addPage([REPORT_PAGE.width, REPORT_PAGE.height]);
      const draw = page.drawText.bind(page);
      vi.spyOn(page, 'drawText').mockImplementation((text, options) => {
        baselines.push(options?.y ?? 0);
        draw(text, options);
      });
      return page;
    };
    drawReportProse(nextPage(), fonts, 'Motivo de la solicitud. '.repeat(1200), 90, nextPage);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    expect(Math.min(...baselines)).toBeGreaterThanOrEqual(70);
    expect(Math.max(...baselines)).toBeLessThanOrEqual(REPORT_PAGE.height - 120);
  });

  it('keeps optional issuer failures from preventing a text-only PDF', async () => {
    const doc = await PDFDocument.create();
    const download = vi.fn().mockRejectedValue(new Error('network unavailable'));
    expect(await embedIssuerMark(doc, { storage: { from: () => ({ download }) } })).toBeNull();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('adds a cover and index before sources, or only a cover for a complete memoria', async () => {
    const indexed = await PDFDocument.create();
    await buildMemoriaFrontMatter(indexed, {
      department: 'Sonido', projectName: 'Muñoz - Festival', branding: {},
      sections: [{ title: 'Material', pageCount: 2 }, { title: 'Consumos', pageCount: 3 }],
    });
    expect(indexed.getPageCount()).toBe(2);
    const complete = await PDFDocument.create();
    await buildMemoriaFrontMatter(complete, { department: 'Iluminación', projectName: 'Festival', branding: {} });
    expect(complete.getPageCount()).toBe(1);
  });
});
