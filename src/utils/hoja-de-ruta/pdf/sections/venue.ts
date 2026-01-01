import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { MapService } from '../services/map-service';
import { PlacesImageService } from '../services/places-image-service';
import { QRService } from '../services/qr-service';

export class VenueSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addVenueSection(
    eventData: EventData,
    venueMapPreview: string | null,
    yPosition: number,
    venueImagePreviews?: string[]
  ): Promise<number> {
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
          0: { cellWidth: 50, fontStyle: 'bold', textColor: [125, 1, 1] },
          1: { cellWidth: 120 }
        },
        margin: { left: 20, right: 20 },
        tableWidth: 'auto'
      });
      yPosition = this.pdfDoc.getLastAutoTableY() + 15;
    }

    // Add venue images: ONLY use manually uploaded previews (no auto-fetch to avoid €15/month API costs)
    let imagesToRender: string[] = [];
    if (venueImagePreviews && venueImagePreviews.length > 0) {
      imagesToRender = venueImagePreviews.slice(0, 2);
    }
    // DISABLED: Auto-fetch from Google Places API to keep costs at €0
    // else if (eventData.venue?.name || eventData.venue?.address) {
    //   const q = eventData.venue?.name || eventData.venue?.address || '';
    //   imagesToRender = await PlacesImageService.getPhotosForQuery(q, 1, 500, 300);
    // }

    if (imagesToRender.length > 0) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 90);
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Imágenes del Venue", 20, yPosition);
      yPosition += 12;

      const leftMargin = 20;
      const rightMargin = 20;
      const gap = 10;
      const { width: pageWidth } = this.pdfDoc.dimensions;
      const availableWidth = pageWidth - leftMargin - rightMargin;
      const maxPerImage = Math.floor((availableWidth - gap) / 2);
      const imgHeight = 60;
      let x = leftMargin;
      for (const dataUrl of imagesToRender) {
        try {
          this.pdfDoc.addImage(dataUrl, 'JPEG', x, yPosition, maxPerImage, imgHeight);
        } catch (e) {
          try {
            this.pdfDoc.addImage(dataUrl, 'PNG', x, yPosition, maxPerImage, imgHeight);
          } catch (err) {
            console.error('Error adding venue image preview:', err);
          }
        }
        // Optional border for images
        this.pdfDoc.document.setDrawColor(210, 210, 210);
        this.pdfDoc.document.setLineWidth(0.3);
        this.pdfDoc.document.rect(x, yPosition, maxPerImage, imgHeight);
        x += maxPerImage + gap;
      }
      yPosition += imgHeight + 10;
    }

    // Add map and QR (generate map via geocoding; fall back to passed preview)
    if (eventData.venue?.address) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 120);

      const leftMargin = 20;
      const rightMargin = 20;
      const gap = 10;
      const mapHeight = 60;
      const qrSize = 50;
      const { width: pageWidth } = this.pdfDoc.dimensions;
      const availableWidth = pageWidth - leftMargin - rightMargin;
      const desiredMapWidth = 100;
      const sideBySide = availableWidth >= (desiredMapWidth + gap + qrSize);
      const mapW = sideBySide ? desiredMapWidth : availableWidth;
      const mapX = leftMargin;
      const mapY = yPosition;
      const qrX = sideBySide ? Math.min(leftMargin + mapW + gap, pageWidth - rightMargin - qrSize) : leftMargin;
      const qrY = sideBySide ? yPosition : (yPosition + mapHeight + 10);

      let mapDataUrl: string | null = null;
      try {
        mapDataUrl = await MapService.getMapImageForAddress(eventData.venue.address, mapW, mapHeight);
      } catch (e) {
        console.warn('Venue map fetch failed, will fallback to preview:', e);
      }
      if (!mapDataUrl && venueMapPreview) {
        mapDataUrl = venueMapPreview;
      }

      if (mapDataUrl) {
        try {
          this.pdfDoc.addImage(mapDataUrl, 'PNG', mapX, mapY, mapW, mapHeight);
        } catch (errPng) {
          try {
            this.pdfDoc.addImage(mapDataUrl, 'JPEG', mapX, mapY, mapW, mapHeight);
          } catch (err) {
            console.error('Error adding venue map:', err);
            this.pdfDoc.addText('[MAPA NO DISPONIBLE]', mapX, mapY + mapHeight / 2);
          }
        }
        // Add border around the map
        this.pdfDoc.document.setDrawColor(200, 200, 200);
        this.pdfDoc.document.setLineWidth(0.3);
        this.pdfDoc.document.rect(mapX, mapY, mapW, mapHeight);
      } else {
        this.pdfDoc.addText('[MAPA NO DISPONIBLE]', mapX, mapY + mapHeight / 2);
      }

      // Add QR code for directions (destination-only so device uses current location)
      try {
        const destUrl = MapService.generateDestinationUrl(eventData.venue.address);
        const qrData = await QRService.generateQRCode(destUrl);
        this.pdfDoc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
        
        // Make QR code clickable
        this.pdfDoc.addLink(destUrl, qrX, qrY, qrSize, qrSize);
        
        this.pdfDoc.setText(8, [51, 51, 51]);
        this.pdfDoc.addText('Escanea para direcciones', qrX, qrY + qrSize + 6);
      } catch (error) {
        console.error('Error generating venue QR:', error);
      }

      const blockBottom = sideBySide ? Math.max(mapY + mapHeight, qrY + qrSize) : (qrY + qrSize);
      yPosition = blockBottom + 15;
    }

    return yPosition;
  }
}
