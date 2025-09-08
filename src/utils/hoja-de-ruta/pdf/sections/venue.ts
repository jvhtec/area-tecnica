import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';
import { DEPARTURE_ADDRESS } from '../constants';

export class VenueSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addVenueSection(eventData: EventData, venueMapPreview: string | null, yPosition: number): Promise<number> {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Venue", 20, yPosition);
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
      yPosition = this.pdfDoc.getLastAutoTableY() + 15;
    }

    // Add venue images if available
    if (eventData.venue?.images && eventData.venue.images.length > 0) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 80);
      
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Imágenes del Venue", 20, yPosition);
      yPosition += 15;

      try {
        // Show up to 2 venue images side by side
        const imagesToShow = eventData.venue.images.slice(0, 2);
        let xPosition = 20;
        
        for (const image of imagesToShow) {
          try {
            // For now, just show placeholder - actual image loading would need signed URLs
            this.pdfDoc.setText(8, [51, 51, 51]);
            this.pdfDoc.addText(`[VENUE IMAGE: ${image.image_type}]`, xPosition, yPosition);
            xPosition += 90;
          } catch (error) {
            console.error("Error adding venue image:", error);
          }
        }
        yPosition += 20;
      } catch (error) {
        console.error("Error processing venue images:", error);
      }
    }

    // Add map preview and QR code if venue has address
    if (eventData.venue?.address) {
      let mapDataUrl = venueMapPreview;
      
      if (!mapDataUrl) {
        try {
          const coords = await MapService.geocodeAddress(eventData.venue.address);
          if (coords) {
            mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng, 400, 200);
          }
        } catch (error) {
          console.error('Error generating venue map:', error);
        }
      }

      yPosition = this.pdfDoc.checkPageBreak(yPosition, 120);

      if (mapDataUrl) {
        try {
          this.pdfDoc.addImage(mapDataUrl, 'PNG', 20, yPosition, 100, 60);
        } catch (error) {
          console.error("Error adding venue map:", error);
          this.pdfDoc.addText('[MAP NOT AVAILABLE]', 20, yPosition);
        }
      } else {
        this.pdfDoc.addText('[MAP NOT AVAILABLE]', 20, yPosition);
      }

      // Add QR code for directions
      try {
        const routeUrl = MapService.generateRouteUrl(
          DEPARTURE_ADDRESS, // Sector-Pro warehouse
          eventData.venue.address
        );
        const qrData = await QRService.generateQRCode(routeUrl);
        this.pdfDoc.addImage(qrData, 'PNG', 130, yPosition, 50, 50);
        
        this.pdfDoc.setText(8, [51, 51, 51]);
        this.pdfDoc.addText('Escanea para direcciones', 130, yPosition + 55);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }

      yPosition += 80;
    }

    return yPosition;
  }
}