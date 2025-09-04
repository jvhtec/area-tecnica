import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export class HeaderSection {
  constructor(
    private pdfDoc: PDFDocument,
    private eventData: EventData,
    private jobTitle: string,
    private logoData?: string
  ) {}

  addHeader(pageTitle?: string): void {
    const { width: pageWidth } = this.pdfDoc.dimensions;
    
    // Main header background
    this.pdfDoc.setFillColor(125, 1, 1);
    this.pdfDoc.addRect(0, 0, pageWidth, 45, 'F');
    
    // Status indicator
    if (this.eventData.eventStatus) {
      const statusColors = {
        draft: [255, 193, 7],
        confirmed: [40, 167, 69],
        cancelled: [220, 53, 69],
        completed: [108, 117, 125]
      };
      const color = statusColors[this.eventData.eventStatus] || [128, 128, 128];
      this.pdfDoc.setFillColor(color[0], color[1], color[2]);
      this.pdfDoc.document.roundedRect(pageWidth - 65, 5, 55, 10, 2, 2, 'F');
      
      this.pdfDoc.setText(8, [255, 255, 255]);
      this.pdfDoc.addText(this.eventData.eventStatus.toUpperCase(), pageWidth - 37.5, 11, { align: 'center' });
    }

    // Job logo
    if (this.logoData) {
      try {
        const logoImg = new Image();
        logoImg.src = this.logoData;
        const logoHeight = 24;
        const logoWidth = logoHeight * (logoImg.width / logoImg.height) || 48;
        this.pdfDoc.addImage(this.logoData, 'PNG', 15, 10, logoWidth, logoHeight);
      } catch (error) {
        console.error("Error adding logo to header:", error);
      }
    }

    // Header text - White text on red background
    this.pdfDoc.setText(16, [255, 255, 255]);
    this.pdfDoc.addText(pageTitle || 'HOJA DE RUTA', pageWidth / 2, 18, { align: 'center' });

    this.pdfDoc.setText(12, [255, 255, 255]);
    this.pdfDoc.addText(this.eventData.eventName || this.jobTitle, pageWidth / 2, 28, { align: 'center' });

    this.pdfDoc.setText(10, [255, 255, 255]);
    const jobDateStr = format(new Date(), 'dd/MM/yyyy', { locale: es });
    this.pdfDoc.addText(jobDateStr, pageWidth / 2, 36, { align: 'center' });
  }

  addSectionHeader(title: string, yPosition: number): number {
    const { width: pageWidth } = this.pdfDoc.dimensions;
    
    this.pdfDoc.setFillColor(248, 249, 250);
    this.pdfDoc.addRect(14, yPosition - 5, pageWidth - 28, 15, 'F');
    
    this.pdfDoc.document.setDrawColor(125, 1, 1);
    this.pdfDoc.document.setLineWidth(0.8);
    this.pdfDoc.document.line(14, yPosition - 5, pageWidth - 14, yPosition - 5);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText(title, 20, yPosition + 4);
    
    return yPosition + 20;
  }
}