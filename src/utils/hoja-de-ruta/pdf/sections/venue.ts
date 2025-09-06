import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';
import { DEPARTURE_ADDRESS } from '../constants';

export class VenueSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addVenueSection(eventData: EventData, venueMapPreview: string | null, yPosition: number): Promise<number> {
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

    // Add venue map and route QR
    const venueAddress = eventData.venue?.address;
    let mapDataUrl = venueMapPreview;

    // Generate map if not provided and address exists
    if (!mapDataUrl && venueAddress) {
      try {
        const coords = await MapService.geocodeAddress(venueAddress);
        if (coords) {
          mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng, 160, 80);
        }
      } catch (error) {
        console.error("Error generating venue map:", error);
      }
    }

    if (mapDataUrl && venueAddress) {
      try {
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 100);
        
        // Add map
        const mapWidth = 160;
        const mapHeight = 80;
        this.pdfDoc.addImage(mapDataUrl, "JPEG", 20, yPosition, mapWidth, mapHeight);
        
        // Generate and add route QR
        const routeUrl = MapService.generateRouteUrl(DEPARTURE_ADDRESS, venueAddress);
        const qrCode = await QRService.generateQRCode(routeUrl);
        this.pdfDoc.addImage(qrCode, "PNG", mapWidth + 30, yPosition, 50, 50);
        
        // Add QR info text
        this.pdfDoc.setText(8, [80, 80, 80]);
        this.pdfDoc.addText("Ruta al lugar", mapWidth + 30, yPosition + 55);
        
        yPosition += mapHeight + 15;
      } catch (error) {
        console.error("Error generating venue map:", error);
        // Add placeholders for failed map/QR generation
        this.pdfDoc.setText(10, [128, 128, 128]);
        this.pdfDoc.addText("[MAP NOT AVAILABLE]", 20, yPosition);
        this.pdfDoc.addText("[QR NOT AVAILABLE]", 190, yPosition);
        yPosition += 25;
      }
    }
    
    return yPosition;
  }
}