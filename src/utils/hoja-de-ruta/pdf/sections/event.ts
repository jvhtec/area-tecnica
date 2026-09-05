import { PDFDocument } from '../core/pdf-document';
import { HOJA_HEADING, HOJA_LABEL, HOJA_LEFT, HOJA_RIGHT_INSET } from '../hoja-report-system';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class EventSection {
  constructor(private pdfDoc: PDFDocument) {}

  addEventDetailsSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, HOJA_HEADING);
    this.pdfDoc.addText("Detalles del Evento", HOJA_LEFT, yPosition);
    yPosition += 15;
    
    this.pdfDoc.setText(10, [51, 51, 51]);
    
    const details = [
      ['Evento', eventData.eventName],
      ['Fechas', eventData.eventDates],
      ['Hora Inicio', eventData.eventStartTime],
      ['Hora Fin', eventData.eventEndTime],
      ['Asistentes Estimados', eventData.estimatedAttendees?.toString()],
      ['Estado', eventData.eventStatus]
    ].filter(([, value]) => DataValidators.hasData(value));

    if (details.length > 0) {
      this.pdfDoc.addTable({
        startY: yPosition,
        body: details,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', textColor: HOJA_LABEL },
          1: { cellWidth: 120 }
        },
        margin: { left: HOJA_LEFT, right: HOJA_RIGHT_INSET },
        tableWidth: 'auto'
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 15;
    }
    
    return yPosition;
  }
}
