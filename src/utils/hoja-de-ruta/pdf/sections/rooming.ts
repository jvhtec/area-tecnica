import { PDFDocument } from '../core/pdf-document';
import { HOJA_HEADING, HOJA_INDENT, HOJA_LABEL, HOJA_LEFT, hojaGeometry, hojaTable } from '../hoja-report-system';
import { EventData, Accommodation } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class RoomingSection {
  constructor(private pdfDoc: PDFDocument) {}

  addRoomingSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);
    
    this.pdfDoc.setText(14, HOJA_HEADING);
    this.pdfDoc.addText("Rooming", HOJA_LEFT, yPosition);
    yPosition += 15;

    // Collect all room assignments from accommodations
    const allRooms: Array<{
      hotel: string;
      room: string;
      type: string;
      occupants: string[];
      notes: string;
    }> = [];

    accommodations.forEach(accommodation => {
      if (accommodation.rooms && accommodation.rooms.length > 0) {
        accommodation.rooms.forEach(room => {
          // Simple fallback for occupants - use empty array if no assignment data
          const occupantNames: string[] = [];

          allRooms.push({
            hotel: accommodation.hotel_name || 'Hotel no especificado',
            room: room.room_number || 'N/A',
            type: room.room_type || 'No especificado',
            occupants: occupantNames,
            notes: '—' // Notes placeholder - field doesn't exist yet
          });
        });
      }
    });

    if (allRooms.length === 0) {
      // Show placeholder
      this.pdfDoc.setText(10, [128, 128, 128]);
      this.pdfDoc.addText("No hay asignaciones de habitaciones disponibles", HOJA_INDENT, yPosition);
      return yPosition + 20;
    }

    // Create table data
    const roomingData = allRooms.map(room => [
      room.hotel,
      room.room,
      room.type,
      room.occupants.join(', ') || 'Sin asignar',
      room.notes || '—'
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Hotel", "Habitación", "Tipo", "Ocupantes", "Notas"]],
      body: roomingData,
      ...hojaTable(hojaGeometry(this.pdfDoc.document), {
        numericColumns: [1],
        weights: [24, 16, 16, 32, 22],
      }),
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}
