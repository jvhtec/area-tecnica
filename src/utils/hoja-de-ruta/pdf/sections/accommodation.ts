import { PDFDocument } from '../core/pdf-document';
import { EventData, Accommodation } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class AccommodationSection {
  constructor(private pdfDoc: PDFDocument) {}

  addAccommodationSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): number {
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