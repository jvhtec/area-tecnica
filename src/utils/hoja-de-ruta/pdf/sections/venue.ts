import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';

export class VenueSection {
  constructor(private pdfDoc: PDFDocument) {}

  addVenueSection(eventData: EventData, venueMapPreview: string | null, yPosition: number): number {
    if (!DataValidators.hasData(eventData.venue?.name) && !DataValidators.hasData(eventData.venue?.address)) {
      return yPosition;
    }

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Información del Lugar", 20, yPosition);
    yPosition += 15;
    
    this.pdfDoc.setText(10, [51, 51, 51]);
    
    const venueDetails = [
      ['Nombre', eventData.venue?.name],
      ['Dirección', eventData.venue?.address],
      ['Tipo', eventData.venueType],
      ['Capacidad', eventData.venueCapacity?.toString()]
    ].filter(([, value]) => DataValidators.hasData(value));

    if (venueDetails.length > 0) {
      this.pdfDoc.addTable({
        startY: yPosition,
        body: venueDetails,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 140 }
        }
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 10;
    }

    // Add venue map if available
    if (venueMapPreview) {
      try {
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 80);
        const mapWidth = 120;
        const mapHeight = 80;
        this.pdfDoc.addImage(venueMapPreview, "JPEG", 30, yPosition, mapWidth, mapHeight);
        yPosition += mapHeight + 15;
      } catch (error) {
        console.error("Error adding venue map to PDF:", error);
      }
    }
    
    return yPosition;
  }
}