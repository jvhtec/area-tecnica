import { PDFDocument } from '../core/pdf-document';
import { EventData, Accommodation } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class RoomingSection {
  constructor(private pdfDoc: PDFDocument) {}

  addRoomingSection(accommodations: Accommodation[], eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Rooming", 20, yPosition);
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
      this.pdfDoc.addText("No hay asignaciones de habitaciones disponibles", 30, yPosition);
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
      theme: "grid",
      styles: { 
        fontSize: 9, 
        cellPadding: 3,
        overflow: 'linebreak',
        columnWidth: 'wrap'
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 35 }, // Hotel
        1: { cellWidth: 25 }, // Habitación  
        2: { cellWidth: 25 }, // Tipo
        3: { cellWidth: 60 }, // Ocupantes
        4: { cellWidth: 35 }  // Notas
      },
      margin: { left: 20, right: 20 }
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}