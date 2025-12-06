import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
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
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        valign: 'top',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [250, 245, 245]
      },
      margin: { left: 20, right: 20 },
      tableWidth: 'auto',
    });

    return this.pdfDoc.getLastAutoTableY() + 10;
  }
}
