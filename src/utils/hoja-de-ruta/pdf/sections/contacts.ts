import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class ContactsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addContactsSection(eventData: EventData, yPosition: number): number {
    const validContacts = eventData.contacts?.filter(contact => 
      DataValidators.hasData(contact.name) || 
      DataValidators.hasData(contact.role) || 
      DataValidators.hasData(contact.phone)
    ) || [];
    
    if (validContacts.length === 0) return yPosition;

    yPosition = this.pdfDoc.checkPageBreak(yPosition);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Contactos", 20, yPosition);
    yPosition += 10;

    const contactsTableData = validContacts.map((contact) => [
      contact.name || '',
      contact.role || '',
      Formatters.formatPhone(contact.phone || ''),
    ]);
    
    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Rol", "Teléfono"]],
      body: contactsTableData,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 3,
        valign: 'top',
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 11,
        fontStyle: 'bold',
      },
      margin: { left: 10, right: 10 },
    });
    
    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}