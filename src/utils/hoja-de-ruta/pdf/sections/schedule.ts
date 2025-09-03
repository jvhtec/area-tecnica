import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class ScheduleSection {
  constructor(private pdfDoc: PDFDocument) {}

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
      const scheduleLines = eventData.schedule!.split('\n');
      for (const line of scheduleLines) {
        this.pdfDoc.addText(line, 35, yPosition);
        yPosition += 8;
      }
      yPosition += 10;
    }

    if (DataValidators.hasData(eventData.powerRequirements)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Requerimientos de Energía:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      const powerLines = eventData.powerRequirements!.split('\n');
      for (const line of powerLines) {
        this.pdfDoc.addText(line, 35, yPosition);
        yPosition += 8;
      }
      yPosition += 10;
    }

    if (DataValidators.hasData(eventData.auxiliaryNeeds)) {
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Necesidades Auxiliares:", 30, yPosition);
      yPosition += 12;
      
      this.pdfDoc.setText(10, [51, 51, 51]);
      const auxLines = eventData.auxiliaryNeeds!.split('\n');
      for (const line of auxLines) {
        this.pdfDoc.addText(line, 35, yPosition);
        yPosition += 8;
      }
    }

    return yPosition;
  }
}