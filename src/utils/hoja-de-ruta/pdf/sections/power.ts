import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class PowerSection {
  constructor(private pdfDoc: PDFDocument) {}

  addPowerSection(eventData: EventData, yPosition: number): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    this.pdfDoc.setText(10, [51, 51, 51]);

    if (!DataValidators.hasData(eventData.powerRequirements)) {
      return yPosition;
    }

    const powerLines = eventData.powerRequirements!.split('\n');
    for (const line of powerLines) {
      if (line.trim()) {
        this.pdfDoc.addText(line.trim(), 30, yPosition);
        yPosition += 5;
      }
    }

    return yPosition + 10;
  }
}
