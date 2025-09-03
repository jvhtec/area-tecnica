import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class StaffSection {
  constructor(private pdfDoc: PDFDocument) {}

  addStaffSection(eventData: EventData, yPosition: number): number {
    const validStaff = eventData.staff?.filter(staff => 
      DataValidators.hasData(staff.name) || 
      DataValidators.hasData(staff.position) || 
      DataValidators.hasData(staff.department)
    ) || [];

    if (validStaff.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Personal", 20, yPosition);
    yPosition += 10;

    const staffData = validStaff.map(staff => [
      `${staff.name || ''} ${staff.surname1 || ''} ${staff.surname2 || ''}`.trim(),
      staff.position || '',
      staff.department || '',
      Formatters.formatPhone(staff.phone || '')
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Posición", "Departamento", "Teléfono"]],
      body: staffData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      }
    });

    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}