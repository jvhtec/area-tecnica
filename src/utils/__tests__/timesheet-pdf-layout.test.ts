import { afterEach, expect, it, vi } from 'vitest';
import jsPDF from 'jspdf';
import { generateTimesheetPDF } from '@/utils/timesheet-pdf';
import type { Table } from 'jspdf-autotable';

vi.mock('@/utils/pdf/logoUtils', () => ({ fetchJobLogo: async () => null }));
vi.mock('@/utils/pdf/festival-report/issuerMark', () => ({
  loadFestivalIssuerMark: async () => null, getFestivalIssuerMark: () => null,
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('draws each signature in Firma, leaving overtime and overnight hours intact', async () => {
  vi.stubGlobal('Image', class {
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  // jsPDF declares API as a plugin registry, not as its runtime image methods.
  const imageApi = jsPDF.API as unknown as Pick<jsPDF, 'addImage'>;
  const images = vi.spyOn(imageApi, 'addImage').mockImplementation(function (this: jsPDF) { return this; });
  const doc = await generateTimesheetPDF({
    job: { id: 'job', title: 'Prueba' } as never,
    date: '2026-09-06',
    timesheets: [{
      id: 'one', technician_id: 'tech', technician: { first_name: 'María', last_name: 'Muñoz' },
      date: '2026-09-06', start_time: '22:00:00', end_time: '06:00:00',
      ends_next_day: true, break_minutes: 30, overtime_hours: 2,
      signature_data: 'synthetic-signature', status: 'approved',
    }] as never,
  });
  const table = (doc as jsPDF & { lastAutoTable: Table }).lastAutoTable;
  const cells = table.body[0].cells;
  expect(cells[5].text).toEqual(['7.50']);
  expect(cells[6].text).toEqual(['2 h']);
  expect(cells[7].text.join('')).toBe('');
  expect(images).toHaveBeenCalledTimes(1);
  const [, format, x, y, width, height] = images.mock.calls[0] as unknown as [unknown, string, number, number, number, number];
  expect(format).toBe('PNG');
  expect(x).toBeGreaterThanOrEqual(cells[7].x);
  expect(x + width).toBeLessThanOrEqual(cells[7].x + cells[7].width);
  expect(y).toBeGreaterThanOrEqual(cells[7].y);
  expect(y + height).toBeLessThanOrEqual(cells[7].y + cells[7].height);
});
