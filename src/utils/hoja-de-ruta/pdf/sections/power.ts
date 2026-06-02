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

    return this.pdfDoc.addWrappedLines(eventData.powerRequirements!, 30, yPosition, {
      lineHeight: 5,
    }) + 10;
  }
}
