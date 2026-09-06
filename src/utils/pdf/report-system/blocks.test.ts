import { describe, expect, it, vi } from 'vitest';
import jsPDF from 'jspdf';
import { reportGeometry } from './index';
import { drawReportFactRows, drawReportNotes, drawReportProse } from './blocks';

describe('report text pagination', () => {
  for (const unit of ['mm', 'pt'] as const) {
    for (const kind of ['prose', 'notes', 'facts'] as const) {
      it(`keeps every ${kind} line inside the content band in ${unit}`, () => {
        const doc = new jsPDF({ unit });
        const geo = reportGeometry(doc);
        const text = Array.from({ length: 240 }, (_, i) => `Línea ${i}: revisión del equipo de Muñoz.`).join('\n');
        const drawn = vi.spyOn(doc, 'text');
        const start = geo.contentBottom - 5 * geo.mm;
        const end = kind === 'prose' ? drawReportProse(doc, geo, text, start)
          : kind === 'notes' ? drawReportNotes(doc, geo, [text], start)
            : drawReportFactRows(doc, geo, [['Equipo', text]], start);
        expect(doc.getNumberOfPages()).toBeGreaterThan(1);
        expect(end).toBeLessThanOrEqual(geo.contentBottom + 8 * geo.mm);
        const rendered: string[] = [];
        for (const args of drawn.mock.calls) {
          const [value, , y] = args;
          expect(y).toBeGreaterThanOrEqual(geo.contentTop);
          expect(y).toBeLessThanOrEqual(geo.contentBottom);
          // Each wrapped line is laid out independently, never an overflowing array.
          expect(typeof value).toBe('string');
          rendered.push(String(value));
        }
        expect(rendered.join(' ')).toContain('Línea 239');
      });
    }
  }
});
