import { describe, expect, it } from 'vitest';

import type { EventData } from '@/utils/hoja-de-ruta/pdf/core/pdf-types';
import { PDFDocument } from '@/utils/hoja-de-ruta/pdf/core/pdf-document';
import { ProgramSection } from '@/utils/hoja-de-ruta/pdf/sections/program';
import { reportGeometry } from '@/utils/pdf/report-system';

const LONG_NOTE =
  'Mantener despejada la zona de carga durante toda la prueba y confirmar por intercom antes de mover cualquier equipo del escenario.';

type AutoTableState = {
  columns: Array<{ width: number }>;
  body: Array<{ cells: Record<number, { text: string[] }> }>;
};

const getLastTable = (pdfDoc: PDFDocument): AutoTableState =>
  (pdfDoc.document as unknown as { lastAutoTable: AutoTableState }).lastAutoTable;

describe('ProgramSection', () => {
  it.each([
    {
      name: 'single-day programs',
      eventData: {
        programSchedule: [{ time: '10:00', item: 'Prueba', dept: 'Sonido', notes: LONG_NOTE }],
      },
    },
    {
      name: 'multi-day programs',
      eventData: {
        programScheduleDays: [
          {
            label: 'Día 1',
            rows: [{ time: '10:00', item: 'Prueba', dept: 'Sonido', notes: LONG_NOTE }],
          },
        ],
      },
    },
  ])('keeps long notes inside the printable table width for $name', ({ eventData }) => {
    const pdfDoc = new PDFDocument();
    const section = new ProgramSection(pdfDoc);

    section.addProgramSection(eventData as EventData, 30, { includeScheduleText: false });

    const table = getLastTable(pdfDoc);
    const columnWidths = table.columns.map((column) => column.width);

    // The columns are distributed across the content width rather than guessed,
    // which is what keeps a long note wrapping inside its cell instead of
    // breaking words or running past the right margin.
    const { contentWidth } = reportGeometry(pdfDoc.document);
    expect(columnWidths.reduce((total, width) => total + width, 0)).toBeCloseTo(contentWidth, 5);
    expect(columnWidths[3]).toBeGreaterThan(columnWidths[0]);
    expect(table.body[0].cells[3].text.length).toBeGreaterThan(1);
  });
});
