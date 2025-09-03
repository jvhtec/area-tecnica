import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class EventSection {
  constructor(private pdfDoc: PDFDocument) {}

  addEventDetailsSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Detalles del Evento", 20, yPosition);
    yPosition += 15;
    
    this.pdfDoc.setText(10, [51, 51, 51]);
    
    const details = [
      ['Evento', eventData.eventName],
      ['Fechas', eventData.eventDates],
      ['Cliente', eventData.clientName],
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
          0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 140 }
        }
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 15;
    }
    
    return yPosition;
  }
}