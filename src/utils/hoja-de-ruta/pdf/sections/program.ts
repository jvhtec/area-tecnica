import { PDFDocument } from '../core/pdf-document';
import { HOJA_HEADING, HOJA_INDENT, HOJA_LABEL, HOJA_LEFT, hojaGeometry, hojaTable } from '../hoja-report-system';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

/** Relative column widths: the clock is narrow, the notes take what is left. */
const PROGRAM_TABLE_WEIGHTS = [14, 24, 26, 36];

export class ProgramSection {
  constructor(private pdfDoc: PDFDocument) {}

  addProgramSection(
    eventData: EventData,
    yPosition: number,
    options: { includeStructured?: boolean; includeScheduleText?: boolean } = {}
  ): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);
    const includeStructured = options.includeStructured ?? true;
    const includeScheduleText = options.includeScheduleText ?? true;
    let renderedStructured = false;

    // If multi-day structured program exists
    const anyEvent = eventData as any;
    if (includeStructured && Array.isArray(anyEvent.programScheduleDays) && anyEvent.programScheduleDays.some((d: any) => d?.rows?.length > 0)) {
      for (const [idx, day] of anyEvent.programScheduleDays.entries()) {
        const title = `${day?.label || `Día ${idx + 1}`}${day?.date ? ` (${day.date})` : ''}`;
        this.pdfDoc.setText(12, HOJA_HEADING);
        this.pdfDoc.addText(title, HOJA_LEFT, yPosition);
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
            ...hojaTable(hojaGeometry(this.pdfDoc.document), {
              numericColumns: [0],
              weights: PROGRAM_TABLE_WEIGHTS,
            }),
          });
          yPosition = this.pdfDoc.getLastAutoTableY() + 12;
        } else {
          yPosition += 8;
        }

        yPosition = this.pdfDoc.checkPageBreak(yPosition, 24);
      }
      renderedStructured = true;
    }

    // If structured single-day program exists, render a table; otherwise fallback to legacy text
    if (!renderedStructured && includeStructured && eventData.programSchedule && eventData.programSchedule.length > 0) {
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
        ...hojaTable(hojaGeometry(this.pdfDoc.document), {
          numericColumns: [0],
          weights: PROGRAM_TABLE_WEIGHTS,
        }),
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 12;
      renderedStructured = true;
    }

    this.pdfDoc.setText(10, [51, 51, 51]);
    if (includeScheduleText && DataValidators.hasData(eventData.schedule)) {
      if (renderedStructured) {
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 18);
        this.pdfDoc.setText(12, HOJA_HEADING);
        this.pdfDoc.addText("Programa (Texto Libre)", HOJA_LEFT, yPosition);
        yPosition += 10;
        this.pdfDoc.setText(10, [51, 51, 51]);
      }

      const lineHeight = 6;
      const scheduleLines = eventData.schedule!
        .split(/\r?\n/)
        .flatMap((line) => this.pdfDoc.splitText(line.trimEnd(), 160));

      for (const line of scheduleLines) {
        yPosition = this.pdfDoc.checkPageBreak(yPosition, lineHeight + 2);
        this.pdfDoc.addText(line, HOJA_INDENT, yPosition);
        yPosition += lineHeight;
      }
      return yPosition + 6;
    }

    return yPosition;
  }
}
