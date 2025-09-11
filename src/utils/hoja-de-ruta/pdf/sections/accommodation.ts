import { PDFDocument } from '../core/pdf-document';
import { EventData, Accommodation } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';
import { MapService } from '../services/map-service';
import { QRService } from '../services/qr-service';

export class AccommodationSection {
  constructor(private pdfDoc: PDFDocument) {}

  async addAccommodationSection(
    accommodations: Accommodation[], 
    eventData: EventData, 
    yPosition: number,
    suppressRoomTable: boolean = false
  ): Promise<number> {
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
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 110);

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
        let mapW = desiredMapWidth;
        let qrX = leftMargin + desiredMapWidth + gap;
        let qrY = yPosition;

        if (!sideBySide) {
          // stack vertically
          mapW = availableWidth;
          mapX = leftMargin;
          mapY = yPosition;
          qrX = leftMargin;
          qrY = yPosition + mapHeight + 10;
        } else {
          // side-by-side, clamp QR within right margin
          mapW = desiredMapWidth;
          qrX = Math.min(leftMargin + mapW + gap, pageWidth - rightMargin - qrSize);
          qrY = yPosition;
        }

        let mapAdded = false;
        try {
          const coords = await MapService.geocodeAddress(accommodation.address);
          if (coords) {
            const mapDataUrl = await MapService.getStaticMapDataUrl(coords.lat, coords.lng, mapW, mapHeight);
            if (mapDataUrl) {
              try {
                this.pdfDoc.addImage(mapDataUrl, 'PNG', mapX, mapY, mapW, mapHeight);
                mapAdded = true;
              } catch (errPng) {
                try {
                  this.pdfDoc.addImage(mapDataUrl, 'JPEG', mapX, mapY, mapW, mapHeight);
                  mapAdded = true;
                } catch (err) {
                  console.error('Error adding accommodation map:', err);
                }
              }
            }
          }
        } catch (error) {
          console.error("Error adding hotel map:", error);
        }

        if (!mapAdded) {
          this.pdfDoc.setText(10, [125, 1, 1]);
          this.pdfDoc.addText("[MAPA NO DISPONIBLE]", mapX + 5, mapY + mapHeight / 2);
        }

        try {
          const destUrl = MapService.generateDestinationUrl(accommodation.address);
          const qrCode = await QRService.generateQRCode(destUrl);
          this.pdfDoc.addImage(qrCode, "PNG", qrX, qrY, qrSize, qrSize);

          // QR captions
          this.pdfDoc.setText(9, [125, 1, 1]);
          this.pdfDoc.addText("Ruta al hotel", qrX, qrY + qrSize + 6);
          this.pdfDoc.setText(8, [80, 80, 80]);
          this.pdfDoc.addText("Escanea para direcciones", qrX, qrY + qrSize + 12);
        } catch (qrError) {
          console.error("Error generating hotel QR:", qrError);
        }

        // advance yPosition past the lower of map/QR blocks
        const blockBottom = sideBySide
          ? Math.max(mapY + mapHeight, qrY + qrSize)
          : (qrY + qrSize);
        yPosition = blockBottom + 15;
      }

      if (!suppressRoomTable) {
        // Rooming subheader (ensure minimal top padding on continued pages)
        yPosition = this.pdfDoc.checkPageBreak(yPosition, 20);
        if (yPosition > 20 && yPosition <= 30) {
          yPosition = 20;
        }
        this.pdfDoc.setText(12, [125, 1, 1]);
        this.pdfDoc.addText("Rooming", 20, yPosition);
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
            },
            margin: { left: 20, right: 20 },
            tableWidth: 'auto'
          });
          yPosition = this.pdfDoc.getLastAutoTableY() + 15;
        }
      }
    }

    return yPosition;
  }
}
