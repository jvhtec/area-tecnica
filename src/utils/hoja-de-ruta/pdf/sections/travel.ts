import { PDFDocument } from '../core/pdf-document';
import { TravelArrangement } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';
import { DEPARTURE_ADDRESS } from '../constants';

export class TravelSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addTravelSection(travelArrangements: TravelArrangement[], yPosition: number): Promise<number> {
    const validTravelArrangements = travelArrangements.filter(DataValidators.hasMeaningfulTravelData);

    if (validTravelArrangements.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Arreglos de Viaje", 20, yPosition);
    yPosition += 15;

    for (const arrangement of validTravelArrangements) {
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 120);
      
      // Travel arrangement header
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText(`Viaje: ${Formatters.translateTransportType(arrangement.transportation_type)}`, 30, yPosition);
      yPosition += 15;

      // Travel details table
      const travelData = [
        ['Tipo', Formatters.translateTransportType(arrangement.transportation_type)],
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
            0: { cellWidth: 40, fontStyle: 'bold', textColor: [125, 1, 1] },
            1: { cellWidth: 140 }
          }
        });
        yPosition = this.pdfDoc.getLastAutoTableY() + 10;
      }

      // Add pickup map and QR if address is provided
      if (arrangement.pickup_address) {
        await this.addPickupMapAndQR(arrangement.pickup_address, yPosition);
        yPosition += 100; // Account for map and QR space
      }
    }
    
    return yPosition;
  }

  private async addPickupMapAndQR(pickupAddress: string, yPosition: number): Promise<void> {
    try {
      // Try to geocode and add static OSM map
      const coords = await MapService.geocodeAddress(pickupAddress);
      if (coords) {
        const mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng);
        if (mapDataUrl) {
          yPosition = this.pdfDoc.checkPageBreak(yPosition, 100);
          
          this.pdfDoc.setText(11, [125, 1, 1]);
          this.pdfDoc.addText('Mapa de Recogida:', 20, yPosition);
          yPosition += 10;
          
          try {
            const mapWidth = 160;
            const mapHeight = 80;
            this.pdfDoc.addImage(mapDataUrl, 'JPEG', 25, yPosition, mapWidth, mapHeight);
          } catch (err) {
            console.error('Error adding pickup map:', err);
          }
        }
      }

      // Generate QR to Google Maps route
      const pickupRouteUrl = MapService.generateRouteUrl(DEPARTURE_ADDRESS, pickupAddress);
      const pickupQrDataUrl = await QRService.generateQRCode(pickupRouteUrl);
      if (pickupQrDataUrl) {
        const { width: pageWidth } = this.pdfDoc.dimensions;
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 70);

        const qrSize = 50;
        this.pdfDoc.addImage(pickupQrDataUrl, 'PNG', 25, yPosition, qrSize, qrSize);

        // Info box
        this.pdfDoc.document.setDrawColor(200, 200, 200);
        this.pdfDoc.document.setLineWidth(0.3);
        this.pdfDoc.document.rect(85, yPosition, 110, qrSize);
        this.pdfDoc.setFillColor(248, 249, 250);
        this.pdfDoc.addRect(85, yPosition, 110, 15, 'F');

        this.pdfDoc.setText(10, [125, 1, 1]);
        this.pdfDoc.addText('Ruta a Recogida', 90, yPosition + 10);

        this.pdfDoc.setText(8, [51, 51, 51]);
        this.pdfDoc.addText('Escanea para obtener', 90, yPosition + 25);
        this.pdfDoc.addText('direcciones en Google Maps', 90, yPosition + 35);
      }
    } catch (error) {
      console.error('Error adding pickup map and QR:', error);
    }
  }
}