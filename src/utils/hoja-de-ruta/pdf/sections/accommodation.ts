import { PDFDocument } from '../core/pdf-document';
import { EventData, Accommodation } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';
import { DEPARTURE_ADDRESS } from '../constants';

export class AccommodationSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addAccommodationSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): Promise<number> {
    const validAccommodations = accommodations.filter(acc => 
      DataValidators.hasData(acc.hotel_name) || acc.rooms.some(DataValidators.hasMeaningfulRoomData)
    );

    if (validAccommodations.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Alojamiento", 20, yPosition);
    yPosition += 15;

    for (const accommodation of validAccommodations) {
      if (DataValidators.hasData(accommodation.hotel_name)) {
        this.pdfDoc.setText(12, [125, 1, 1]);
        this.pdfDoc.addText(accommodation.hotel_name!, 30, yPosition);
        yPosition += 12;
      }

      if (DataValidators.hasData(accommodation.address)) {
        this.pdfDoc.setText(10, [51, 51, 51]);
        this.pdfDoc.addText(`Dirección: ${accommodation.address}`, 35, yPosition);
        yPosition += 10;
      }

      const checkInfo = [];
      if (accommodation.check_in) checkInfo.push(`Check-in: ${accommodation.check_in}`);
      if (accommodation.check_out) checkInfo.push(`Check-out: ${accommodation.check_out}`);
      
      if (checkInfo.length > 0) {
        this.pdfDoc.addText(checkInfo.join(' | '), 35, yPosition);
        yPosition += 15;
      }

      // Add hotel map and route QR if address exists
      if (accommodation.address) {
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 100);
        
        const mapWidth = 160;
        const mapHeight = 80;
        let mapAdded = false;
        
        try {
          const coords = await MapService.geocodeAddress(accommodation.address);
          if (coords) {
            const mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng, mapWidth, mapHeight);
            if (mapDataUrl) {
              this.pdfDoc.addImage(mapDataUrl, "JPEG", 20, yPosition, mapWidth, mapHeight);
              mapAdded = true;
            }
          }
        } catch (error) {
          console.error("Error adding hotel map:", error);
        }
        
        // Add fallback if map failed
        if (!mapAdded) {
          this.pdfDoc.setText(10, [125, 1, 1]);
          this.pdfDoc.addText("[MAPA NO DISPONIBLE]", 20, yPosition + 35);
        }
        
        // Always generate and add route QR
        try {
          const routeUrl = MapService.generateRouteUrl(DEPARTURE_ADDRESS, accommodation.address);
          const qrCode = await QRService.generateQRCode(routeUrl);
          this.pdfDoc.addImage(qrCode, "PNG", mapWidth + 30, yPosition, 50, 50);
          
          // Add QR info text
          this.pdfDoc.setText(8, [80, 80, 80]);
          this.pdfDoc.addText("Ruta al hotel", mapWidth + 30, yPosition + 55);
        } catch (qrError) {
          console.error("Error generating hotel QR:", qrError);
        }
        
        yPosition += mapHeight + 15;
      }

      // Rooming subheader
      yPosition = this.pdfDoc.checkPageBreak(yPosition, 20);
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText("Asignación de habitaciones", 20, yPosition);
      yPosition += 12;

      // Room assignments
      const validRooms = accommodation.rooms.filter(DataValidators.hasMeaningfulRoomData);
      if (validRooms.length > 0) {
        const roomData = validRooms.map(room => [
          room.room_type || 'N/A',
          room.room_number || 'Por asignar',
          Formatters.getStaffName(room.staff_member1_id || '', eventData.staff),
          Formatters.getStaffName(room.staff_member2_id || '', eventData.staff)
        ]);

        this.pdfDoc.addTable({
          startY: yPosition,
          head: [["Tipo", "Habitación", "Huésped 1", "Huésped 2"]],
          body: roomData,
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: {
            fillColor: [125, 1, 1],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold'
          }
        });
        yPosition = this.pdfDoc.getLastAutoTableY() + 15;
      }
    }

    return yPosition;
  }
}