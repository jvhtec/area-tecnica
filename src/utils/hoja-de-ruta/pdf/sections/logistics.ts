import { PDFDocument } from '../core/pdf-document';
import { EventData } from '../core/pdf-types';

export class LogisticsSection {
  constructor(private pdfDoc: PDFDocument) {}

  addLogisticsSection(eventData: EventData, yPosition: number): number {
    let currentY = yPosition;

    // Check if there's any logistics data to display
    const hasLogisticsData = eventData.logistics?.transport?.length > 0 ||
      eventData.logistics?.loadingDetails ||
      eventData.logistics?.unloadingDetails ||
      eventData.logistics?.equipmentLogistics;

    if (!hasLogisticsData) {
      return currentY;
    }

    currentY = this.pdfDoc.checkPageBreak(currentY, 40);

    // Add section header
    this.pdfDoc.setText(14, [125, 1, 1]);
    this.pdfDoc.addText('Logística', 20, currentY);
    currentY += 15;

    // Add transport details if available
    if (eventData.logistics?.transport?.length > 0) {
      const transportData = eventData.logistics.transport.map(transport => [
        transport.transport_type || '',
        transport.driver_name || '',
        transport.driver_phone || '',
        transport.license_plate || '',
        transport.company || ''
      ]);

      this.pdfDoc.addTable({
        startY: currentY,
        head: [['Tipo', 'Conductor', 'Teléfono', 'Matrícula', 'Empresa']],
        body: transportData,
        theme: 'grid',
        headStyles: { fillColor: [125, 1, 1], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
        margin: { left: 20, right: 20 }
      });

      currentY = this.pdfDoc.getLastAutoTableY() + 10;
    }

    // Add loading details
    if (eventData.logistics?.loadingDetails) {
      currentY = this.pdfDoc.checkPageBreak(currentY, 20);
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText('Detalles de Carga:', 20, currentY);
      currentY += 8;
      
      this.pdfDoc.setText(10, [80, 80, 80]);
      const loadingLines = eventData.logistics.loadingDetails.split('\n');
      for (const line of loadingLines) {
        currentY = this.pdfDoc.checkPageBreak(currentY, 6);
        this.pdfDoc.addText(line, 20, currentY);
        currentY += 6;
      }
      currentY += 5;
    }

    // Add unloading details
    if (eventData.logistics?.unloadingDetails) {
      currentY = this.pdfDoc.checkPageBreak(currentY, 20);
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText('Detalles de Descarga:', 20, currentY);
      currentY += 8;
      
      this.pdfDoc.setText(10, [80, 80, 80]);
      const unloadingLines = eventData.logistics.unloadingDetails.split('\n');
      for (const line of unloadingLines) {
        currentY = this.pdfDoc.checkPageBreak(currentY, 6);
        this.pdfDoc.addText(line, 20, currentY);
        currentY += 6;
      }
      currentY += 5;
    }

    // Add equipment logistics
    if (eventData.logistics?.equipmentLogistics) {
      currentY = this.pdfDoc.checkPageBreak(currentY, 20);
      this.pdfDoc.setText(12, [125, 1, 1]);
      this.pdfDoc.addText('Logística de Equipos:', 20, currentY);
      currentY += 8;
      
      this.pdfDoc.setText(10, [80, 80, 80]);
      const equipmentLines = eventData.logistics.equipmentLogistics.split('\n');
      for (const line of equipmentLines) {
        currentY = this.pdfDoc.checkPageBreak(currentY, 6);
        this.pdfDoc.addText(line, 20, currentY);
        currentY += 6;
      }
      currentY += 5;
    }

    return currentY + 10;
  }
}