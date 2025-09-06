import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class ProgramSection {
  constructor(private pdfDoc: PDFDocument) {}

  addProgramSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Programa", 20, yPosition);
    yPosition += 15;

    this.pdfDoc.setText(10, [51, 51, 51]);

    if (DataValidators.hasData(eventData.schedule)) {
      const scheduleLines = eventData.schedule!.split('\n');
      for (const line of scheduleLines) {
        if (line.trim()) {
          this.pdfDoc.addText(line.trim(), 30, yPosition);
          yPosition += 12;
        }
      }
    } else {
      // Show placeholder
      this.pdfDoc.setText(10, [128, 128, 128]);
      this.pdfDoc.addText("No hay programa especificado", 30, yPosition);
      yPosition += 15;
    }

    return yPosition + 10;
  }
}