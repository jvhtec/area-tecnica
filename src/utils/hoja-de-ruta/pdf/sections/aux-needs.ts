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

    const auxLines = eventData.auxiliaryNeeds!.split('\n');
    for (const line of auxLines) {
      if (line.trim()) {
        this.pdfDoc.addText(line.trim(), 30, yPosition);
        yPosition += 12;
      }
    }

    return yPosition + 10;
  }
}
