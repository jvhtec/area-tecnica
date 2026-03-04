import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class AuxNeedsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addAuxNeedsSection(eventData: EventData, yPosition: number): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    this.pdfDoc.setText(10, [51, 51, 51]);

    if (!DataValidators.hasData(eventData.auxiliaryNeeds)) {
      return yPosition;
    }

    const lineHeight = 6;
    const auxLines = eventData.auxiliaryNeeds!
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of auxLines) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, lineHeight + 2);
      this.pdfDoc.addText(line, 30, yPosition);
      yPosition += lineHeight;
    }

    return yPosition + 6;
  }
}
