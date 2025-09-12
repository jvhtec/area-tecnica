import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class StaffSection {
  constructor(private pdfDoc: PDFDocument) {}

  addStaffSection(eventData: EventData, yPosition: number): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    const validStaff = eventData.staff?.filter(staff => 
      DataValidators.hasData(staff.name) || 
      DataValidators.hasData(staff.position) || 
      DataValidators.hasData(staff.dni)
    ) || [];

    if (validStaff.length === 0) {
      return yPosition;
    }

    const staffData = validStaff.map(staff => [
      (staff.name || '').trim(),
      `${staff.surname1 || ''} ${staff.surname2 || ''}`.trim(),
      staff.position || '',
      staff.dni || '—',
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Apellidos", "Posición", "DNI"]],
      body: staffData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Nombre
        1: { cellWidth: 45 }, // Apellidos
        2: { cellWidth: 32 }, // Posición
        3: { cellWidth: 22 }, // DNI
      },
      margin: { left: 20, right: 20 },
      tableWidth: 'wrap'
    });

    return this.pdfDoc.getLastAutoTableY() + 10;
  }
}
