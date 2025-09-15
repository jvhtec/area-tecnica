import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class ProgramSection {
  constructor(private pdfDoc: PDFDocument) {}

  addProgramSection(eventData: EventData, yPosition: number): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    // If multi-day structured program exists
    const anyEvent = eventData as any;
    if (Array.isArray(anyEvent.programScheduleDays) && anyEvent.programScheduleDays.some((d: any) => d?.rows?.length > 0)) {
      for (const [idx, day] of anyEvent.programScheduleDays.entries()) {
        const title = `${day?.label || `Día ${idx + 1}`}${day?.date ? ` (${day.date})` : ''}`;
        this.pdfDoc.setText(12, [125, 1, 1]);
        this.pdfDoc.addText(title, 20, yPosition);
        yPosition += 10;

        if (Array.isArray(day.rows) && day.rows.length > 0) {
          const body = day.rows.map((r: any) => [
            r.time || '',
            r.item || '',
            r.dept || '',
            r.notes || ''
          ]);
          this.pdfDoc.addTable({
            startY: yPosition,
            head: [["Hora", "Ítem", "Depto/Líder", "Notas"]],
            body,
            styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
            headStyles: { fillColor: [240, 240, 240], textColor: [51, 51, 51] },
            theme: 'grid',
            margin: { left: 20, right: 20 },
            columnStyles: {
              0: { cellWidth: 24 },
              1: { cellWidth: 40 },
              2: { cellWidth: 45 },
              3: { cellWidth: 'auto' },
            },
            tableWidth: 'wrap',
          });
          yPosition = this.pdfDoc.getLastAutoTableY() + 12;
        } else {
          yPosition += 8;
        }

        yPosition = this.pdfDoc.checkPageBreak(yPosition, 24);
      }
      return yPosition;
    }

    // If structured single-day program exists, render a table; otherwise fallback to legacy text
    if (eventData.programSchedule && eventData.programSchedule.length > 0) {
      // Render as a grid using autoTable wrapper
      const body = eventData.programSchedule.map((r) => [
        r.time || '',
        r.item || '',
        r.dept || '',
        r.notes || ''
      ]);
      this.pdfDoc.addTable({
        startY: yPosition,
        head: [["Hora", "Ítem", "Depto/Líder", "Notas"]],
        body,
        styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [240, 240, 240], textColor: [51, 51, 51] },
        theme: 'grid',
        margin: { left: 20, right: 20 },
        columnStyles: {
          0: { cellWidth: 24 }, // time
          1: { cellWidth: 40 }, // item
          2: { cellWidth: 45 }, // dept
          3: { cellWidth: 'auto' }, // notes
        },
        tableWidth: 'wrap',
      });
      return this.pdfDoc.getLastAutoTableY() + 12;
    }

    this.pdfDoc.setText(10, [51, 51, 51]);
    if (DataValidators.hasData(eventData.schedule)) {
      const scheduleLines = eventData.schedule!.split('\n');
      for (const line of scheduleLines) {
        if (line.trim()) {
          this.pdfDoc.addText(line.trim(), 30, yPosition);
          yPosition += 12;
        }
      }
      return yPosition + 10;
    }

    return yPosition;
  }
}
