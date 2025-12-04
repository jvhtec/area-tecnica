import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';

export class CoverSection {
  constructor(
    private pdfDoc: PDFDocument,
    private eventData: EventData,
    private jobTitle: string,
    private logoData?: string
  ) {}

  async generateCoverPage(): Promise<void> {
    const { width: pageWidth, height: pageHeight } = this.pdfDoc.dimensions;

    // Main background - deep burgundy
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(0, 0, pageWidth, pageHeight, 'F');
    
    // Gradient-like effect - darker strip at top
    this.pdfDoc.setFillColor(95, 0, 0);
    this.pdfDoc.addRect(0, 0, pageWidth, 60, 'F');
    
    // Gradient-like effect - darker strip at bottom
    this.pdfDoc.setFillColor(95, 0, 0);
    this.pdfDoc.addRect(0, pageHeight - 50, pageWidth, 50, 'F');
    
    // Decorative corner circles (light burgundy for subtle effect)
    this.pdfDoc.document.setFillColor(145, 30, 30);
    this.pdfDoc.document.circle(pageWidth - 20, 20, 80, 'F');
    this.pdfDoc.document.circle(20, pageHeight - 30, 60, 'F');

    // White border frame
    this.pdfDoc.document.setDrawColor(255, 255, 255);
    this.pdfDoc.document.setLineWidth(0.5);
    this.pdfDoc.document.rect(15, 15, pageWidth - 30, pageHeight - 30);

    // Job logo on cover (scaled with aspect ratio, placed above the main title text)
    if (this.logoData) {
      try {
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          };
          img.onerror = () => resolve({ width: 120, height: 40 });
          img.src = this.logoData!;
        });
        const MAX_H = 70;
        const MAX_W = 220;
        const scale = Math.min(MAX_H / dims.height, MAX_W / dims.width);
        const drawW = Math.max(1, Math.round(dims.width * scale));
        const drawH = Math.max(1, Math.round(dims.height * scale));
        // Position above the main title (which sits around pageHeight/2 - 20)
        const titleY = pageHeight / 2 - 30;
        const gap = 20; // space between logo and title
        const yPos = Math.max(80, titleY - gap - drawH);
        const xPos = (pageWidth - drawW) / 2;
        const format = this.logoData.includes('data:image/png') ? 'PNG' : this.logoData.includes('data:image/jpeg') ? 'JPEG' : 'PNG';
        this.pdfDoc.addImage(this.logoData, format, xPos, yPos, drawW, drawH);
      } catch (error) {
        console.error("Error adding logo to cover:", error);
      }
    }

    // Main title - larger and bolder
    this.pdfDoc.setText(42, [255, 255, 255]);
    const titleY = pageHeight / 2 - 20;
    this.pdfDoc.addText('HOJA DE RUTA', pageWidth / 2, titleY, { align: 'center' });

    // Decorative line under title
    this.pdfDoc.setFillColor(255, 255, 255);
    const lineWidth = 80;
    this.pdfDoc.addRect((pageWidth - lineWidth) / 2, titleY + 8, lineWidth, 1.5, 'F');

    // Event name (wrapped to fit margins) - slightly larger
    const eventName = this.eventData.eventName || this.jobTitle || 'Evento sin título';
    this.pdfDoc.setText(26, [255, 255, 255]);
    const sideMargin = 35;
    const maxTextWidth = pageWidth - sideMargin * 2;
    const nameStartY = pageHeight / 2 + 30;
    const linesUsed = this.pdfDoc.addWrappedText(eventName, pageWidth / 2, nameStartY, maxTextWidth, 14, 'center');

    // Date - use event dates if available, otherwise current date
    this.pdfDoc.setText(14, [255, 255, 255]);
    const displayDate = this.eventData.eventDates || new Date().toLocaleDateString('es-ES');
    const dateY = nameStartY + linesUsed * 14 + 15;
    this.pdfDoc.addText(displayDate, pageWidth / 2, dateY, { align: 'center' });

    // Client info at bottom (slightly darker background for subtle effect)
    if (this.eventData.clientName) {
      const boxY = pageHeight - 90;
      this.pdfDoc.setFillColor(105, 0, 0);
      this.pdfDoc.addRect(40, boxY - 5, pageWidth - 80, 25, 'F');
      
      this.pdfDoc.setText(14, [255, 255, 255]);
      this.pdfDoc.addText(`Cliente: ${this.eventData.clientName}`, pageWidth / 2, boxY + 8, { align: 'center' });
    }
  }
}

