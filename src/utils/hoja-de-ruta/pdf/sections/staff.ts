import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class StaffSection {
  constructor(private pdfDoc: PDFDocument) {}

  addStaffSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Personal", 20, yPosition);
    yPosition += 15;

    const validStaff = eventData.staff?.filter(staff => 
      DataValidators.hasData(staff.name) || 
      DataValidators.hasData(staff.position) || 
      DataValidators.hasData(staff.department)
    ) || [];

    if (validStaff.length === 0) {
      return yPosition;
    }

    const staffData = validStaff.map(staff => [
      `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim(),
      staff.position || '',
      staff.department || '',
      Formatters.formatPhone(staff.phone || ''),
      staff.dni || '—',
      '—' // Email placeholder - field doesn't exist yet in interface
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Posición", "Departamento", "Teléfono", "DNI", "Email"]],
      body: staffData,
      theme: "grid",
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Nombre
        1: { cellWidth: 25 }, // Posición
        2: { cellWidth: 25 }, // Departamento
        3: { cellWidth: 25 }, // Teléfono
        4: { cellWidth: 20 }, // DNI
        5: { cellWidth: 35 }  // Email
      },
      margin: { left: 15, right: 15 }
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}