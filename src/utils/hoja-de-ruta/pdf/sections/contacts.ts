import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';
import { DataValidators } from '../utils/validators';
import { Formatters } from '../utils/formatters';

export class ContactsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addContactsSection(eventData: EventData, yPosition: number): number {
    yPosition = this.pdfDoc.checkPageBreak(yPosition, 50);
    
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText("Contactos", 20, yPosition);
    yPosition += 15;

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
      contact.email || '—'
    ]);
    
    this.pdfDoc.addTable({
      startY: yPosition,
      head: [["Nombre", "Rol", "Teléfono", "Email"]],
      body: contactsTableData,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'top',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 40 }, // Nombre
        1: { cellWidth: 35 }, // Rol
        2: { cellWidth: 35 }, // Teléfono
        3: { cellWidth: 50 }  // Email
      },
      margin: { left: 20, right: 20 },
    });
    
    return this.pdfDoc.getLastAutoTableY() + 15;
  }
}