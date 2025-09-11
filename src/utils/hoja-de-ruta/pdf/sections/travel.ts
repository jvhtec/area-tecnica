import { PDFDocument } from '../core/pdf-document';
import { TravelArrangement } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';

export class TravelSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addTravelSection(
    travelArrangements: TravelArrangement[],
    yPosition: number,
    eventVenueAddress?: string
  ): Promise<number> {
    const validTravelArrangements = travelArrangements.filter(DataValidators.hasMeaningfulTravelData);

    if (validTravelArrangements.length === 0) return yPosition;

    // Start directly after section header; no extra subtitle here
    yPosition = this.pdfDoc.checkPageBreak(yPosition);

    for (const arrangement of validTravelArrangements) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 120);
      
      // Travel arrangement header
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText(`Transporte: ${Formatters.translateTransportType(arrangement.transportation_type)}`, 30, yPosition);
      yPosition += 15;

      // Travel details table
      const travelData = [
        ['Recogida', arrangement.pickup_address],
        ['Hora Recogida', Formatters.formatTime(arrangement.pickup_time || '')],
        ['Hora Salida', Formatters.formatTime(arrangement.departure_time || '')],
        ['Hora Llegada', Formatters.formatTime(arrangement.arrival_time || '')],
        ['Vuelo/Tren', arrangement.flight_train_number],
        ['Compañía', arrangement.company],
        ['Conductor', arrangement.driver_name],
        ['Teléfono', Formatters.formatPhone(arrangement.driver_phone || '')],
        ['Matrícula', arrangement.plate_number],
        ['Notas', arrangement.notes]
      ].filter(([, value]) => DataValidators.hasData(value));

      if (travelData.length > 0) {
        this.pdfDoc.addTable({
          startY: yPosition,
          body: travelData,
          theme: "plain",
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold', textColor: [125, 1, 1] },
            1: { cellWidth: 120 }
          },
          margin: { left: 20, right: 20 },
          tableWidth: 'auto'
        });
        yPosition = this.pdfDoc.getLastAutoTableY() + 10;
      }

      // Add pickup map and QR if address is provided and different from venue address
      if (arrangement.pickup_address) {
        const pickup = arrangement.pickup_address?.trim().toLowerCase();
        const venue = eventVenueAddress?.trim().toLowerCase();
        const isSameAsVenue = pickup && venue ? pickup === venue : false;

        if (isSameAsVenue) {
          // Show a small note to indicate it's the same as the venue to avoid duplication
          this.pdfDoc.setText(9, [125, 125, 125]);
          this.pdfDoc.addText('Mapa/QR igual que el del venue', 25, yPosition + 10);
          yPosition += 20;
        } else {
          await this.addPickupMapAndQR(arrangement.pickup_address, yPosition);
          yPosition += 100; // Account for map and QR space
        }
      }
    }
    
    return yPosition;
  }

  private async addPickupMapAndQR(pickupAddress: string, yPosition: number): Promise<void> {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 100);

    this.pdfDoc.setText(11, [125, 1, 1]);
    this.pdfDoc.addText('Mapa de Recogida:', 20, yPosition);
    yPosition += 10;

    const desiredMapWidth = 160;
    const mapHeight = 80;
    const qrSize = 50;
    const gap = 10;
    const leftMargin = 20;
    const rightMargin = 20;
    const { width: pageWidth } = this.pdfDoc.dimensions;

    const availableWidth = pageWidth - leftMargin - rightMargin;
    const sideBySide = availableWidth >= (desiredMapWidth + gap + qrSize);

    let mapX = leftMargin;
    let mapY = yPosition;
    let mapWidth = desiredMapWidth;
    let qrX = leftMargin + desiredMapWidth + gap;
    let qrY = yPosition;

    if (!sideBySide) {
      // Stack vertically: full-width map, QR below
      mapWidth = availableWidth;
      mapX = leftMargin;
      mapY = yPosition;
      qrX = leftMargin;
      qrY = yPosition + mapHeight + 10;
    } else {
      // Side-by-side: ensure QR fits within right margin
      mapWidth = desiredMapWidth;
      qrX = Math.min(leftMargin + mapWidth + gap, pageWidth - rightMargin - qrSize);
      qrY = yPosition;
    }

    let mapAdded = false;
    try {
      // Try to geocode and add static OSM map
      const coords = await MapService.geocodeAddress(pickupAddress);
      if (coords) {
        const mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng, mapWidth, mapHeight);
        if (mapDataUrl) {
          this.pdfDoc.addImage(mapDataUrl, 'JPEG', mapX, mapY, mapWidth, mapHeight);
          mapAdded = true;
        }
      }
    } catch (error) {
      console.error('Error adding pickup map:', error);
    }

    if (!mapAdded) {
      // Fallback placeholder within margins
      this.pdfDoc.setText(10, [125, 1, 1]);
      this.pdfDoc.addText('[MAPA NO DISPONIBLE]', mapX + 5, mapY + mapHeight / 2);
    }

    // Always generate QR to Google Maps destination (device uses current location as origin)
    try {
      const pickupUrl = MapService.generateDestinationUrl(pickupAddress);
      const pickupQrDataUrl = await QRService.generateQRCode(pickupUrl);
      if (pickupQrDataUrl) {
        this.pdfDoc.addImage(pickupQrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        // Caption below QR (kept simple to avoid overflow)
        this.pdfDoc.setText(9, [125, 1, 1]);
        this.pdfDoc.addText('Ruta a Recogida', qrX, qrY + qrSize + 6);
        this.pdfDoc.setText(8, [51, 51, 51]);
        this.pdfDoc.addText('Escanea para direcciones', qrX, qrY + qrSize + 12);
      }
    } catch (qrError) {
      console.error('Error generating pickup QR:', qrError);
    }
  }
}
