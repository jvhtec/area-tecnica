import { PDFDocument } from '../core/pdf-document';

export class HeaderSection {
  constructor(private pdfDoc: PDFDocument) {}

  addSectionHeader(title: string, yPosition: number = 75): number {
    // Ensure we're on a new page and start with proper spacing
    this.pdfDoc.addPage();
    
    this.pdfDoc.setText(16, [125, 1, 1]);
    this.pdfDoc.addText(title, 20, yPosition);
    
    // Add a separator line
    const { width: pageWidth } = this.pdfDoc.dimensions;
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(20, yPosition + 5, pageWidth - 40, 1, 'F');
    
    return yPosition + 25;
  }

  addPageHeader(title: string, yPosition: number = 75): number {
    // Add section header without starting a new page
    this.pdfDoc.setText(16, [125, 1, 1]);
    this.pdfDoc.addText(title, 20, yPosition);
    
    // Add a separator line
    const { width: pageWidth } = this.pdfDoc.dimensions;
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(20, yPosition + 5, pageWidth - 40, 1, 'F');
    
    return yPosition + 25;
  }
}