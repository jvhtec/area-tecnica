import { describe, expect, it } from 'vitest';

import type { EventData } from '@/utils/hoja-de-ruta/pdf/core/pdf-types';
import { PDFDocument } from '@/utils/hoja-de-ruta/pdf/core/pdf-document';
import { ProgramSection } from '@/utils/hoja-de-ruta/pdf/sections/program';

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

    expect(columnWidths).toEqual([24, 40, 45, 61]);
    expect(columnWidths.reduce((total, width) => total + width, 0)).toBe(170);
    expect(table.body[0].cells[3].text.length).toBeGreaterThan(1);
  });
});
