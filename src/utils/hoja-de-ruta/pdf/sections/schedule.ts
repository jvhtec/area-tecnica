import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class ScheduleSection {
  constructor(private pdfDoc: PDFDocument) {}

  private addWrappedLines(text: string, startX: number, yPosition: number, lineHeight = 6): number {
    const lines = text
      .split(/\r?\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed) return [''];
        return this.pdfDoc.splitText(trimmed, 160);
      });

    for (const line of lines) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, lineHeight + 2);
      this.pdfDoc.addText(line, startX, yPosition);
      yPosition += lineHeight;
    }

    return yPosition;
  }

  addScheduleSection(eventData: EventData, yPosition: number): number {
    if (!DataValidators.hasData(eventData.schedule) && 
        !DataValidators.hasData(eventData.powerRequirements) && 
        !DataValidators.hasData(eventData.auxiliaryNeeds)) {
      return yPosition;
    }

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Programa y Requerimientos", 20, yPosition);
    yPosition += 15;

    this.pdfDoc.setText(10, [51, 51, 51]);

    if (DataValidators.hasData(eventData.schedule)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Programa:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      yPosition = this.addWrappedLines(eventData.schedule!, 35, yPosition);
      yPosition += 10;
    }

    if (DataValidators.hasData(eventData.powerRequirements)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Requerimientos de Energía:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      yPosition = this.addWrappedLines(eventData.powerRequirements!, 35, yPosition);
      yPosition += 10;
    }

    if (DataValidators.hasData(eventData.auxiliaryNeeds)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Necesidades Auxiliares:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      yPosition = this.addWrappedLines(eventData.auxiliaryNeeds!, 35, yPosition);
    }

    return yPosition;
  }
}
