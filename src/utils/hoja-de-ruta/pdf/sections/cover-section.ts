import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';

export class CoverSection {
  constructor(
    private pdfDoc: PDFDocument,
    private eventData: EventData,
    private jobTitle: string,
    private logoData?: string
  ) {}

  generateCoverPage(): void {
    const { width: pageWidth, height: pageHeight } = this.pdfDoc.dimensions;

    // Background
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(0, 0, pageWidth, pageHeight, 'F');
    
    // Decorative elements
    this.pdfDoc.document.setFillColor(255, 255, 255, 0.1);
    this.pdfDoc.document.circle(pageWidth - 30, 30, 50, 'F');
    this.pdfDoc.document.circle(30, pageHeight - 50, 40, 'F');

    // Job logo on cover
    if (this.logoData) {
      try {
        const logoImg = new Image();
        logoImg.src = this.logoData;
        const logoHeight = 60;
        const logoWidth = logoHeight * (logoImg.width / logoImg.height) || 120;
        this.pdfDoc.addImage(this.logoData, 'PNG', (pageWidth - logoWidth) / 2, 40, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding logo to cover:", error);
      }
    }

    // Main title
    this.pdfDoc.setText(36, [255, 255, 255]);
    this.pdfDoc.addText('HOJA DE RUTA', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

    // Event name
    this.pdfDoc.setText(24, [255, 255, 255]);
    this.pdfDoc.addText(this.eventData.eventName || this.jobTitle || 'Evento sin título', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

    // Date
    this.pdfDoc.setText(14, [255, 255, 255]);
    this.pdfDoc.addText(new Date().toLocaleDateString('es-ES'), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

    // Client info
    if (this.eventData.clientName) {
      this.pdfDoc.setText(16, [255, 255, 255]);
      this.pdfDoc.addText(`Cliente: ${this.eventData.clientName}`, pageWidth / 2, pageHeight - 80, { align: 'center' });
    }
  }
}