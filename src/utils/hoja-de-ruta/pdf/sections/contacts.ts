import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { hojaGeometry, hojaTable } from '../hoja-report-system';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class ContactsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addContactsSection(eventData: EventData, yPosition: number): number {
    // Start directly after the section header; no repeated subtitle
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 30);

    const validContacts = eventData.contacts?.filter(contact => 
      DataValidators.hasData(contact.name) || 
      DataValidators.hasData(contact.role) || 
      DataValidators.hasData(contact.phone)
    ) || [];
    
    if (validContacts.length === 0) {
      return yPosition;
    }

    const contactsTableData = validContacts.map((contact) => [
      contact.name || '',
      contact.role || '',
      Formatters.formatPhone(contact.phone || ''),
    ]);
    
    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Cargo", "Teléfono"]],
      body: contactsTableData,
      ...hojaTable(hojaGeometry(this.pdfDoc.document), {
        numericColumns: [2],
        weights: [42, 38, 30],
      }),
    });

    return this.pdfDoc.getLastAutoTableY() + 10;
  }
}
