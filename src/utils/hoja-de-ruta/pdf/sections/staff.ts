import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { hojaGeometry, hojaTable } from '../hoja-report-system';
import { DataValidators } from '../utils/validators';

export class StaffSection {
  constructor(private pdfDoc: PDFDocument) {}

  addStaffSection(eventData: EventData, yPosition: number): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    const validStaff = eventData.staff?.filter(staff =>
      DataValidators.hasData(staff.name) ||
      DataValidators.hasData(staff.position)
    ) || [];

    if (validStaff.length === 0) {
      return yPosition;
    }

    const staffData = validStaff.map(staff => [
      (staff.name || '').trim(),
      `${staff.surname1 || ''} ${staff.surname2 || ''}`.trim(),
      staff.position || '',
    ]);

    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Apellidos", "Posición"]],
      body: staffData,
      ...hojaTable(hojaGeometry(this.pdfDoc.document), {
        weights: [32, 36, 52],
      }),
    });

    return this.pdfDoc.getLastAutoTableY() + 10;
  }
}
