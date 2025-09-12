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

    // Background
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(0, 0, pageWidth, pageHeight, 'F');
    
    // Decorative elements
    this.pdfDoc.document.setFillColor(255, 255, 255, 0.1);
    this.pdfDoc.document.circle(pageWidth - 30, 30, 50, 'F');
    this.pdfDoc.document.circle(30, pageHeight - 50, 40, 'F');

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
        const MAX_H = 60;
        const MAX_W = 200;
        const scale = Math.min(MAX_H / dims.height, MAX_W / dims.width);
        const drawW = Math.max(1, Math.round(dims.width * scale));
        const drawH = Math.max(1, Math.round(dims.height * scale));
        // Position above the main title (which sits around pageHeight/2 - 20)
        const titleY = pageHeight / 2 - 20;
        const gap = 16; // space between logo and title
        const yPos = Math.max(40, titleY - gap - drawH);
        const xPos = (pageWidth - drawW) / 2;
        const format = this.logoData.includes('data:image/png') ? 'PNG' : this.logoData.includes('data:image/jpeg') ? 'JPEG' : 'PNG';
        this.pdfDoc.addImage(this.logoData, format, xPos, yPos, drawW, drawH);
      } catch (error) {
        console.error("Error adding logo to cover:", error);
        // Add fallback text
        this.pdfDoc.setText(12, [255, 255, 255]);
        this.pdfDoc.addText('[LOGO MISSING]', pageWidth / 2, pageHeight - 150, { align: 'center' });
      }
    }

    // Main title
    this.pdfDoc.setText(36, [255, 255, 255]);
    const titleY = pageHeight / 2 - 20;
    this.pdfDoc.addText('HOJA DE RUTA', pageWidth / 2, titleY, { align: 'center' });

    // Event name (wrapped to fit margins)
    const eventName = this.eventData.eventName || this.jobTitle || 'Evento sin título';
    this.pdfDoc.setText(24, [255, 255, 255]);
    const sideMargin = 30; // 30pt margins on both sides
    const maxTextWidth = pageWidth - sideMargin * 2;
    const nameStartY = pageHeight / 2 + 20;
    const linesUsed = this.pdfDoc.addWrappedText(eventName, pageWidth / 2, nameStartY, maxTextWidth, 12, 'center');

    // Date - use event dates if available, otherwise current date (placed after wrapped name)
    this.pdfDoc.setText(14, [255, 255, 255]);
    const displayDate = this.eventData.eventDates || new Date().toLocaleDateString('es-ES');
    const dateY = nameStartY + linesUsed * 12 + 10; // add small gap after name block
    this.pdfDoc.addText(displayDate, pageWidth / 2, dateY, { align: 'center' });

    // Client info
    if (this.eventData.clientName) {
      this.pdfDoc.setText(16, [255, 255, 255]);
      this.pdfDoc.addText(`Cliente: ${this.eventData.clientName}`, pageWidth / 2, pageHeight - 80, { align: 'center' });
    }
  }
}
