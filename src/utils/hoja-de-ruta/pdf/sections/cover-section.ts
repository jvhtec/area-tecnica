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
        const logoHeight = 60;
        const logoWidth = 120; // Default width
        // Detect image format from data URL
        const format = this.logoData.includes('data:image/png') ? 'PNG' : 
                      this.logoData.includes('data:image/jpeg') ? 'JPEG' : 'PNG';
        this.pdfDoc.addImage(this.logoData, format, (pageWidth - logoWidth) / 2, pageHeight - 180, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding logo to cover:", error);
        // Add fallback text
        this.pdfDoc.setText(12, [255, 255, 255]);
        this.pdfDoc.addText('[LOGO MISSING]', pageWidth / 2, pageHeight - 150, { align: 'center' });
      }
    }

    // Main title
    this.pdfDoc.setText(36, [255, 255, 255]);
    this.pdfDoc.addText('HOJA DE RUTA', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

    // Event name
    this.pdfDoc.setText(24, [255, 255, 255]);
    this.pdfDoc.addText(this.eventData.eventName || this.jobTitle || 'Evento sin título', pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

    // Date - use event dates if available, otherwise current date
    this.pdfDoc.setText(14, [255, 255, 255]);
    const displayDate = this.eventData.eventDates || new Date().toLocaleDateString('es-ES');
    this.pdfDoc.addText(displayDate, pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

    // Client info
    if (this.eventData.clientName) {
      this.pdfDoc.setText(16, [255, 255, 255]);
      this.pdfDoc.addText(`Cliente: ${this.eventData.clientName}`, pageWidth / 2, pageHeight - 80, { align: 'center' });
    }
  }
}