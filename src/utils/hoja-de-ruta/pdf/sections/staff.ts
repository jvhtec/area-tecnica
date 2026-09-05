import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { hojaGeometry, hojaTable } from '../hoja-report-system';
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
      ...hojaTable(hojaGeometry(this.pdfDoc.document), {
        numericColumns: [3],
        weights: [30, 34, 32, 24],
      }),
    });

    return this.pdfDoc.getLastAutoTableY() + 10;
  }
}
